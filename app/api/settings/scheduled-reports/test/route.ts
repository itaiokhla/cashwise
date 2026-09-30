/**
 * POST /api/settings/scheduled-reports/test
 *
 * Manual "Generate Now" trigger from the Settings page.
 * Admin/Manager only.
 */

import { NextRequest, NextResponse } from "next/server";
import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";
import { sendAutomatedExpenseReports } from "@app/_lib/autoExpenseReport";
import type { ExpenseSource, ExpenseStatus } from "@app/_lib/reportEngine";

export const dynamic = "force-dynamic";
(async () => await DB())();

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

    const body = await req.json().catch(() => ({}));
    const { scheduleId, reportType, period, timezone, recipients } = body;

    let schedule: Record<string, unknown> | null = null;
    if (scheduleId) {
      schedule = await ScheduledReport.findById(scheduleId).lean() as Record<string, unknown> | null;
    }

    const origin = new URL(req.url).origin;

    const result = await sendAutomatedExpenseReports({
      scheduleId: scheduleId || undefined,
      scheduleName: (schedule?.name as string) || "Test Report",
      reportType: (reportType || schedule?.reportType || "expense") as any,
      period: (period || schedule?.reportPeriod || "daily") as any,
      timezone: timezone || (schedule?.timezone as string) || "Asia/Kolkata",
      recipients:
        (recipients as string[] | undefined) ||
        (schedule?.recipients as string[] | undefined) ||
        [],
      triggeredBy: "manual_test",
      filters: (body.filters || schedule?.filters)
        ? {
            userIds: (((body.filters || schedule?.filters) as Record<string, unknown>).userIds as string[]) || [],
            expenseSources: (((body.filters || schedule?.filters) as Record<string, unknown>).expenseSources as ExpenseSource[]) || [],
            categories: (((body.filters || schedule?.filters) as Record<string, unknown>).categories as string[]) || [],
            statuses: (((body.filters || schedule?.filters) as Record<string, unknown>).statuses as ExpenseStatus[]) || [],
            includeCredit: (((body.filters || schedule?.filters) as Record<string, unknown>).includeCredit as boolean) !== false,
            includeDebit: (((body.filters || schedule?.filters) as Record<string, unknown>).includeDebit as boolean) !== false,
            visibleFields: (((body.filters || schedule?.filters) as Record<string, unknown>).visibleFields as string[]) || [],
            search: (((body.filters || schedule?.filters) as Record<string, unknown>).search as string) || "",
          }
        : undefined,
      appBaseUrl: origin,
    });

    return NextResponse.json({
      type: "SUCCESS",
      message: "Test report generated and sent successfully!",
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { type: "ERROR", message: error?.message || "Failed to generate test report" },
      { status: 500 }
    );
  }
}
