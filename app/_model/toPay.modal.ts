import mongoose, { Model, model, models, Schema } from "mongoose";
import Users from "./user.model";

// Base schema for common fields
const BaseExpenseSchema = new Schema(
  {
    siteName: { type: String, required: [true, "Site name is required!"] },
    todayWork: { type: String },
    location: { type: Object, required: [true, "Location is required!"] },
    amount: { type: Number, required: [true, "Amount is required!"] },
    serviceProvider: { type: String, default: "" },
    ledgerType: { type: String, default: "" },
    description: { type: String },
    remarks: { type: String },
    tallyEntry: { type: String, default: "" },
    adminMessage: { type: String,default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    locationFiles: { type: [String], default: [] },
    paymentFiles: { type: [String], default: [] },
    invoiceFiles: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Conveyance schema
const ConveyanceSchema = new Schema({
  ...BaseExpenseSchema.obj, // Spread base schema fields
  modeOfTravel: {
    type: String,
    required: [true, "Mode of travel is required!"],
  },
  startingPlace: {
    type: String,
    required: [true, "Starting place is required!"],
  },
  endingPlace: { type: String, required: [true, "Ending place is required!"] },
  driverNumber: { type: Number },
});

// Purchase schema
const PurchaseSchema = new Schema({
  ...BaseExpenseSchema.obj,
  itemName: { type: String, required: [true, "Item name is required!"] },
  quantity: { type: Number, required: [true, "Quantity is required!"] },
  shopName: { type: String, required: [true, "Shop name is required!"] },
  shopNumber: { type: Number },
});

// Food schema
const FoodSchema = new Schema({
  ...BaseExpenseSchema.obj,
  meal: { type: String, required: [true, "Meal type is required!"] },
  numberOfPersons: {
    type: Number,
    required: [true, "Number of persons is required!"],
  },
  restaurantName: {
    type: String,
    required: [true, "Restaurant name is required!"],
  },
  restaurantNumber: { type: Number },
});
// tea schema
const TeaSchema = new Schema({
  ...BaseExpenseSchema.obj,
  meal: { type: String, required: [true, "Meal type is required!"] },
  numberOfPersons: {
    type: Number,
    required: [true, "Number of persons is required!"],
  },
});
// hotel schema
const HotelSchema = new Schema({
  ...BaseExpenseSchema.obj,
  hotelName: { type: String, required: [true, "Hotel Name is required!"] },
  hotelNumber: { type: Number },
  documentNo: { type: String },
  numberOfPersons: {
    type: Number,
    required: [true, "Number of persons is required!"],
  },
  rent: { type: Number, required: [true, "Hotel Rent is required!"] },
  days: { type: Number, required: [true, "Days to stay is required!"] },
  startingDate: { type: Date, required: [true, "Starting Date is required!"] },
  endingDate: { type: Date, required: [true, "Ending Date is required!"] },
});
// labour schema
const LabourSchema = new Schema({
  ...BaseExpenseSchema.obj,
  serviceProvider: {
    type: String,
    required: [true, "Service Provider is required!"],
  },
  documentNo: { type: String },
  labourDetails: [
    {
      type: { type: String },
      numberOfLabour: { type: Number },
      rate: { type: Number },
    },
  ],
  fromDate: { type: Date },
  toDate: { type: Date },
  paymentDate: { type: Date },
});
// Contractor Schema
const ContractorSchema = new Schema({
  ...BaseExpenseSchema.obj,
  serviceProvider: {
    type: String,
    required: [true, "Service Provider is required!"],
  },
  documentNo: { type: String },
  contractorDetails: [
    {
      type: { type: String },
      quantity: { type: Number },
      rate: { type: Number },
    },
  ],
  fromDate: { type: Date },
  toDate: { type: Date },
  paymentDate: { type: Date },
});
// courier schema
const CourierSchema = new Schema({
  ...BaseExpenseSchema.obj,
  customerName: {
    type: String,
    required: [true, "Customer Name is required!"],
  },
  deliveryMode: {
    type: String,
    required: [true, "Delivery Mode is required!"],
  },
  packetType: { type: String, required: [true, "Packet Type is required!"] },
  startingPlace: {
    type: String,
    required: [true, "Starting Place is required!"],
  },
  endingPlace: { type: String, required: [true, "Ending Place is required!"] },
});
// loading schema
const LoadingSchema = new Schema({
  ...BaseExpenseSchema.obj,
  workType: { type: String, required: [true, "Work Type is required!"] },
  material: { type: String, required: [true, "Work Material is required!"] },
  documentNo: { type: String },
  masterLabourName: {
    type: String,
    required: [true, "Master labour name is required!"],
  },
  loadingDetails: [
    {
      type: { type: String },
      quantity: { type: Number },
      rate: { type: Number },
    },
  ],
});

// porter schema
const PorterSchema = new Schema({
  ...BaseExpenseSchema.obj,
  customerName: {
    type: String,
    required: [true, "Customer Name is required!"],
  },
  documentNo: { type: String },
  purpose: { type: String, required: [true, "Purpose is required!"] },
  documentType: {
    type: String,
    required: [true, "Document  Type is required!"],
  },
  vehicleType: {
    type: String,
  },
  startingPlace: {
    type: String,
    required: [true, "Starting Place is required!"],
  },
  distance:{type:String},
  endingPlace: { type: String, required: [true, "Ending Place is required!"] },
  driverNumber: { type: Number },
});
// rider schema
const RiderSchema = new Schema({
  ...BaseExpenseSchema.obj,
  customerName: {
    type: String,
    required: [true, "Customer Name is required!"],
  },
  deliveryMode: {
    type: String,
    required: [true, "Delivery Mode is required!"],
  },
  startingPlace: {
    type: String,
    required: [true, "Starting Place is required!"],
  },
  endingPlace: { type: String, required: [true, "Ending Place is required!"] },
});
// maintenance schema
const MaintenanceSchema = new Schema({
  ...BaseExpenseSchema.obj,
  jobName: { type: String, required: [true, "Job Name is required!"] },
  person: { type: String, required: [true, "Person name is required!"] },
  documentNo: { type: String },
  numberOfPerson: {
    type: Number,
    required: [true, "Number of labour is required!"],
  },
  nameOfItem: { type: String, required: [true, "Item name is required!"] },
  totalLabour: { type: Number, required: [true, "Total Number is required!"] },
});
// other schema
const OtherSchema = new Schema({
  ...BaseExpenseSchema.obj,
  nameOfPerson: { type: String, required: [true, "Person Name is required!"] },
  contactNumber: { type: Number },
  documentNo: { type: String },
});

// Define the OfficeExpense schema
const ToPayExpenseSchema = new Schema(
  {
    date: { type: String, required: [true, "Date is required!"] },
    conveyance: { type: [ConveyanceSchema], default: [] },
    purchase: { type: [PurchaseSchema], default: [] },
    food: { type: [FoodSchema], default: [] },
    tea: { type: [TeaSchema], default: [] },
    hotel: { type: [HotelSchema], default: [] },
    labour: { type: [LabourSchema], default: [] },
    contractor: { type: [ContractorSchema], default: [] },
    courier: { type: [CourierSchema], default: [] },
    loading: { type: [LoadingSchema], default: [] },
    porter: { type: [PorterSchema], default: [] },
    cartage: { type: [PorterSchema], default: [] },
    rider: { type: [RiderSchema], default: [] },
    dailyWages: { type: [LabourSchema], default: [] },
    transport: { type: [PorterSchema], default: [] },
    maintenance: { type: [MaintenanceSchema], default: [] },
    other: { type: [OtherSchema], default: [] },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: [true, "Created by user is required!"],
    },
  },
  { timestamps: true }
);

// Create the Expense model
const ToPayExpense =
  models.ToPayExpense || model("ToPayExpense", ToPayExpenseSchema);

export default ToPayExpense;
