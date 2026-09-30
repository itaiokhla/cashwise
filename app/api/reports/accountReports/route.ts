import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import Users from "@app/_model/user.model";
import OfficeExpense from "@app/_model/office.modal";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import TravelExpense from "@app/_model/travel.modal";

(async function initializeDB() {
  await DB();
})();
export async function GET(req: NextRequest) {
    try{
// 1. find all users
// 2. filter with userId
const user = await Users.findOne({ _id: new mongoose.Types.ObjectId(req.nextUrl.searchParams.get("userId") || "") });
        if (!user) {
            return NextResponse.json({ type: "ERROR", message: "User not found." }, { status: 404 });
        }
// 3. find all office expenses

        const officeExpenses = await OfficeExpense.find({
            user: user._id,
            createdAt: {
                $gte: DateTime.fromISO(req.nextUrl.searchParams.get("fromDate") || "").toJSDate(),
                $lte: DateTime.fromISO(req.nextUrl.searchParams.get("toDate") || "").toJSDate()
            }
        }).sort({ createdAt: -1 });
// 4. find all personal expenses
        const personalExpenses = await TravelExpense.find({
            user: user._id,
            createdAt: {
                $gte: DateTime.fromISO(req.nextUrl.searchParams.get("fromDate") || "").toJSDate(),
                $lte: DateTime.fromISO(req.nextUrl.searchParams.get("toDate") || "").toJSDate()
            }
        }).sort({ createdAt: -1 });
// 5. merge office and personal expenses
        const mergedExpenses = [...officeExpenses, ...personalExpenses].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
// 6. limit to 20 expenses
        const limitedExpenses = mergedExpenses.slice(0, 20);
// 7. return response   
        return NextResponse.json({
            type: "SUCCESS",
            message: "User expense reports fetched successfully.",
            data: limitedExpenses
        }, { status: 200 });
        
    }catch (error) {
        console.error("Error in GET /api/reports/userExpenseReports:", error);
        return NextResponse.json({ type: "ERROR", message: "An error occurred while processing your request." }, { status: 500 });
    }
}