// services/journalVoucher.service.ts
import mongoose from "mongoose";
import JournalVoucher from "@app/_model/journalVoucher.schema";
import Ledger from "@app/_model/ledger.schema";

// Helper function to generate unique voucher number
async function generateVoucherNumber(userId: string) {
  const count = await JournalVoucher.countDocuments({ userId });
  return `JV-${String(count + 1).padStart(4, "0")}`;
}

// Helper function to find or create ledger
async function findOrCreateLedger(
  ledgerName: string,
  groupName: string,
  userId: string
) {
  let ledger = await Ledger.findOne({
    ledgerName,
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
  });

  if (!ledger) {
    ledger = await Ledger.create({
      ledgerName,
      groupName,
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true,
      tallyIntegration: false,
    });
    console.log(`✅ Created new ledger: ${ledgerName}`);
  }

  return ledger;
}

// Main service function to create journal voucher
export async function createJournalVoucherFromExpense(params: {
  userId: string;
  amount: number;
  narration: string;
  date: Date;
  debitLedger: {
    name: string;
    groupName: string;
    description: string; // Added
  };
  creditLedger: {
    name: string;
    groupName: string;
    remarks: string; // Added
  };
  expenseType?: string;
}) {
  const {
    userId,
    amount,
    narration,
    date,
    debitLedger,
    creditLedger,
    expenseType,
  } = params;

  try {
    console.log("ledger", debitLedger, creditLedger)
    // Find or create debit ledger
    const debitLedgerDoc: any = await findOrCreateLedger(
      debitLedger.name,
      debitLedger.groupName,
      userId
    );

    // Find or create credit ledger
    const creditLedgerDoc: any = await findOrCreateLedger(
      creditLedger.name,
      creditLedger.groupName,
      userId
    );

    // Generate unique voucher number
    const voucherNumber = await generateVoucherNumber(userId);

    // Create journal voucher with balanced entries
    // ✅ Added description for Dr and remarks for Cr as per schema validation
    const journalVoucher = new JournalVoucher({
      voucherNumber,
      date,
      voucherType: "Journal",
      entries: [
        {
          ledgerName: debitLedgerDoc.ledgerName,
          ledgerId: debitLedgerDoc._id,
          debitCredit: "Dr",
          amount,
          description: debitLedger.description || `${expenseType || "Expense"} recorded`, // Required for Dr
          remarks: "", // Not required for Dr
        },
        {
          ledgerName: creditLedgerDoc.ledgerName,
          ledgerId: creditLedgerDoc._id,
          debitCredit: "Cr",
          amount,
          description: "", // Not required for Cr
          remarks: creditLedger.remarks || `Payment for ${expenseType || "expense"}`, // Required for Cr
        },
      ],
      narration: narration || `${expenseType} expense payment`,
      totalAmount: amount,
      isBalanced: true,
      userId: new mongoose.Types.ObjectId(userId),
      status: "Posted",
      tallyIntegration: false,
    });

    const savedVoucher: any = await journalVoucher.save();
    console.log("✅ Journal voucher created:", savedVoucher.voucherNumber);

    return {
      success: true,
      voucher: savedVoucher,
      message: `Journal voucher ${savedVoucher.voucherNumber} created successfully`,
    };
  } catch (error: any) {
    console.error("❌ Error creating journal voucher:", error.message);
    return {
      success: false,
      error: error.message,
      message: "Failed to create journal voucher",
    };
  }
}

// Generic function to create journal voucher with flexible parameters
export async function createJournalVoucher(params: {
  ledgerType: string;
  expenseType: string;
  userName: string;
  userId: string;
  amount: number;
  narration: string;
  date: Date;
  description?: string; // Added
  remarks?: string; // Added
}) {
  const {
    ledgerType,
    expenseType,
    userName,
    userId,
    amount,
    narration,
    date,
    description,
    remarks,
  } = params;
  const ledger: any = await Ledger.find({ ledgerName: ledgerType })
  if (!ledger) {
    return
  }
  return createJournalVoucherFromExpense({
    userId,
    amount,
    narration,
    date,
    debitLedger: {
      name: expenseType,
      groupName: "Indirect Expenses",
      description: description || `${expenseType} expense`, // Pass description
    },
    creditLedger: {
      name: userName,
      groupName: ledgerType || "Sundry Creditors",
      remarks: remarks || `Payment to ${userName}`, // Pass remarks
    },
    expenseType,
  });
}