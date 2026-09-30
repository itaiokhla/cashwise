// lib/validateExpense.ts

export type ExpenseLimitDoc = {
  conveyance: number;
  purchase: number;
  food: number;
  tea: number;
  hotel: number;
  labour: number;
  courier: number;
  loading: number;
  porter: number;
  cartage: number;
  rider: number;
  daily_wages: number;
  transport: number;
  maintenance: number;
  contractor: number;
  other: number;
  max_limit: number;
};

export type ExpenseEntry = Partial<Record<keyof Omit<ExpenseLimitDoc, 'max_limit'>, number>>;

export type ValidationError = {
  field: string;
  submitted: number;
  limit: number;
  message: string;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

const EXPENSE_FIELDS = [
  'conveyance', 'purchase', 'food', 'tea', 'hotel',
  'labour', 'courier', 'loading', 'porter', 'cartage',
  'rider', 'daily_wages', 'transport', 'maintenance',
  'contractor', 'other',
] as const;

export function validateExpenseAgainstLimit(
  expense: ExpenseEntry,
  limit: ExpenseLimitDoc
): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Per-field check
  for (const field of EXPENSE_FIELDS) {
    const submitted = expense[field] ?? 0;
    const fieldLimit = limit[field];

    if (submitted > fieldLimit) {
      errors.push({
        field,
        submitted,
        limit: fieldLimit,
        message: `${field.replace('_', ' ')} ₹${submitted} exceeds limit of ₹${fieldLimit}`,
      });
    }
  }

  // 2. Total sum check against max_limit
  const total = EXPENSE_FIELDS.reduce((sum, f) => sum + (expense[f] ?? 0), 0);
  if (total > limit.max_limit) {
    errors.push({
      field: 'max_limit',
      submitted: total,
      limit: limit.max_limit,
      message: `Total ₹${total} exceeds max limit of ₹${limit.max_limit}`,
    });
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}