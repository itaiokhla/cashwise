import mongoose, { Schema, model, models, Model } from "mongoose";

// Transaction Details Schema
const transactionDetailsSchema = new Schema(
  {
   transactionId: {
      type: String,
      required: true,
      default: () => new mongoose.Types.ObjectId().toString(),
      index: true,
    },
    tallyEntry: {
      type: String,
      default: "",
    },
    money: {
      type: Number,
      required: [true, "Money is required!"], // Optional: Add required validation
      min: 0, // Optional: Ensure money is a positive number
    },
    reason: {
      type: String,
    },
    remarks: {
      type: String,
    },
    imageUrl: {
      type: [String],
      default: [], // Optional: Default to an empty array
    },
  },
  { timestamps: true }
);

// Credit Schema
const creditSchema = new Schema(
  {
    
    name: {
      type: String,
      required: [true, "Name is required!"],
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
      required: [true, "Phone is required!"],
    },
    transactionDetails: [transactionDetailsSchema],
  },
  { timestamps: true }
);

// Users Schema
const usersSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required!"],
    },
    email: {
      type: String,
    },
    password: {
      type: String,
    },
    role: {
      type: String,
      enum: ["admin", "employee", "toPay","manager"],
      default: "employee",
      required: [true, "Role is required!"],
    },
    phone: {
      type: Number,
      required: [true, "Phone is required!"],
      unique: [true, "Phone already exist!"],
    },
    type: {
      type: String,
      required: [true, "User Type is required!"],
    },
    otp: {
      type: Number,
      required: false,
    },
    otpExpiration: {
      type: Date,
      required: false,
    },
    credit: [creditSchema],
    debit: [creditSchema],
    expense: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: ["TravelExpense", "OfficeExpense","ToPayExpense"],
      },
    ],
  },
  { timestamps: true }
);

// Export the Users model
const Users: Model<typeof usersSchema> =
  models.Users || model("Users", usersSchema);

export default Users;
