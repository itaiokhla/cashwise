import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import Users from "@app/_model/user.model";
import ToPayExpense from "@app/_model/toPay.modal";
import TravelExpense from "@app/_model/travel.modal";
import OfficeExpense from "@app/_model/office.modal";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import DataWithDate from "@app/_model/datawithdate.modal";

(async function initializeDB() {
  await DB();
})();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const userId = searchParams.get("userId") || "";
  const name = searchParams.get("name")?.toLowerCase() || "";
  const minAmount = parseFloat(searchParams.get("minAmount") || "0");
  const maxAmount = parseFloat(searchParams.get("maxAmount") || "0");
  const fromDate = searchParams.get("fromDate") || "";
  const toDate = searchParams.get("toDate") || "";
  const reason = searchParams.get("reason")?.toLowerCase() || "";
  const limit = parseInt(searchParams.get("limit") || "0");
  const transactionType = searchParams.get("transactionType") || "all";

  try {
    const startingDate = fromDate
      ? DateTime.fromISO(fromDate).setZone("Asia/Kolkata").startOf("day")
      : null;
    const endingDate = toDate
      ? DateTime.fromISO(toDate).setZone("Asia/Kolkata").endOf("day")
      : null;
    const account: any = await Users.findById(
      new mongoose.Types.ObjectId(userId)
    ).lean();
    if (!account) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "No user found!" },
        { status: 404 }
      );
    }
    const dateResult = await DataWithDate
      .findOne({})
      .sort({ createdAt: -1 });
    const dateResultStart =
      dateResult?.fromDate
        ? DateTime.fromJSDate(new Date(dateResult.fromDate))
          .setZone("Asia/Kolkata")
          .startOf("day")
        : null;

    const dateResultEnd =
      dateResult[0]?.toDate
        ? DateTime.fromJSDate(new Date(dateResult.toDate))
          .setZone("Asia/Kolkata")
          .endOf("day")
        : null;

    const filterTransactionGroup = (group: any[]) =>
      group
        .map((person: any) => {
          if (name && !person.name.toLowerCase().includes(name)) return null;

          const filteredTransactions = person.transactionDetails.filter(
            (t: any) => {
              const tDate = DateTime.fromJSDate(
                new Date(t.updatedAt || t.createdAt)
              ).setZone("Asia/Kolkata");
              const amount = t.money;

              const dateValid =
                (!startingDate || tDate >= startingDate) &&
                (!endingDate || tDate <= endingDate);

              const dateResultValid =
                (!dateResultStart || tDate >= dateResultStart) &&
                (!dateResultEnd || tDate <= dateResultEnd);
              const amountValid =
                (minAmount === 0 && maxAmount === 0) ||
                (minAmount > 0 && (!maxAmount || amount >= minAmount)) ||
                (maxAmount > 0 && (!minAmount || amount <= maxAmount)) ||
                (minAmount &&
                  maxAmount &&
                  amount >= minAmount &&
                  amount <= maxAmount);

              const reasonValid =
                !reason || t.reason?.toLowerCase().includes(reason);

              return (dateValid && amountValid && reasonValid && dateResultValid);
            }
          );

          return filteredTransactions.length > 0
            ? {
              ...person,
              transactionDetails: filteredTransactions.sort(
                (a: any, b: any) =>
                  new Date(b.updatedAt || b.createdAt).getTime() -
                  new Date(a.updatedAt || a.createdAt).getTime()
              ),
            }
            : null;
        })
        .filter(Boolean)
        .slice(0, limit > 0 ? limit : undefined);

    if (transactionType === "credit") {
      account.credit = filterTransactionGroup(account.credit || []);
      account.debit = [];
    } else if (transactionType === "debit") {
      account.debit = filterTransactionGroup(account.debit || []);
      account.credit = [];
    } else if (transactionType === "all") {
      account.credit = filterTransactionGroup(account.credit || []);
      account.debit = filterTransactionGroup(account.debit || []);
    } else {
      account.credit = [];
      account.debit = [];
    }

    const buildExpenseMatch = () => {
      const match: any = { createdBy: new mongoose.Types.ObjectId(userId) };
      if (startingDate || endingDate) {
        match.date = {};
        if (startingDate) match.date.$gte = startingDate.toFormat("yyyy-MM-dd");
        if (endingDate) match.date.$lte = endingDate.toFormat("yyyy-MM-dd");
      }
      if (dateResult?.fromDate || dateResult?.toDate) {
        match.createdAt = {};

        if (dateResult.fromDate) {
          match.createdAt.$gte = new Date(dateResult.fromDate);
        }

        if (dateResult.toDate) {
          const end = new Date(dateResult.toDate);
          end.setHours(23, 59, 59, 999);
          match.createdAt.$lte = end;
        }
      }
      console.log("match", match)
      return match;
    };

    const applyExpenseFilters = (data: any[]) => {
      return data
        .map((item: any) => {
          const filteredItem = { ...item };
          let hasMatchingData = false;
          Object.keys(item).forEach((key) => {
            if (Array.isArray(item[key])) {
              const filteredNested = item[key].filter((entry: any) => {
                const amount = parseFloat(entry.amount || 0);
                return (
                  (minAmount === 0 && maxAmount === 0) ||
                  (minAmount > 0 && (!maxAmount || amount >= minAmount)) ||
                  (maxAmount > 0 && (!minAmount || amount <= maxAmount)) ||
                  (minAmount &&
                    maxAmount &&
                    amount >= minAmount &&
                    amount <= maxAmount)
                );
              });
              if (filteredNested.length > 0) hasMatchingData = true;
              filteredItem[key] = filteredNested;
            }
          });
          return hasMatchingData ? filteredItem : null;
        })
        .filter(Boolean)
        .slice(0, limit > 0 ? limit : undefined);
    };

    const getFilteredExpenses = async (model: any) => {
      const pipeline: any[] = [
        { $match: buildExpenseMatch() },
        { $sort: { updatedAt: -1 } },
      ];
      if (limit > 0) pipeline.push({ $limit: limit });
      const data = await model.aggregate(pipeline);
      return applyExpenseFilters(data);
    };

    let officeExpense = [];
    let toPayExpense = [];
    let travelExpense = [];

    if (["all", "allExpense", "officeExpense"].includes(transactionType)) {
      officeExpense = await getFilteredExpenses(OfficeExpense);
    }
    if (["all", "allExpense", "toPayExpense"].includes(transactionType)) {
      toPayExpense = await getFilteredExpenses(ToPayExpense);
    }
    if (["all", "allExpense", "travelExpense"].includes(transactionType)) {
      travelExpense = await getFilteredExpenses(TravelExpense);
    }
    return NextResponse.json(
      {
        type: "SUCCESS",
        account,
        officeExpense,
        toPayExpense,
        travelExpense,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { type: "ERROR", message: "Something went wrong!" },
      { status: 500 }
    );
  }
}
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId") || "";
    const _id = searchParams.get("_id") || "";
    console.log("usred,_id __________", userId, _id)
    if (!userId || !_id) {
      return NextResponse.json(
        { error: "userId and _id are required" },
        { status: 400 }
      );
    }

    // Find the user who made the debit transaction
    const debitUser: any = await Users.findOne({ _id: new mongoose.Types.ObjectId(userId) });

    if (!debitUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Find the debit transaction in the user's debit array
    let debitTransaction = null;
    let debitEntryIndex = -1;
    let transactionIndex = -1;

    for (let i = 0; i < debitUser.debit.length; i++) {
      const debitEntry = debitUser.debit[i];
      const txnIndex = debitEntry.transactionDetails.findIndex(
        (txn: any) => txn._id.toString() === _id
      );

      if (txnIndex !== -1) {
        debitTransaction = debitEntry.transactionDetails[txnIndex];
        debitEntryIndex = i;
        transactionIndex = txnIndex;
        break;
      }
    }

    if (!debitTransaction) {
      return NextResponse.json(
        { error: "Debit transaction not found" },
        { status: 404 }
      );
    }

    // Store transaction details for matching
    const { money, reason, remarks, createdAt } = debitTransaction;
    const debitEntryName = debitUser.debit[debitEntryIndex].name;
    const debitEntryPhone = debitUser.debit[debitEntryIndex].phone;

    // Find the corresponding credit user
    const creditUser: any = await Users.findOne({ phone: Number(debitEntryPhone), name: debitEntryName })
    if (!creditUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    let creditDataDelete = false;
    if (creditUser) {
      // Find and remove the matching credit transaction
      for (let i = 0; i < creditUser.credit.length; i++) {
        const creditEntry = creditUser.credit[i];
        console.log("creditEntry", typeof creditEntry.phone, typeof debitUser.phone)
        // Check if this credit entry is from the debit user
        if (
          creditEntry.name === debitUser.name &&
          creditEntry.phone === debitUser.phone.toString()
        ) {
          // Find matching transaction in transactionDetails
          const matchingTxnIndex = creditEntry.transactionDetails.findIndex(
            (txn: any) =>
              txn.money === money &&
              txn.reason === reason &&
              txn.remarks === remarks &&
              new Date(txn.createdAt).getDate() === new Date(createdAt).getDate()
          );
          console.log("matchingTxnIndex", creditEntry.transactionDetails[matchingTxnIndex])

          if (matchingTxnIndex !== -1) {
            // Remove the matching credit transaction
            creditEntry.transactionDetails.splice(matchingTxnIndex, 1);
            console.log("creditEntry", creditEntry.transactionDetails[matchingTxnIndex])
            // If no more transactions, remove the entire credit entry
            if (creditEntry.transactionDetails.length === 0) {
              creditUser.credit.splice(i, 1);
            }

            // Save the credit user
            await creditUser.save();
            creditDataDelete = true

            break;
          }

        }
      }
    }
    console.log("debitEntryIndex", debitUser.debit[debitEntryIndex].transactionDetails[transactionIndex])
    // Remove the debit transaction
    if (creditDataDelete) {
      debitUser.debit[debitEntryIndex].transactionDetails.splice(transactionIndex, 1);

      // If no more transactions in this debit entry, remove the entire entry
      if (debitUser.debit[debitEntryIndex].transactionDetails.length === 0) {
        debitUser.debit.splice(debitEntryIndex, 1);
      }

      // Save the debit user
      await debitUser.save();
    }
    return NextResponse.json(
      {
        success: true,
        message: "Transaction deleted successfully",
        deletedTransaction: {
          money,
          reason,
          remarks,
          createdAt
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.log("Error deleting transaction:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}