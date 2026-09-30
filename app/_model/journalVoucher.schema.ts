import mongoose, { Schema, model, models, Model } from "mongoose";

// Voucher Entry Schema with description/remarks fields
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
    // New fields
    description: {
      type: String,
      trim: true,
      default: "",
      // Only required for Debit entries in business logic validation
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
      // Only required for Credit entries in business logic validation
    },
  },
  { _id: false }
);

// Journal Voucher Schema (unchanged structure)
const journalVoucherSchema = new Schema(
  {
    voucherNumber: {
      type: String,
      required: [true, "Voucher Number is required!"],
      trim: true,
      unique: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required!"],
      default: Date.now,
    },
    voucherType: {
      type: String,
      default: "Journal",
      enum: ["Journal"],
    },
    entries: {
      type: [voucherEntrySchema],
      required: [true, "At least 2 entries are required!"],
      validate: {
        validator: function (entries: any[]) {
          return entries.length >= 2;
        },
        message: "A journal voucher must have at least 2 entries (Dr and Cr)",
      },
    },
    narration: {
      type: String,
      required: [true, "Narration is required!"],
      trim: true,
    },
    totalAmount: {
      type: Number,
      required: [true, "Total Amount is required!"],
      min: 0,
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
      enum: ["Draft", "Posted", "Cancelled", "Voucher created"],
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

// Enhanced pre-save middleware with description/remarks validation
journalVoucherSchema.pre("save", function (next) {
  const totalDebit = this.entries
    .filter((entry: any) => entry.debitCredit === "Dr")
    .reduce((sum: number, entry: any) => sum + entry.amount, 0);
  
  const totalCredit = this.entries
    .filter((entry: any) => entry.debitCredit === "Cr")
    .reduce((sum: number, entry: any) => sum + entry.amount, 0);

  // Validate balance
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return next(
      new Error("Journal voucher is not balanced. Debit must equal Credit.")
    );
  }

  // Business logic validation: description for Dr, remarks for Cr
  for (const entry of this.entries) {
    if (entry.debitCredit === "Dr" && (!entry.description || !entry.description.trim())) {
      return next(new Error(`Description is required for debit entry: ${entry.ledgerName}`));
    }
    if (entry.debitCredit === "Cr" && (!entry.remarks || !entry.remarks.trim())) {
      return next(new Error(`Remarks is required for credit entry: ${entry.ledgerName}`));
    }
  }

  this.isBalanced = true;
  this.totalAmount = totalDebit; // or totalCredit (they're equal)
  next();
});

// Indexes
journalVoucherSchema.index({ voucherNumber: 1, userId: 1 });
journalVoucherSchema.index({ date: -1 });
journalVoucherSchema.index({ status: 1 });

const JournalVoucher: Model<any> =
  models.JournalVoucher || model("JournalVoucher", journalVoucherSchema);
export default JournalVoucher;