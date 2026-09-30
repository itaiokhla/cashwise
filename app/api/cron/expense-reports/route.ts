/**
 * GET /api/cron/expense-reports
 *
 * Called every minute by the scheduler (scripts/scheduler.js).
 * Protected by CRON_SECRET — never callable without the secret in production.
 *
 * Flow:
 *  1. Verify CRON_SECRET
 *  2. Find enabled schedules where nextRunAt <= now
 *  3. Atomic idempotency: check executionKey uniqueness before running
 *  4. Generate report + share link + send email via sendAutomatedExpenseReports
 *  5. Update nextRunAt
 *  6. Log ReportExecution
 */

import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";
import ReportExecution from "@app/_model/reportExecution.model";
import { sendAutomatedExpenseReports, computeNextRun } from "@app/_lib/autoExpenseReport";
import type { ExpenseSource, ExpenseStatus } from "@app/_lib/reportEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

(async () => await DB())();

// ─── Authorization ────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow if no secret configured
  if (!cronSecret && process.env.NODE_ENV !== "production") {
    return true;
  }

  // In production CRON_SECRET is mandatory
  if (!cronSecret) {
    console.error("[cron/expense-reports] CRON_SECRET not configured — all requests denied");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");

  return authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret;
}

// ─── Execution key ────────────────────────────────────────────────────────────

/**
 * Deterministic execution key — same schedule + same reporting period will
 * always produce the same key, providing idempotency across duplicate cron fires.
 *
 * Key format: scheduleId:reportType:frequency:YYYY-MM-DD
 *
 * The date part is the LOCAL date in the schedule timezone — so a daily report
 * at 7:00 PM IST on Sep 28 has the same key regardless of whether the cron
 * fires at 19:00 or 19:01.
 */
function buildExecutionKey(
  scheduleId: string,
  reportType: string,
  frequency: string,
  localDate: string
): string {
  return `${scheduleId}:${reportType}:${frequency}:${localDate}`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { type: "UNAUTHORIZED", message: "Invalid or missing cron secret" },
        { status: 401 }
      );
    }

    await DB();

    const url = new URL(request.url);
    const forceRun = url.searchParams.get("force") === "true";
    const origin = url.origin;

    const now = new Date();
    let processedCount = 0;
    let skippedCount = 0;
    const results: unknown[] = [];

    // Fetch all enabled schedules
    const enabledSchedules = await ScheduledReport.find({ enabled: true }).lean();

    if (enabledSchedules.length === 0) {
      return NextResponse.json({
        type: "SUCCESS",
        message: "No enabled schedules found",
        summary: { totalSchedules: 0, processedCount: 0, skippedCount: 0 },
        results: [],
      });
    }

    for (const schedule of enabledSchedules) {
      const zone = schedule.timezone || "Asia/Kolkata";
      const nowInZone = DateTime.now().setZone(zone);
      const localDate = nowInZone.toISODate()!;

      // Determine if this schedule is due
      let isDue = forceRun;
      if (!isDue && schedule.nextRunAt) {
        isDue = now >= new Date(schedule.nextRunAt);
      }
      if (!isDue) {
        // Fallback: check if current time matches schedule time within 2-minute window
        const [schedHour, schedMinute] = (schedule.time || "09:00").split(":").map(Number);
        const timeDiff = Math.abs(nowInZone.hour * 60 + nowInZone.minute - schedHour * 60 - schedMinute);
        if (timeDiff <= 2) isDue = true;
      }

      if (!isDue) {
        skippedCount++;
        results.push({
          scheduleId: schedule._id,
          scheduleName: schedule.name,
          status: "skipped",
          reason: `Not due yet (Scheduled: ${schedule.time} ${zone}, nextRunAt: ${schedule.nextRunAt})`,
        });
        continue;
      }

      // Idempotency: use deterministic execution key based on LOCAL date
      const executionKey = buildExecutionKey(
        schedule._id.toString(),
        schedule.reportType,
        schedule.frequency,
        localDate
      );

      const alreadyRan = await ReportExecution.findOne({ executionKey, status: "success" }).lean();
      if (alreadyRan && !forceRun) {
        skippedCount++;
        results.push({
          scheduleId: schedule._id,
          scheduleName: schedule.name,
          status: "skipped",
          reason: "Already executed successfully for this period",
          executionKey,
        });
        continue;
      }

      // Execute report
      try {
        console.log(`[cron/expense-reports] Executing schedule "${schedule.name}" (${schedule._id})`);

        const reportResult = await sendAutomatedExpenseReports({
          scheduleId: schedule._id.toString(),
          scheduleName: schedule.name,
          reportType: schedule.reportType as any,
          frequency: schedule.frequency,
          time: schedule.time,
          period: schedule.reportPeriod as any,
          timezone: zone,
          recipients: schedule.recipients,
          executionKey,
          triggeredBy: "cron",
          filters: {
            userIds: schedule.filters?.userIds || [],
            expenseSources: (schedule.filters?.expenseSources || []) as ExpenseSource[],
            categories: schedule.filters?.categories || [],
            statuses: (schedule.filters?.statuses || []) as ExpenseStatus[],
            includeCredit: schedule.filters?.includeCredit !== false,
            includeDebit: schedule.filters?.includeDebit !== false,
            visibleFields: schedule.filters?.visibleFields || [],
            search: schedule.filters?.search || "",
          },
          appBaseUrl: origin,
        });

        // Update nextRunAt
        const nextRun = computeNextRun(schedule.frequency, schedule.time, zone, nowInZone);
        await ScheduledReport.findByIdAndUpdate(schedule._id, {
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          lastErrorMessage: null,
          nextRunAt: nextRun,
        });

        processedCount++;
        results.push({
          scheduleId: schedule._id,
          scheduleName: schedule.name,
          status: reportResult.skipped ? "skipped" : "success",
          executionKey,
          recordCount: reportResult.recordCount,
          totalAmount: reportResult.totalAmount,
          shareUrl: reportResult.shareUrl,
          shareExpiresAt: reportResult.shareExpiresAt,
          nextRunAt: nextRun,
        });
      } catch (err: any) {
        console.error(`[cron/expense-reports] Error executing schedule ${schedule._id}:`, err);

        await ScheduledReport.findByIdAndUpdate(schedule._id, {
          lastRunAt: new Date(),
          lastFailedAt: new Date(),
          lastErrorMessage: err.message || "Unknown error",
        });

        results.push({
          scheduleId: schedule._id,
          scheduleName: schedule.name,
          status: "failed",
          error: err.message || "Execution error",
          executionKey,
        });
      }
    }

    return NextResponse.json({
      type: "SUCCESS",
      message: `Processed ${processedCount} schedule(s), skipped ${skippedCount}`,
      summary: {
        totalSchedules: enabledSchedules.length,
        processedCount,
        skippedCount,
      },
      results,
    });
  } catch (error: any) {
    console.error("[cron/expense-reports] Route Error:", error);
    return NextResponse.json(
      { type: "ERROR", message: error?.message || "Failed to process cron expense reports" },
      { status: 500 }
    );
  }
}
