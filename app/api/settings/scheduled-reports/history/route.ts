import { NextRequest, NextResponse } from "next/server";
import DB from "@app/_database/db";
import ReportExecution from "@app/_model/reportExecution.model";

(async () => await DB())();

function getAuthUser(req: NextRequest) {
  const userHeader = req.headers.get("user");
  if (!userHeader) return null;
  try {
    return JSON.parse(userHeader);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser || (authUser.role !== "admin" && authUser.role !== "manager")) {
      return NextResponse.json(
        { type: "UNAUTHORIZED", message: "You are not authorized to view report execution history" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;
    const scheduleId = searchParams.get("scheduleId");
    const status = searchParams.get("status");

    const query: any = {};
    if (scheduleId) query.scheduleId = scheduleId;
    if (status) query.status = status;

    const [executions, total] = await Promise.all([
      ReportExecution.find(query)
        .sort({ executedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReportExecution.countDocuments(query),
    ]);

    return NextResponse.json({
      type: "SUCCESS",
      message: "Execution history retrieved successfully",
      data: {
        executions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error("[settings/scheduled-reports/history] GET error:", error);
    return NextResponse.json(
      {
        type: "ERROR",
        message: error?.message || "Failed to retrieve execution history",
      },
      { status: 500 }
    );
  }
}
