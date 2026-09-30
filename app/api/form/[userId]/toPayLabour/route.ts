"use server";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb"; // or from 'mongoose' if you're using Mongoose
import DB from "@app/_database/db";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import ToPayExpense from "@app/_model/toPay.modal";
import { expenseMessageAlert } from "@app/_helpers/expense.messageAlert";
import Users from "@app/_model/user.model";
import { createJournalVoucher } from "@services/journalVoucher.service";
import { createPaymentVoucher } from "@services/paymentVoucher.service";
import { validateExpenseAttachments } from "@app/_lib/validateExpenseAttachment";

// Initialize database connection
(async function initializeDB() {
  await DB();
})();


export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> } // 🔥 Changed to Promise
) {
  try {
    const body = await req.formData();
    const { userId } = await params; // 🔥 Await params here
    
    if (!userId) {
      return NextResponse.json(
        { message: "Please log in to submit the form!" },
        { status: 401 }
      );
    }
    if (!body) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "No data available!" },
        { status: 400 }
      );
    }

    // ── Validate mandatory attachment requirement ────────────────────────
    const attachmentCheck = validateExpenseAttachments(body);
    if (!attachmentCheck.valid) {
      return NextResponse.json(
        {
          type: "VALIDATION_ERROR",
          message: attachmentCheck.message,
        },
        { status: 400 }
      );
    }

    // form due date indian date formate
    const fromDateValue = body.get("fromDate") as string | null;
    const toDateValue = body.get("toDate") as string | null;
    const paymentDateValue = body.get("paymentDate") as string | null;
    if (!fromDateValue || !toDateValue || !paymentDateValue) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "Date is missing or invalid" },
        { status: 400 }
      );
    }
    const fromDate = new Date(
      DateTime.fromISO(fromDateValue).setZone("Asia/Kolkata").toISO()!
    );
    const toDate = new Date(
      DateTime.fromISO(toDateValue).setZone("Asia/Kolkata").toISO()!
    );
    const paymentDate = new Date(
      DateTime.fromISO(paymentDateValue).setZone("Asia/Kolkata").toISO()!
    );

    const amount = parseFloat(body.get("amount") as string) || 0;
    const today = DateTime.now()
      .setZone("Asia/Kolkata")
      .startOf("day")
      .toISODate();

    const labourData = {
      siteName: body.get("siteName"),
      todayWork: body.get("todayWork"),
      location: body.get("location"),
      ledgerType: body.get("ledgerType"),
      tallyEntry: "Not Synced",

      amount,
      serviceProvider: body.get("serviceProvider"),
      description: body.get("description"),
      remarks: body.get("remarks"),
      labourDetails: JSON.parse(body.get("labourDetails") as string),
      fromDate,
      toDate,
      paymentDate,
      locationFiles: attachmentCheck.locationFiles,
      paymentFiles: attachmentCheck.paymentFiles,
      invoiceFiles: attachmentCheck.invoiceFiles,
    };

    const result = await ToPayExpense.findOneAndUpdate(
      {
        createdBy: new mongoose.Types.ObjectId(userId),
        date: today,
      },
      { $push: { labour: labourData } },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    // expense message alert

    const user: any = await Users.findById(new mongoose.Types.ObjectId(userId));
    if (!user) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "User not found,Login account!" },
        { status: 404 }
      );
    }
    if (!user.expense.includes(result._id)) {
      user.expense.push(result._id);
      await user.save();
    }
    const transactionDetails = {
      money: amount,
      reason: "To Pay Labour Expense",
      imageUrl: [],
    };

    const existingDebit = user?.debit.find(
      (entry: any) => entry.phone === user?.phone
    );
    if (existingDebit) {
      existingDebit.transactionDetails.push(transactionDetails);
    } else {
      user.debit.push({
        name: user?.name,
        phone: user?.phone,
        transactionDetails: [transactionDetails],
      });
    }
    await user.save();
     // 🆕 CREATE  VOUCHER USING SERVICE
                  let voucherResult:any = null;
try {
  const narration = `ToPay Labour expense - ${
    labourData.description || "Payment"
  } ${labourData.siteName ? `at ${labourData.siteName}` : ""}`.trim();
  const voucherDate = new Date(today || new Date());

  // 🔥 CONDITIONAL: Payment Voucher for specific user, Journal Voucher for others
  if (userId.toString() === "67e525f3b5239a00bf276fd3") {
    voucherResult = await createPaymentVoucher({
      ledgerType: String(body.get("ledgerType")),
      expenseType: "ToPayLabour",
      userName: user.name,
      userId,
      amount,
      narration,
      date: voucherDate,
      
      // Payment-specific fields
      cashBankName: String(body.get("cashBankName") || "Cash"),
      cashBankGroupName: String(body.get("cashBankGroupName") || "Cash-in-Hand"),
      instrumentType: String(body.get("instrumentType") || "Cash"),
      instrumentNumber: String(body.get("instrumentNumber") || ""),
      instrumentDate: body.get("instrumentDate") ? new Date(String(body.get("instrumentDate"))) : undefined,
      recoDate: body.get("recoDate") ? new Date(String(body.get("recoDate"))) : undefined,
      billName: String(body.get("billName") || ""),
      costCenter: String(body.get("costCenter") || ""),
      
      // 🔥 Fixed: Convert FormDataEntryValue to string properly
      description: String(body.get("description") || `Topay labour expense payment to ${user.name}`),
      remarks: String(body.get("remarks") || `${String(body.get("instrumentType") || "Cash")} payment for labour`),
    });
  } else {
    voucherResult = await createJournalVoucher({
      ledgerType: String(body.get("ledgerType")),
      expenseType: "Labour",
      userName: user.name,
      userId,
      amount,
      narration,
      date: voucherDate,
      
      // 🔥 Fixed: Convert FormDataEntryValue to string properly
      description: String(body.get("description") || `Labour expense`),
      remarks: String(body.get("remarks") || `Payment for labour expense`),
    });
  }

  if (voucherResult.success) {
    console.log("✅", voucherResult.message);
  } else {
    console.error("⚠️", voucherResult.message);
  }
} catch (voucherError: any) {
  console.error(
    "⚠️ Failed to create voucher:",
    voucherError.message
  );
}
    await expenseMessageAlert(user.name, user._id, amount);
    return NextResponse.json(
      { message: "Expense saved successfully", data: result },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error creating expense:", error.message);
    return NextResponse.json(
      { type: "ERROR", message: error.message || "Something went wrong!" },
      { status: 500 }
    );
  }
}
