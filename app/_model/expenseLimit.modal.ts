// app/_model/expenseLimit.model.ts
import { Schema, model, models } from 'mongoose';

const ExpenseLimitSchema = new Schema(
  {
    name:      { type: String, required: true, trim: true },
    userId:    { type: Schema.Types.ObjectId, ref: 'Users', required: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },

    conveyance:  { type: Number, default: 300,  min: 0 },
    purchase:    { type: Number, default: 2000, min: 0 },
    food:        { type: Number, default: 5000, min: 0 },
    tea:         { type: Number, default: 100,  min: 0 },
    hotel:       { type: Number, default: 5000, min: 0 },
    labour:      { type: Number, default: 1000, min: 0 },
    courier:     { type: Number, default: 200,  min: 0 },
    loading:     { type: Number, default: 2000, min: 0 },
    porter:      { type: Number, default: 800,  min: 0 },
    cartage:     { type: Number, default: 600,  min: 0 },
    rider:       { type: Number, default: 400,  min: 0 },
    daily_wages: { type: Number, default: 500,  min: 0 },
    transport:   { type: Number, default: 1000, min: 0 },
    maintenance: { type: Number, default: 500,  min: 0 },
    contractor:  { type: Number, default: 4000, min: 0 },
    other:       { type: Number, default: 500,  min: 0 },

    max_limit: { type: Number, default: 6000, min: 0 },
    status:    { type: String, enum: ['Active', 'In-Active', 'Blocked'], default: 'Active', index: true },
  },
  { timestamps: true }
);

const ExpenseLimit = models.ExpenseLimit || model('ExpenseLimit', ExpenseLimitSchema);
export default ExpenseLimit;

// Used when auto-creating a limit for a new user
export const DEFAULT_EXPENSE_LIMITS = {
  conveyance:  300,
  purchase:    2000,
  food:        5000,
  tea:         100,
  hotel:       5000,
  labour:      1000,
  courier:     200,
  loading:     2000,
  porter:      800,
  cartage:     600,
  rider:       400,
  daily_wages: 500,
  transport:   1000,
  maintenance: 500,
  contractor:  4000,
  other:       500,
  max_limit:   6000,
} as const;