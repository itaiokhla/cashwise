import mongoose, { Schema, model, models, Model } from "mongoose";

// Reuse the same entry schema (Dr/Cr lines)
const voucherEntrySchema = new Schema(
  {
    ledgerName: {
      type: String,
      required: [true, "Ledger Name is required!"],
      trim: true,
    },
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
    },
    debitCredit: {
      type: String,
      required: [true, "Debit/Credit is required!"],
      enum: ["Dr", "Cr"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required!"],
      min: [0, "Amount cannot be negative"],
    },

    // Optional: useful for payments (keep if you want)
    billName: { type: String, trim: true, default: null },
    costCenter: { type: String, trim: true, default: null },
    description: { 
      type: String, 
      trim: true, 
      default: "" 
    }, // Required for CREDIT entries
    remarks: { 
      type: String, 
      trim: true, 
      default: "" 
    }, // Required for DEBIT entries
  },
  { _id: false }
);

// Payment Voucher Schema
const paymentVoucherSchema = new Schema(
  {
    voucherNumber: {
      type: String,
      required: [true, "Voucher Number is required!"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required!"],
      default: Date.now,
    },
    voucherType: {
      type: String,
      default: "Payment",
      enum: ["Payment"],
    },

    // Bank/Cash account used for payment (the Credit line should match this)
    cashBankLedgerName: {
      type: String,
      required: [true, "Cash/Bank Ledger is required!"],
      trim: true,
    },
    cashBankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ledger",
      default: null,
    },

    // Instrument details (required by your import template)
    instrumentType: {
      type: String,
      required: [true, "Instrument Type is required!"],
      trim: true,
      // If you have fixed values, enforce them here:
      // enum: ["Cash", "Cheque", "NEFT", "RTGS", "IMPS", "UPI", "Bank Transfer"],
    },
    instrumentNumber: { type: String, trim: true, default: null },
    instrumentDate: { type: Date, default: null },
    recoDate: { type: Date, default: null },

    // Entries contain BOTH debit(s) and the credit (cash/bank) line
    entries: {
      type: [voucherEntrySchema],
      required: [true, "At least 2 entries are required!"],
      validate: {
        validator: function (entries: any[]) {
          return Array.isArray(entries) && entries.length >= 2;
        },
        message: "A payment voucher must have at least 2 entries (Dr and Cr).",
      },
    },

    narration: {
      type: String,
      trim: true,
      default: "",
    },

    totalAmount: {
      type: Number,
      required: [true, "Total Amount is required!"],
      min: 0,
      default: 0,
    },
    isBalanced: {
      type: Boolean,
      default: false,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: [true, "User ID is required!"],
    },

    status: {
      type: String,
      enum: ["Draft", "Posted", "Cancelled"],
      default: "Posted",
    },

    tallyIntegration: {
      type: Boolean,
      default: false,
    },
    tallyIntegrationDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Pre-save middleware: validate balanced + Payment-specific rules
paymentVoucherSchema.pre("save", function (next) {
  const entries: any[] = this.entries || [];

  const totalDebit = entries
    .filter((e) => e.debitCredit === "Dr")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalCredit = entries
    .filter((e) => e.debitCredit === "Cr")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Must have at least one Dr and one Cr
  const hasDr = entries.some((e) => e.debitCredit === "Dr");
  const hasCr = entries.some((e) => e.debitCredit === "Cr");
  if (!hasDr || !hasCr) {
    return next(new Error("Payment voucher must contain at least one Dr and one Cr entry."));
  }

  // Balanced check
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return next(new Error("Payment voucher is not balanced. Debit must equal Credit."));
  }

  // Payment rule: Credit line should be the cash/bank ledger
  const creditLines = entries.filter((e) => e.debitCredit === "Cr");
  // Usually exactly 1 credit line (bank/cash). If you allow multiple, relax this check.
  if (creditLines.length !== 1) {
    return next(new Error("Payment voucher must have exactly one Credit entry (Cash/Bank)."));
  }

  const creditLedgerName = (creditLines[0]?.ledgerName || "").trim();
  if (creditLedgerName !== (this.cashBankLedgerName || "").trim()) {
    return next(
      new Error("Credit entry ledgerName must match cashBankLedgerName (Cash/Bank account).")
    );
  }
 for (const entry of this.entries) {
    if (entry.debitCredit === "Dr" && (!entry.description || !entry.description.trim())) {
      return next(new Error(`Description is required for credit entry: ${entry.ledgerName}`));
    }
    if (entry.debitCredit === "Cr" && (!entry.remarks || !entry.remarks.trim())) {
      return next(new Error(`Remarks is required for debit entry: ${entry.ledgerName}`));
    }
  }
  
  // Mark balanced + total
  this.isBalanced = true;
  this.totalAmount = totalDebit;

  next();
});

// Indexes
paymentVoucherSchema.index({ voucherNumber: 1, userId: 1 });
paymentVoucherSchema.index({ date: -1 });
paymentVoucherSchema.index({ status: 1 });
paymentVoucherSchema.index({ cashBankLedgerName: 1 });

// Export model
const PaymentVoucher: Model<any> =
  models.PaymentVoucher || model("PaymentVoucher", paymentVoucherSchema);

export default PaymentVoucher;
