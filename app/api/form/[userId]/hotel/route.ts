"use server";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb"; // or from 'mongoose' if you're using Mongoose
import DB from "@app/_database/db";
import OfficeExpense from "@app/_model/office.modal";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import TravelExpense from "@app/_model/travel.modal";
import ToPayExpense from "@app/_model/toPay.modal";
import { expenseMessageAlert } from "@app/_helpers/expense.messageAlert";
import Users from "@app/_model/user.model";
import { createJournalVoucher } from "@services/journalVoucher.service";
import { createPaymentVoucher } from "@services/paymentVoucher.service";
import { validateExpenseLimit } from "@app/_lib/validateExpenseLimit.server";
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

    const amount = parseFloat(body.get("amount") as string) || 0;
    const today = DateTime.now()
      .setZone("Asia/Kolkata")
      .startOf("day")
      .toISODate();

    // form starting date indian date formate
    const startingDateValue = body.get("startingDate") as string | null;
    if (!startingDateValue) {
      throw new Error("Starting date is missing or invalid");
    }
    const startingDate = new Date(
      DateTime.fromISO(startingDateValue).setZone("Asia/Kolkata").toISO()!
    );

    // form ending date indian date formate
    const endingDateValue = body.get("endingDate") as string | null;
    if (!endingDateValue) {
      throw new Error("Ending date is missing or invalid");
    }
    const endingDate = new Date(
      DateTime.fromISO(endingDateValue).setZone("Asia/Kolkata").toISO()!
    );

   const schemaName = body.get("schema") as string;
   
       // ── 1. Validate against expense limit ─────────────────────────────────
       const limitCheck = await validateExpenseLimit(userId, schemaName, "hotel", amount);
   
       if (!limitCheck.valid &&  body.get('expenselimitVerified')==='false') {
         return NextResponse.json(
           {
             type: "LIMIT_EXCEEDED",
             message: "Expense exceeds your allowed limits",
             errors: limitCheck.errors,
             breakdown: limitCheck.breakdown,
             total: limitCheck.totalBreakdown,
           },
           { status: 400 }
         );
       }

    // data object
    const hotelData = {
      siteName: body.get("siteName"),
      todayWork: body.get("todayWork"),
      location: body.get("location"),
      ledgerType: body.get("ledgerType"),
      tallyEntry: "Not Synced",
      amount,
      serviceProvider: body.get("serviceProvider") || "",
      hotelName: body.get("hotelName"),
      hotelNumber: body.get("hotelNumber"),
      numberOfPersons: body.get("numberOfPerson"),
      rent: body.get("rent"),
      days: body.get("days"),
      startingDate,
      endingDate,
      description: body.get("description"),
      remarks: body.get("remarks"),
      documentNO: body.get("documentNO"),
      locationFiles: attachmentCheck.locationFiles,
      paymentFiles: attachmentCheck.paymentFiles,
      invoiceFiles: attachmentCheck.invoiceFiles,
    };

    let result: any;
    if (schemaName === "/officeExpense") {
      result = await OfficeExpense.findOneAndUpdate(
        {
          createdBy: new mongoose.Types.ObjectId(userId),
          date: today,
        },
        { $push: { hotel: hotelData } },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
    } else if (schemaName === "/travelExpense") {
      result = await TravelExpense.findOneAndUpdate(
        {
          createdBy: new mongoose.Types.ObjectId(userId),
          date: today,
        },
        { $push: { hotel: hotelData } },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
    } else if (schemaName === "/toPayExpense") {
      result = await ToPayExpense.findOneAndUpdate(
        {
          createdBy: new mongoose.Types.ObjectId(userId),
          date: today,
        },
        { $push: { hotel: hotelData } },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
    }
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
      reason: "Hotel Expense",
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
  const narration = `Hotel expense - ${
    hotelData.description || "Payment"
  } ${hotelData.siteName ? `at ${hotelData.siteName}` : ""}`.trim();
  const voucherDate = new Date(today || new Date());

  // 🔥 CONDITIONAL: Payment Voucher for specific user, Journal Voucher for others
  if (userId.toString() === "67e525f3b5239a00bf276fd3") {
    voucherResult = await createPaymentVoucher({
      ledgerType: String(body.get("ledgerType")),
      expenseType: "Hotel",
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
      description: String(body.get("description") || `Hotel expense payment to ${user.name}`),
      remarks: String(body.get("remarks") || `${String(body.get("instrumentType") || "Cash")} payment for hotel`),
    });
  } else {
    voucherResult = await createJournalVoucher({
      ledgerType: String(body.get("ledgerType")),
      expenseType: "Hotel",
      userName: user.name,
      userId,
      amount,
      narration,
      date: voucherDate,
      
      // 🔥 Fixed: Convert FormDataEntryValue to string properly
      description: String(body.get("description") || `Hotel expense`),
      remarks: String(body.get("remarks") || `Payment for hotel expense`),
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
