// models/createdAt.js
import mongoose, { Schema, model, models } from "mongoose";

const DataWithDateSchema = new Schema(
  {
    fromDate: { type: Date },
    toDate: { type: Date },
    
  },
  { timestamps: true }
);

const DataWithDate = models.DataWithDate || model("DataWithDate", DataWithDateSchema);
export default DataWithDate;