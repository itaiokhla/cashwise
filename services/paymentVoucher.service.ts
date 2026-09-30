// services/paymentVoucher.service.ts
import mongoose from "mongoose";
import PaymentVoucher from "@app/_model/paymentVoucher.schema";
import Ledger from "@app/_model/ledger.schema";

// Helper function to generate unique voucher number
async function generateVoucherNumber(userId: string) {
  const count = await PaymentVoucher.countDocuments({ userId });
  return `PV-${String(count + 1).padStart(4, "0")}`;
}

// Helper function to find or create ledger
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

// ✅ Create Payment Voucher (balanced: Dr party, Cr cash/bank)
export async function createPaymentVoucherFromExpense(params: {
  userId: string;
  amount: number;
  narration: string;
  date: Date;
  // Party you paid to (Debit)
  debitLedger: {
    name: string;
    groupName: string;
    description: string; // Added - required for Dr entries
  };
  // Cash/Bank account used (Credit)
  cashBankLedger: {
    name: string;
    groupName: string; // e.g. "Bank Accounts" / "Cash-in-Hand"
  };
  instrumentType: string; // required (Bank Transfer / Cheque / Cash / UPI etc.)
  instrumentNumber?: string;
  instrumentDate?: Date;
  recoDate?: Date;
  billName?: string;
  costCenter?: string;
  expenseType?: string;
  remarks?: string; // Added - required for Cr entries
}) {
  const {
    userId,
    amount,
    narration,
    date,
    debitLedger,
    cashBankLedger,
    instrumentType,
    instrumentNumber,
    instrumentDate,
    recoDate,
    billName,
    costCenter,
    expenseType,
    remarks,
  } = params;

  try {
    // Find or create Party (Debit) ledger
    const debitLedgerDoc: any = await findOrCreateLedger(
      debitLedger.name,
      debitLedger.groupName,
      userId
    );

    // Find or create Cash/Bank (Credit) ledger
    const cashBankLedgerDoc: any = await findOrCreateLedger(
      cashBankLedger.name,
      cashBankLedger.groupName,
      userId
    );

    // Generate unique voucher number
    const voucherNumber = await generateVoucherNumber(userId);

    // Create payment voucher with balanced entries
    // ✅ Added description for Dr and remarks for Cr as per schema validation
    const paymentVoucher = new PaymentVoucher({
      voucherNumber,
      date,
      voucherType: "Payment",
      // payment specific fields
      cashBankLedgerName: cashBankLedgerDoc.ledgerName,
      cashBankLedgerId: cashBankLedgerDoc._id,
      instrumentType: instrumentType,
      instrumentNumber: instrumentNumber ? String(instrumentNumber) : null,
      instrumentDate: instrumentDate || null,
      recoDate: recoDate || null,
      // optional metadata
      narration: narration || `${expenseType || "Expense"} payment`,
      totalAmount: amount,
      isBalanced: true,
      // entries: Dr = party, Cr = cash/bank
      // ✅ Payment rule: exactly one Cr entry (cash/bank) with remarks
      entries: [
        {
          ledgerName: debitLedgerDoc.ledgerName,
          ledgerId: debitLedgerDoc._id,
          debitCredit: "Dr",
          amount,
          billName: billName || null,
          costCenter: costCenter || null,
          description: debitLedger.description || `${expenseType || "Payment"} to ${debitLedger.name}`, // Required for Dr
          remarks: "", // Not required for Dr
        },
        {
          ledgerName: cashBankLedgerDoc.ledgerName,
          ledgerId: cashBankLedgerDoc._id,
          debitCredit: "Cr",
          amount,
          billName: null,
          costCenter: null,
          description: "", // Not required for Cr
          remarks: remarks || `${instrumentType} payment from ${cashBankLedger.name}`, // Required for Cr
        },
      ],
      userId: new mongoose.Types.ObjectId(userId),
      status: "Posted",
      tallyIntegration: false,
    });

    const savedVoucher: any = await paymentVoucher.save();
    console.log("✅ Payment voucher created:", savedVoucher.voucherNumber);

    return {
      success: true,
      voucher: savedVoucher,
      message: `Payment voucher ${savedVoucher.voucherNumber} created successfully`,
    };
  } catch (error: any) {
    console.error("❌ Error creating payment voucher:", error.message);
    return {
      success: false,
      error: error.message,
      message: "Failed to create payment voucher",
    };
  }
}

// ✅ Generic function (similar style to your createJournalVoucher)
export async function createPaymentVoucher(params: {
  ledgerType: string; // party groupName like "Sundry Creditors"
  expenseType: string; // party ledger name OR expense name
  userName: string; // party name (paid to)
  userId: string;
  amount: number;
  narration: string;
  date: Date;
  cashBankName: string; // e.g. "ICICI Bank"
  cashBankGroupName?: string; // e.g. "Bank Accounts"
  instrumentType: string;
  instrumentNumber?: string;
  instrumentDate?: Date;
  recoDate?: Date;
  billName?: string;
  costCenter?: string;
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
    cashBankName,
    cashBankGroupName,
    instrumentType,
    instrumentNumber,
    instrumentDate,
    recoDate,
    billName,
    costCenter,
    description,
    remarks,
  } = params;
  // const ledger:any=await Ledger.find({ledgerName:ledgerType})

  return createPaymentVoucherFromExpense({
    userId,
    amount,
    narration,
    date,
    // Debit = Party (Paid To)
    debitLedger: {
      name: userName,
      groupName: ledgerType || "Sundry Creditors",
      description: description || `${expenseType || "Expense"} payment to ${userName}`, // Pass description
    },
    // Credit = Bank/Cash account
    cashBankLedger: {
      name: cashBankName,
      groupName: cashBankGroupName || "Bank Accounts",
    },
    instrumentType,
    instrumentNumber,
    instrumentDate,
    recoDate,
    billName,
    costCenter,
    expenseType,
    remarks: remarks || `${instrumentType} payment`, // Pass remarks
  });
}