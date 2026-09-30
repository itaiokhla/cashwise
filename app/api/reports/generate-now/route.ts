/**
 * POST /api/reports/generate-now
 *
 * Admin-only endpoint to manually trigger a scheduled report.
 * Uses the SAME engine as the cron job — no duplicate logic.
 *
 * Request body:
 *  scheduleId   - (required) ID of the ScheduledReport to execute
 *  sendEmail    - (optional, default true) whether to send the email
 *
 * Returns the share URL and execution summary.
 */

import { NextRequest, NextResponse } from "next/server";
import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";
import { sendAutomatedExpenseReports } from "@app/_lib/autoExpenseReport";
import type { ExpenseSource, ExpenseStatus } from "@app/_lib/reportEngine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

(async () => await DB())();

function getAuthUser(req: NextRequest) {
  const header = req.headers.get("user");
  if (!header) return null;
  try { return JSON.parse(header); } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || !["admin", "manager"].includes(authUser.role)) {
      return NextResponse.json(
        { type: "UNAUTHORIZED", message: "Only admins can trigger manual report generation" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { scheduleId } = body;

    if (!scheduleId) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "scheduleId is required" },
        { status: 400 }
      );
    }

    const schedule = await ScheduledReport.findById(scheduleId).lean();
    if (!schedule) {
      return NextResponse.json(
        { type: "NOT_FOUND", message: "Schedule not found" },
        { status: 404 }
      );
    }

    // Build app base URL from request
    const origin = new URL(req.url).origin;

    const result = await sendAutomatedExpenseReports({
      scheduleId: schedule._id.toString(),
      scheduleName: schedule.name,
      reportType: schedule.reportType as any,
      frequency: schedule.frequency,
      time: schedule.time,
      period: schedule.reportPeriod as any,
      timezone: schedule.timezone,
      recipients: schedule.recipients,
      triggeredBy: "manual_generate",
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

    return NextResponse.json({
      type: "SUCCESS",
      message: "Report generated successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("[api/reports/generate-now] Error:", error);
    return NextResponse.json(
      { type: "ERROR", message: error?.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
