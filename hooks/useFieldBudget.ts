// hooks/useFieldBudget.ts
"use client";

import { useMemo } from "react";
import type {
  ExpenseFieldKey,
  UseExpenseLimitValidationReturn,
} from "./useExpenseLimitValidation";

export interface FieldBudgetInfo {
  /** Per-field cap from ExpenseLimit */
  fieldLimit: number;
  /** Already spent today for this field */
  spentToday: number;
  /** Remaining budget for this field today */
  remaining: number;
  /** 0–100 fill percentage for a progress bar */
  pct: number;
  /** true when new amount alone would already exceed the field cap */
  isOver: boolean;
  /** true when adding new amount would bust the daily max */
  isTotalOver: boolean;
  /** "ok" | "warn" (≥80 %) | "over" */
  status: "ok" | "warn" | "over";
  /** Short human-readable hint e.g. "₹800 remaining" */
  hint: string;
}

/**
 * useFieldBudget
 *
 * A lightweight hook you can call once per form input to get
 * colour-coded budget feedback without re-fetching the limit.
 *
 * Usage inside a form component:
 *   const budget = useFieldBudget(limitHook, "cartage", watchedAmount);
 *   <p style={{ color: budget.status === "over" ? "red" : "green" }}>{budget.hint}</p>
 */
export function useFieldBudget(
  limitHook: UseExpenseLimitValidationReturn,
  field: ExpenseFieldKey,
  newAmount: number
): FieldBudgetInfo {
  const { limit, dailyTotals, grandTotalToday } = limitHook;

  return useMemo(() => {
    const fieldLimit  = limit?.[field] ?? 0;
    const spentToday  = dailyTotals[field] ?? 0;
    const remaining   = Math.max(0, fieldLimit - spentToday);
    const amount      = Number(newAmount) || 0;

    const projected   = spentToday + amount;
    const pct         = fieldLimit > 0 ? Math.min((projected / fieldLimit) * 100, 100) : 0;
    const isOver      = projected > fieldLimit;
    const isTotalOver = limit ? grandTotalToday + amount > limit.max_limit : false;

    const status: FieldBudgetInfo["status"] =
      isOver || isTotalOver ? "over" : pct >= 80 ? "warn" : "ok";

    let hint = ``;
    if (isOver) {
      const excess = projected - fieldLimit;
      // hint = `₹${excess.toLocaleString("en-IN")} over limit`;
    } else if (isTotalOver) {
      const excess = grandTotalToday + amount - (limit?.max_limit ?? 0);
      // hint = `Daily cap exceeded by ₹${excess.toLocaleString("en-IN")}`;
    }

    return { fieldLimit, spentToday, remaining, pct, isOver, isTotalOver, status, hint };
  }, [limit, dailyTotals, grandTotalToday, field, newAmount]);
}