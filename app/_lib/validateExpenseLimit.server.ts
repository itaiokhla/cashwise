// lib/validateExpenseLimit.server.ts
//
// Drop-in server-side validation used by every form route
// (cartage, porter, conveyance, food, etc.)
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";
import { DateTime } from "luxon";
import OfficeExpense  from "@app/_model/office.modal";
import TravelExpense  from "@app/_model/travel.modal";
import ToPayExpense   from "@app/_model/toPay.modal";
import ExpenseLimit from "@app/_model/expenseLimit.modal";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpenseFieldKey =
  | "conveyance" | "purchase" | "food" | "tea"   | "hotel"
  | "labour"     | "courier"  | "loading" | "porter" | "cartage"
  | "rider"      | "daily_wages" | "transport" | "maintenance"
  | "contractor" | "other";

export interface LimitValidationResult {
  valid:       boolean;
  errors:      string[];
  /** Field-level breakdown (useful for structured API responses) */
  breakdown: {
    field:        ExpenseFieldKey;
    newAmount:    number;
    spentToday:   number;
    fieldLimit:   number;
    fieldExceeded: boolean;
  } | null;
  totalBreakdown: {
    newGrandTotal: number;
    maxLimit:      number;
    exceeded:      boolean;
  } | null;
}

// ─── Helper: schema model selector ───────────────────────────────────────────

function modelForSchema(schema: string) {
  if (schema?.includes("travel"))  return TravelExpense;
  if (schema?.includes("toPay"))   return ToPayExpense;
  return OfficeExpense;
}

// ─── Helper: sum today's amounts for one field ────────────────────────────────

async function getTodayFieldTotal(
  userId: string,
  schema: string,
  field: ExpenseFieldKey
): Promise<number> {
  const today = DateTime.now().setZone("Asia/Kolkata").startOf("day").toISODate();
  const Model = modelForSchema(schema);

  // Each expense model stores items as arrays: doc.cartage = [{amount, ...}, ...]
  // We use aggregation to sum amounts for today's doc
  const result = await Model.aggregate([
    {
      $match: {
        createdBy: new mongoose.Types.ObjectId(userId),
        date: today,
      },
    },
    {
      $project: {
        fieldTotal: {
          $sum: {
            $map: {
              input: `$${field}`,
              as: "item",
              in: { $ifNull: ["$$item.amount", 0] },
            },
          },
        },
      },
    },
  ]);

  return result[0]?.fieldTotal ?? 0;
}

// ─── Helper: sum today's grand total across ALL fields ────────────────────────

const ALL_FIELDS: ExpenseFieldKey[] = [
  "conveyance", "purchase", "food", "tea", "hotel", "labour",
  "courier", "loading", "porter", "cartage", "rider", "daily_wages",
  "transport", "maintenance", "contractor", "other",
];

async function getTodayGrandTotal(
  userId: string,
  schema: string
): Promise<number> {
  const today = DateTime.now().setZone("Asia/Kolkata").startOf("day").toISODate();
  const Model = modelForSchema(schema);

  const result = await Model.aggregate([
    {
      $match: {
        createdBy: new mongoose.Types.ObjectId(userId),
        date: today,
      },
    },
    {
      $project: {
        grandTotal: {
          $add: ALL_FIELDS.map((f) => ({
            $sum: {
              $map: {
                input: `$${f}`,
                as: "item",
                in: { $ifNull: ["$$item.amount", 0] },
              },
            },
          })),
        },
      },
    },
  ]);

  return result[0]?.grandTotal ?? 0;
}

// ─── Main validation function ─────────────────────────────────────────────────

/**
 * validateExpenseLimit
 *
 * Call this at the top of any form POST route before saving.
 *
 * @param userId    Submitting user's MongoDB _id (string)
 * @param schema    Path string: "/officeExpense" | "/travelExpense" | "/toPayExpense"
 * @param field     Which expense category (e.g. "cartage")
 * @param newAmount The ₹ amount about to be saved
 *
 * @returns LimitValidationResult — check `.valid` before proceeding
 */
export async function validateExpenseLimit(
  userId: string,
  schema: string,
  field: ExpenseFieldKey,
  newAmount: number
): Promise<LimitValidationResult> {
  const errors: string[] = [];

  // 1. Load active limit
  const limitDoc = await ExpenseLimit.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    status: "Active",
  }).lean<Record<string, any>>();

  if (!limitDoc) {
    return {
      valid: false,
      errors: ["No active expense limit found for this user"],
      breakdown: null,
      totalBreakdown: null,
    };
  }

  // 2. Field-level check
  const fieldLimit  = Number(limitDoc[field]) ?? 0;
  const spentToday  = await getTodayFieldTotal(userId, schema, field);
  const projectedField = spentToday + newAmount;
  const fieldExceeded  = projectedField > fieldLimit;

  if (fieldExceeded) {
    errors.push(
      `${field.replace("_", " ")} limit exceeded: ₹${newAmount.toLocaleString("en-IN")} + ₹${spentToday.toLocaleString("en-IN")} already today = ₹${projectedField.toLocaleString("en-IN")} (limit ₹${fieldLimit.toLocaleString("en-IN")})`
    );
  }

  // 3. Daily max check
  const grandTotal    = await getTodayGrandTotal(userId, schema);
  const newGrandTotal = grandTotal + newAmount;
  const maxLimit      = Number(limitDoc.max_limit) ?? 0;
  const totalExceeded = newGrandTotal > maxLimit;

  if (totalExceeded) {
    errors.push(
      `Daily max limit exceeded: ₹${newGrandTotal.toLocaleString("en-IN")} would exceed ₹${maxLimit.toLocaleString("en-IN")}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    breakdown: {
      field,
      newAmount,
      spentToday,
      fieldLimit,
      fieldExceeded,
    },
    totalBreakdown: {
      newGrandTotal,
      maxLimit,
      exceeded: totalExceeded,
    },
  };
}

// ─── Convenience: getDailyTotals (used by the summary API route) ──────────────

/**
 * getDailyTotals
 *
 * Returns per-field totals already submitted today by a user.
 * Consumed by GET /api/expenses/daily-summary for the frontend hook.
 */
export async function getDailyTotals(
  userId: string,
  schema: string
): Promise<Record<ExpenseFieldKey, number>> {
  const today = DateTime.now().setZone("Asia/Kolkata").startOf("day").toISODate();
  const Model = modelForSchema(schema);

  const result = await Model.aggregate([
    {
      $match: {
        createdBy: new mongoose.Types.ObjectId(userId),
        date: today,
      },
    },
    {
      $project: Object.fromEntries(
        ALL_FIELDS.map((f) => [
          f,
          {
            $sum: {
              $map: {
                input: `$${f}`,
                as: "item",
                in: { $ifNull: ["$$item.amount", 0] },
              },
            },
          },
        ])
      ),
    },
  ]);

  const doc = result[0] ?? {};
  return Object.fromEntries(
    ALL_FIELDS.map((f) => [f, doc[f] ?? 0])
  ) as Record<ExpenseFieldKey, number>;
}