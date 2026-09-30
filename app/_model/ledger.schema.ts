import mongoose, { Schema, model, models, Model } from "mongoose";

// Address Schema
const addressSchema = new Schema(
  {
    addressLine1: {
      type: String,
      default: "",
    },
    addressLine2: {
      type: String,
      default: "",
    },
    addressLine3: {
      type: String,
      default: "",
    },
    addressLine4: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    pincode: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

// Contact Details Schema
const contactDetailsSchema = new Schema(
  {
    contactPerson: {
      type: String,
      default: "",
    },
    phoneNo: {
      type: String,
      default: "",
    },
    mobileNo: {
      type: String,
      default: "",
    },
    faxNo: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    emailCC: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

// Tax Details Schema
const taxDetailsSchema = new Schema(
  {
    panNo: {
      type: String,
      default: "",
    },
    gstin: {
      type: String,
      default: "",
    },
    gstRegType: {
      type: String,
      default: "",
    },
    gstApplicationFrom: {
      type: String,
      default: "",
    },
    serviceTaxNo: {
      type: String,
      default: "",
    },
    vatTinNo: {
      type: String,
      default: "",
    },
    cstNo: {
      type: String,
      default: "",
    },
    vatRegType: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

// Opening Balance Schema
const openingBalanceSchema = new Schema(
  {
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    drCr: {
      type: String,
      enum: ["Dr", "Cr", ""],
      default: "",
    },
    billName: {
      type: String,
      default: "",
    },
    billDate: {
      type: Date,
    },
  },
  { _id: false }
);

// Ledger Schema
const ledgerSchema = new Schema(
  {
    ledgerName: {
      type: String,
      required: [true, "Ledger Name is required!"],
      unique: [true, "Ledger Name already exists!"],
      trim: true,
    },
    aliases: {
      alias1: {
        type: String,
        default: "",
      },
      alias2: {
        type: String,
        default: "",
      },
      alias3: {
        type: String,
        default: "",
      },
      alias4: {
        type: String,
        default: "",
      },
    },
    groupName: {
      type: String,
      required: [true, "Group Name is required!"]
    },
    creditPeriod: {
      type: Number,
      default: 0,
      min: 0,
    },
    address: addressSchema,
    contactDetails: contactDetailsSchema,
    taxDetails: taxDetailsSchema,
    openingBalance: openingBalanceSchema,
    currentBalance: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tallyIntegration: {
      type: Boolean,
      default: false,
    },
    tallyIntegrationDate: {
      type: Date,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: [true, "User ID is required!"],
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
ledgerSchema.index({ ledgerName: 1, userId: 1 });
ledgerSchema.index({ groupName: 1 });

// Export the Ledger model
const Ledger: Model<typeof ledgerSchema> =
  models.Ledger || model("Ledger", ledgerSchema);

export default Ledger;