// hooks/useExpenseLimitValidation.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import client from "@createRequest";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpenseFieldKey =
  | "conveyance" | "purchase" | "food" | "tea"   | "hotel"
  | "labour"     | "courier"  | "loading" | "porter" | "cartage"
  | "rider"      | "daily_wages" | "transport" | "maintenance"
  | "contractor" | "other";

export interface ExpenseLimitDoc {
  _id:         string;
  conveyance:  number; purchase:    number; food:        number;
  tea:         number; hotel:       number; labour:      number;
  courier:     number; loading:     number; porter:      number;
  cartage:     number; rider:       number; daily_wages: number;
  transport:   number; maintenance: number; contractor:  number;
  other:       number; max_limit:   number; status:      string;
}

export interface FieldValidation {
  /** Amount already spent today in this field */
  spentToday:    number;
  /** Per-field limit from ExpenseLimit doc */
  fieldLimit:    number;
  /** How much is still available for this field today */
  remaining:     number;
  /** true when (spentToday + newAmount) > fieldLimit */
  fieldExceeded: boolean;
  /** true when (totalSpentToday + newAmount) > max_limit */
  totalExceeded: boolean;
  /** Combined human-readable errors */
  errors:        string[];
}

export interface UseExpenseLimitValidationReturn {
  limit:          ExpenseLimitDoc | null;
  isLoadingLimit: boolean;
  dailyTotals:    Record<ExpenseFieldKey, number>;
  grandTotalToday: number;
  /** Validate a proposed new amount for a specific field */
  validate:       (field: ExpenseFieldKey, newAmount: number) => FieldValidation;
  /** Returns true if it's safe to proceed (shows toasts automatically) */
  canSubmit:      (field: ExpenseFieldKey, newAmount: number) => boolean;
  /** Refresh limit + today's totals (call after a successful submission) */
  refresh:        () => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function emptyTotals(): Record<ExpenseFieldKey, number> {
  return {
    conveyance: 0, purchase: 0, food: 0, tea: 0, hotel: 0,
    labour: 0, courier: 0, loading: 0, porter: 0, cartage: 0,
    rider: 0, daily_wages: 0, transport: 0, maintenance: 0,
    contractor: 0, other: 0,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useExpenseLimitValidation
 *
 * Fetches:
 *   1. The user's active ExpenseLimit document
 *   2. The user's already-submitted amounts for today (per-field)
 *
 * Then exposes:
 *   - `validate(field, newAmount)` → detailed breakdown
 *   - `canSubmit(field, newAmount)` → boolean + auto-toasts on failure
 *
 * @param userId  MongoDB _id of the user whose limit to check
 * @param schema  "/officeExpense" | "/travelExpense" | "/toPayExpense"
 */
export function useExpenseLimitValidation(
  userId: string | undefined,
  schema: string
): UseExpenseLimitValidationReturn {
  const [limit, setLimit]             = useState<ExpenseLimitDoc | null>(null);
  const [isLoadingLimit, setLoading]  = useState(false);
  const [dailyTotals, setDailyTotals] = useState<Record<ExpenseFieldKey, number>>(emptyTotals());
  const [grandTotalToday, setGrand]   = useState(0);
  const refreshToken                  = useRef(0);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Active limit doc
      const limitRes = await client.get("/admin/expenseLimit", {
        params: { userId, limit: 1 },
      });
      const doc: ExpenseLimitDoc | undefined = limitRes.data?.result?.[0];
      setLimit(doc ?? null);

      // 2. Today's already-submitted totals for this user
      const todayRes = await client.get("/expenses/daily-summary", {
        params: { userId, schema },
      });
      // const totals: Record<ExpenseFieldKey, number> =
      //   todayRes.data?.totals ?? emptyTotals();
      // setDailyTotals(totals);

      // const grand = (Object.values(totals) as number[]).reduce((s, v) => s + v, 0);
      setGrand(todayRes?.data?.totals);
    } catch {
      // silent — limit stays null, validation will warn user via canSubmit
    } finally {
      setLoading(false);
    }
  }, [userId, schema]);

  useEffect(() => { load(); }, [load, refreshToken.current]);

  // ── validate ───────────────────────────────────────────────────────────────
  const validate = useCallback(
    (field: ExpenseFieldKey, newAmount: number): FieldValidation => {
      const errors: string[] = [];

      if (!limit) {
        return {
          spentToday: 0, fieldLimit: 0, remaining: 0,
          fieldExceeded: false, totalExceeded: false,
          errors: ["No active expense limit found for your account"],
        };
      }

      const fieldLimit  = limit[field] ?? 0;
      const spentToday  = dailyTotals[field] ?? 0;
      const remaining   = Math.max(0, fieldLimit - spentToday);
      const newTotal    = spentToday + newAmount;
      const fieldExceeded = newTotal > fieldLimit;

      const newGrand    = grandTotalToday + newAmount;
      const totalExceeded = newGrand > limit.max_limit;

      if (fieldExceeded) {
        errors.push(
          `${field.replace("_", " ")} limit exceeded: ₹${newAmount.toLocaleString("en-IN")} + ₹${spentToday.toLocaleString("en-IN")} already spent today = ₹${newTotal.toLocaleString("en-IN")} (limit ₹${fieldLimit.toLocaleString("en-IN")})`
        );
      }

      if (totalExceeded) {
        errors.push(
          `Daily max limit exceeded: ₹${newGrand.toLocaleString("en-IN")} total would exceed ₹${limit.max_limit.toLocaleString("en-IN")}`
        );
      }

      return { spentToday, fieldLimit, remaining, fieldExceeded, totalExceeded, errors };
    },
    [limit, dailyTotals, grandTotalToday]
  );

  // ── canSubmit ──────────────────────────────────────────────────────────────
  const canSubmit = useCallback(
    (field: ExpenseFieldKey, newAmount: number): boolean => {
      if (!limit) {
        toast.error("Cannot submit: no active expense limit found. Contact your admin.");
        return false;
      }
      const result = validate(field, newAmount);
      if (result.errors.length > 0) {
        result.errors.forEach((e) => toast.error(e));
        return false;
      }
      return true;
    },
    [limit, validate]
  );

  const refresh = useCallback(() => {
    refreshToken.current += 1;
    load();
  }, [load]);

  return { limit, isLoadingLimit, dailyTotals, grandTotalToday, validate, canSubmit, refresh };
}