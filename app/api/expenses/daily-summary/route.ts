// app/api/expenses/daily-summary/route.ts
"use server";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import DB from "@app/_database/db";
import { getDailyTotals } from "@app/_lib/validateExpenseLimit.server";

(async () => await DB())();

/**
 * GET /api/expenses/daily-summary
 *
 * Query params:
 *   userId  — MongoDB _id of the user
 *   schema  — "/officeExpense" | "/travelExpense" | "/toPayExpense"
 *
 * Response:
 *   { type: "SUCCESS", totals: { conveyance: 0, food: 0, ... } }
 */
export async function GET(req: NextRequest) {
  try {
    const url    = new URL(req.url);
    const userId = url.searchParams.get("userId") || "";
    const schema = url.searchParams.get("schema") || "/officeExpense";

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { type: "ERROR", message: "Valid userId is required" },
        { status: 400 }
      );
    }

    const totals = await getDailyTotals(userId, schema);

    return NextResponse.json({ type: "SUCCESS", totals }, { status: 200 });
  } catch (error: any) {
    console.error("daily-summary error:", error);
    return NextResponse.json(
      { type: "ERROR", message: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}