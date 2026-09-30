// models/ExpenseLimit.js
import mongoose, { Schema, model, models } from "mongoose";

const GroupSchema = new Schema(
  {
    name:{type:String},
    members:[{user: { type: Schema.Types.ObjectId, ref: "Users"},role:{type:String}}],
    createdBy: { type: Schema.Types.ObjectId, ref: "Users" },
  },
  { timestamps: true }
);

const Group = models.Group || model("Group", GroupSchema);

export default Group;
