import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import Users from "@app/_model/user.model";
import OfficeExpense from "@app/_model/office.modal";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import exp from "constants";
import TravelExpense from "@app/_model/travel.modal";

(async function initializeDB() {
  await DB();
})();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let usersId: string[] = body.users || [];
    if (usersId.length === 0) {
      usersId = await Users.distinct("_id");
    }
    const fromDate = body.fromDate
      ? DateTime.fromISO(body.fromDate).startOf("day").toJSDate()
      : new Date(0);
    const toDate = body.toDate
      ? DateTime.fromISO(body.toDate).endOf("day").toJSDate()
      : new Date();

    let reportData: any = [];

    if (body.accountReportTypes === "credit-debit") {
      const usersData = await Users.find({ _id: { $in: usersId } }).select(
        "_id name email phone role credit debit type"
      );
      reportData = usersData.map((user: any) => {
        // filter credit transactions
        const filteredCredit = (user.credit || [])
          .map((c: any) => {
            const details = (c.transactionDetails || []).filter((t: any) => {
              const created = new Date(t.createdAt);
              return created >= fromDate && created <= toDate;
            });
            return { ...(c.toObject?.() || c), transactionDetails: details };
          })
          .filter((c: any) => c.transactionDetails.length > 0);

        // filter debit transactions
        const filteredDebit = (user.debit || [])
          .map((d: any) => {
            const details = (d.transactionDetails || []).filter((t: any) => {
              const created = new Date(t.createdAt);
              return created >= fromDate && created <= toDate;
            });
            return { ...(d.toObject?.() || d), transactionDetails: details };
          })
          .filter((d: any) => d.transactionDetails.length > 0);

        return {
          userId: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          type: user.type,
          credit: filteredCredit,
          debit: filteredDebit,
        };
      });
    }
    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "User expense reports fetched successfully.",
        data: reportData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in POST /api/reports/userExpenseReports:", error);
    return NextResponse.json(
      {
        type: "ERROR",
        message: "An error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}
