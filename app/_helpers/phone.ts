// Turns what a user types ("+91 98765-43210", "09876543210", " 9876543210 ")
// into the 10-digit number stored on users. Returns null if it isn't one.
export function normalizePhone(value: unknown): string | null {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
}
