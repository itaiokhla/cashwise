/**
 * POST /api/settings/scheduled-reports/test
 *
 * "Send now" / "Send test email" from the Settings page. Admin/Manager only.
 *
 * Body:
 *   scheduleId?  — send a saved schedule
 *   draft?       — or an unsaved schedule configuration from the editor
 *   recipients?  — override recipients (e.g. send the test only to yourself)
 *
 * Uses exactly the same pipeline as the scheduler but does not touch the
 * schedule's next-run state, so testing never skips or duplicates a
 * scheduled delivery.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";
import { resolveAppBaseUrl, runReport, scheduleToJob, type ReportJob } from "@app/_lib/autoExpenseReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAuthUser(req: NextRequest) {
  const h = req.headers.get("user");
  if (!h) return null;
  try { return JSON.parse(h); } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || !["admin", "manager"].includes(authUser.role)) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "Access denied" }, { status: 403 });
    }

    await DB();
    const body = await req.json().catch(() => ({}));

    let job: ReportJob;
    if (body.scheduleId) {
      if (!mongoose.Types.ObjectId.isValid(body.scheduleId)) {
        return NextResponse.json({ type: "BAD_REQUEST", message: "Invalid scheduleId" }, { status: 400 });
      }
      const schedule = await ScheduledReport.findById(body.scheduleId).lean();
      if (!schedule) {
        return NextResponse.json({ type: "NOT_FOUND", message: "Schedule not found" }, { status: 404 });
      }
      job = scheduleToJob(schedule);
    } else if (body.draft && typeof body.draft === "object") {
      const d = body.draft;
      job = scheduleToJob({
        name: String(d.name || "Test Report").slice(0, 100),
        reportType: d.reportType || "expense",
        frequency: d.frequency || "daily",
        time: d.time || "09:00",
        timezone: d.timezone || "Asia/Kolkata",
        dayOfWeek: d.dayOfWeek,
        dayOfMonth: d.dayOfMonth,
        reportPeriod: d.reportPeriod || "daily",
        coverage: d.coverage || "current",
        recipients: Array.isArray(d.recipients) ? d.recipients : [],
        linkTtlHours: d.linkTtlHours,
        attachFiles: d.attachFiles !== false,
        filters: d.filters || {},
      } as Parameters<typeof scheduleToJob>[0]);
      job.scheduleId = null;
    } else {
      return NextResponse.json({ type: "BAD_REQUEST", message: "scheduleId or draft is required" }, { status: 400 });
    }

    if (Array.isArray(body.recipients) && body.recipients.length > 0) {
      const override = body.recipients.map((e: unknown) => String(e).trim().toLowerCase());
      const bad = override.filter((e: string) => !EMAIL_RE.test(e));
      if (bad.length) {
        return NextResponse.json({ type: "VALIDATION_ERROR", message: `Invalid email(s): ${bad.join(", ")}` }, { status: 400 });
      }
      job.recipients = override;
    }

    const result = await runReport(job, {
      triggeredBy: "manual_test",
      appBaseUrl: resolveAppBaseUrl(new URL(req.url).origin),
    });

    return NextResponse.json({
      type: "SUCCESS",
      message: `Report sent to ${result.recipients.join(", ")}`,
      data: result,
    });
  } catch (error: any) {
    console.error("[settings/scheduled-reports/test] Error:", error);
    return NextResponse.json(
      { type: "ERROR", message: error?.message || "Failed to generate test report" },
      { status: 500 }
    );
  }
}
