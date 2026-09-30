'use server'
import dbConnect from "@app/_database/db";
import Users from "@app/_model/user.model"
import { NextRequest, NextResponse } from "next/server";


(async function initializeDB() {
  await dbConnect();
})();


export async function GET(req: NextRequest) {
  try {
    const userHeader = req.headers.get("user");
    if (!userHeader) {
      return NextResponse.json(
        { type: "UNAUTHORIZED", message: "No user header found" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const fromDate = url.searchParams.get("fromDate") || "";
    const toDate = url.searchParams.get("toDate") || "";
    const usersId = JSON.parse(url.searchParams.get("usersId") || "[]");

    if (!usersId.length) {
      return NextResponse.json(
        { type: "ERROR", message: "usersId is required" },
        { status: 400 }
      );
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const users: any = await Users.find({ _id: { $in: usersId } });

    const result: any = [];

    for (const user of users) {
      let transactions: any[] = [];

      // CREDIT
      user.credit?.forEach((c: any) => {
        c.transactionDetails?.forEach((t: any) => {
          transactions.push({
            type: "credit",
            amount: t.money,
            date: new Date(t.createdAt),
          });
        });
      });

      // DEBIT
      user.debit?.forEach((d: any) => {
        d.transactionDetails?.forEach((t: any) => {
          transactions.push({
            type: "debit",
            amount: t.money,
            date: new Date(t.createdAt),
          });
        });
      });

      // SORT ALL TRANSACTIONS (IMPORTANT for cumulative)
      transactions.sort((a, b) => a.date - b.date);

      // FILTER RANGE
      const filtered = transactions.filter(
        (t) => t.date >= start && t.date <= end
      );

      // 🔹 SINGLE DAY
      if (fromDate === toDate) {
        const creditArr: any[] = [];
        const debitArr: any[] = [];

        let totalCredit = 0;
        let totalDebit = 0;

        transactions.forEach((t) => {
          if (t.date <= end) {
            if (t.type === "credit") totalCredit += t.amount;
            else totalDebit += t.amount;
          }
        });

        filtered.forEach((t) => {
          if (t.type === "credit") creditArr.push(t);
          else debitArr.push(t);
        });

        result.push({
          userId: user._id,
          name: user.name,
          date: fromDate,
          credit: creditArr,
          debit: debitArr,
          totalCredit,
          totalDebit,
          balance: totalCredit - totalDebit,
        });

        continue;
      }

      // 🔹 RANGE CASE
      const dateMap: any = {};

      filtered.forEach((t) => {
        const dateKey = t.date.toISOString().split("T")[0];

        if (!dateMap[dateKey]) {
          dateMap[dateKey] = {
            credit: [],
            debit: [],
          };
        }

        if (t.type === "credit") {
          dateMap[dateKey].credit.push(t);
        } else {
          dateMap[dateKey].debit.push(t);
        }
      });

      // cumulative tracking
      let runningCredit = 0;
      let runningDebit = 0;

      const dailyBalances = Object.keys(dateMap)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .map((date) => {
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);

          // calculate cumulative till this date
          runningCredit = 0;
          runningDebit = 0;

          transactions.forEach((t) => {
            if (t.date <= dayEnd) {
              if (t.type === "credit") runningCredit += t.amount;
              else runningDebit += t.amount;
            }
          });

          return {
            date,
            credit: dateMap[date].credit,
            debit: dateMap[date].debit,
            totalCredit: runningCredit,
            totalDebit: runningDebit,
            balance: runningCredit - runningDebit,
          };
        });

      result.push({
        userId: user._id,
        name: user.name,
        data: dailyBalances,
      });
    }

    return NextResponse.json({
      type: "SUCCESS",
      data: result,
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    return new Response(
      JSON.stringify({ type: "ERROR", message: "Failed to fetch users" }),
      { status: 500 }
    );
  }
}