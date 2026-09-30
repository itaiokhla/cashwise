export const maxDuration = 60;
import DB from "@app/_database/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { toast } from "react-toastify";
import hash from "bcrypt";
import Users from "@app/_model/user.model";
import ImageKit from "imagekit";
import axios from "axios";
import { messageAlert } from "@app/_helpers/messageAlert";
import { creditMessageAlert } from "@app/_helpers/credit.mesageAlert";
import { createPaymentVoucher } from "@services/paymentVoucher.service";
import { createJournalVoucher } from "@services/journalVoucher.service";
import mongoose from "mongoose";
import DataWithDate from "@app/_model/datawithdate.modal";

// Initialize database connection
(async function initializeDB() {
  await DB();
})();

// image upload function
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY as string,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT as string,
});

const uploadToImageKit = async (file: any, folder: string) => {
  try {
    const response = await imagekit.upload({
      file,
      fileName: `${folder}-${Date.now()}`,
      folder: `/api/expenses/${folder}`,
    });
    return response.url;
  } catch (err: any) {
    console.error("ImageKit upload error:", err.message || err);
    throw new Error("Failed to upload image to ImageKit");
  }
};

const mapExpenses = async (file: any, folder: string) => {
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadToImageKit(fileBuffer, folder);
  return url;
};

export async function PUT(req: NextRequest) {
  try {
    const formData = await req.formData();
    const toName = formData.get("toName") as string;
    const fromName = formData.get("fromName") as string;
    const toEmail = (formData.get("toEmail") as string) || "";
    const fromEmail = (formData.get("fromEmail") as string) || "";
    const toPhone = formData.get("toPhone") as string | null;
    const fromPhone = formData.get("fromPhone") as string | null;
    const amount = parseFloat(formData.get("amount") as string);
    const reason = formData.get("reason") as string;
    const remarks = formData.get("remarks") as string;
    const description = formData.get("description") as string;
    const files = formData.getAll("files"); // Get all files
    const transactionId = formData.get("transactionId") as string;
    const filesUrl: string[] = [];

    // Upload files if any
    if (files.length > 0) {
      for (const file of files) {
        const url = await mapExpenses(file, "transaction");
        filesUrl.push(url);
      }
    }

    const creditUser: any = await Users.findOne({ phone: toPhone });
    const debitUser: any = await Users.findOne({ phone: fromPhone });

    if (!creditUser || !debitUser) {
      return NextResponse.json(
        { type: "BAD_REQUEST", message: "User not found!" },
        { status: 404 }
      );
    }

    const transactionDetails = {
      transactionId: transactionId ? transactionId : new mongoose.Types.ObjectId().toString(),
      tallyEntry: "Not Synced",

      money: amount,
      reason,
      remarks,
      imageUrl: filesUrl,
    };
    let var1 = `₹${amount} by ${fromName}`;
    let var2 = `${toName}'s`;
    let var3 = creditUser?._id;

    if (toPhone === fromPhone) {
      const existingCredit = creditUser.credit.find(
        (entry: any) => entry.phone === fromPhone
      );
      if (toPhone) {
        await creditMessageAlert(
          var1,
          var2,
          var3,
          parseInt(toPhone.toString())
        );
      }
      if (existingCredit) {
        existingCredit.transactionDetails.push(transactionDetails);
      } else {
        creditUser.credit.push({
          name: fromName,
          email: fromEmail,
          phone: fromPhone,
          transactionDetails: [transactionDetails],
        });
      }
      await creditUser.save();

      if (toPhone) {
        await creditMessageAlert(
          var1,
          var2,
          var3,
          parseInt(toPhone.toString())
        );
      }
    } else {
      // Credit user (Receiver)
      const existingCredit = creditUser.credit.find(
        (entry: any) => entry.phone === fromPhone
      );
      if (existingCredit) {
        existingCredit.transactionDetails.push(transactionDetails);
        await creditUser.save();
        if (toPhone) {
          await creditMessageAlert(
            var1,
            var2,
            var3,
            parseInt(toPhone.toString())
          );
        }
      } else {
        creditUser.credit.push({
          name: fromName,
          email: fromEmail,
          phone: fromPhone,
          transactionDetails: [transactionDetails],
        });
        await creditUser.save();
        if (toPhone) {
          await creditMessageAlert(
            var1,
            var2,
            var3,
            parseInt(toPhone.toString())
          );
        }
      }

      // Debit user (Sender)
      const existingDebit = debitUser.debit.find(
        (entry: any) => entry.phone === toPhone
      );
      if (existingDebit) {
        existingDebit.transactionDetails.push(transactionDetails);
        await debitUser.save();
      } else {
        debitUser.debit.push({
          name: toName,
          email: toEmail,
          phone: toPhone,
          transactionDetails: [transactionDetails],
        });
        await debitUser.save();
      }
    }

    // 🆕 CREATE VOUCHER - CONDITIONAL BASED ON DEBIT USER ID
    let voucherResult = null;
    try {
      const narration = `Transaction - ${reason || "Payment"} ${remarks ? `(${remarks})` : ""}`.trim();
      const voucherDate = new Date();

      // 🔥 FIXED: Safe string conversion + added required params
      if (debitUser._id.toString() === "67e525f3b5239a00bf276fd3") {
        voucherResult = await createPaymentVoucher({
          ledgerType: String(formData.get("ledgerType") || "ICICI Bank C. S. Sir"),
          expenseType: String(formData.get("expenseType") || "Transaction"),
          userName: toName,
          userId: debitUser._id.toString(),
          amount,
          narration,
          date: voucherDate,
          cashBankName: String(formData.get("cashBankName") || "Cash"),
          cashBankGroupName: String(formData.get("cashBankGroupName") || "Bank Accounts"),
          instrumentType: String(formData.get("instrumentType") || "Cash"),
          instrumentNumber: formData.get("instrumentNumber") ? String(formData.get("instrumentNumber")) : undefined,
          instrumentDate: formData.get("instrumentDate") ? new Date(String(formData.get("instrumentDate"))) : undefined,
          recoDate: formData.get("recoDate") ? new Date(String(formData.get("recoDate"))) : undefined,
          billName: formData.get("billName") ? String(formData.get("billName")) : undefined,
          costCenter: formData.get("costCenter") ? String(formData.get("costCenter")) : undefined,
          // ✅ ADDED REQUIRED PARAMETERS (fixes schema validation)
          description: String(description || `Transaction to ${toName}`),
          remarks: `${String(formData.get("instrumentType") || "Cash")} payment: ${String(remarks || reason || "Transaction")}`,
        });
      } else {
        voucherResult = await createJournalVoucher({
          ledgerType: String(formData.get("ledgerType") || "Sundry Creditors"),
          expenseType: String(formData.get("expenseType") || "Transaction"),
          userName: toName,
          userId: debitUser._id.toString(),
          amount,
          narration,
          date: voucherDate,
          // ✅ ADDED REQUIRED PARAMETERS (fixes schema validation)
          description: String(description || "Transaction expense"),
          remarks: String(remarks || `Payment for transaction: ${reason || "Transaction"}`),
        });
      }

      if (voucherResult?.success) {
        console.log("✅ Voucher created:", voucherResult.message);
      } else {
        console.error("⚠️ Voucher creation failed:", voucherResult?.message);
      }
    } catch (voucherError: any) {
      console.error("⚠️ Failed to create voucher:", voucherError.message);
      // Don't fail the entire transaction if voucher creation fails
    }
    return NextResponse.json(
      { type: "SUCCESS", message: "Transaction completed successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { type: "BAD_REQUEST", message: "Something went wrong!" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "";
  const name = searchParams.get("name") || "";

  try {
    const dateResult = await DataWithDate
      .findOne({})
      .sort({ createdAt: -1 });
    const matchCriteria: any = {};
    console.log(dateResult)
    if (type) matchCriteria.type = type;
    if (name) matchCriteria.name = { $regex: name.trim(), $options: "i" };

    const dateFilter: any = {};

    if (dateResult?.fromDate) {
      dateFilter.$gte = new Date(dateResult.fromDate);
    }

    if (dateResult?.toDate) {
      const end = new Date(dateResult.toDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const pipeline: any[] = [
      { $match: matchCriteria },

      // 🔹 Filter DEBIT transactions only
      {
        $addFields: {
          debit: {
            $map: {
              input: "$debit",
              as: "d",
              in: {
                $mergeObjects: [
                  "$$d",
                  {
                    transactionDetails: {
                      $filter: {
                        input: "$$d.transactionDetails",
                        as: "t",
                        cond: Object.keys(dateFilter).length
                          ? {
                            $and: [
                              dateFilter.$gte
                                ? { $gte: ["$$t.createdAt", dateFilter.$gte] }
                                : true,
                              dateFilter.$lte
                                ? { $lte: ["$$t.createdAt", dateFilter.$lte] }
                                : true,
                            ],
                          }
                          : true,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },

      // 🔹 Filter CREDIT transactions only
      {
        $addFields: {
          credit: {
            $map: {
              input: "$credit",
              as: "c",
              in: {
                $mergeObjects: [
                  "$$c",
                  {
                    transactionDetails: {
                      $filter: {
                        input: "$$c.transactionDetails",
                        as: "t",
                        cond: Object.keys(dateFilter).length
                          ? {
                            $and: [
                              dateFilter.$gte
                                ? { $gte: ["$$t.createdAt", dateFilter.$gte] }
                                : true,
                              dateFilter.$lte
                                ? { $lte: ["$$t.createdAt", dateFilter.$lte] }
                                : true,
                            ],
                          }
                          : true,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ];

    const result = await Users.aggregate(pipeline);

    return NextResponse.json(
      { type: "SUCCESS", result },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { type: "BAD_REQUEST", message: "Something went wrong!" },
      { status: 500 }
    );
  }
}
