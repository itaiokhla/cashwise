/**
 * POST /api/reports/generate-now
 *
 * Admin-only endpoint to manually trigger a saved report schedule now.
 * Uses the SAME pipeline as the cron job — no duplicate logic — and does
 * not change the schedule's next-run state.
 *
 * Request body:
 *  scheduleId   - (required) ID of the ScheduledReport to execute
 *
 * Returns the share URL and execution summary.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";
import { resolveAppBaseUrl, runReport, scheduleToJob } from "@app/_lib/autoExpenseReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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

    if (!scheduleId || !mongoose.Types.ObjectId.isValid(scheduleId)) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "A valid scheduleId is required" },
        { status: 400 }
      );
    }

    await DB();
    const schedule = await ScheduledReport.findById(scheduleId).lean();
    if (!schedule) {
      return NextResponse.json(
        { type: "NOT_FOUND", message: "Schedule not found" },
        { status: 404 }
      );
    }

    const result = await runReport(scheduleToJob(schedule), {
      triggeredBy: "manual_generate",
      appBaseUrl: resolveAppBaseUrl(new URL(req.url).origin),
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
