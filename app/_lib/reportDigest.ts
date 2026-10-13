/**
 * @app/_lib/reportDigest.ts
 *
 * Report calculations shared by the email, PDF, Excel and the public
 * shared-report page. Pure functions with no server imports, so the numbers
 * a recipient sees in the browser are computed by exactly the same code that
 * produced the email.
 *
 * Calculation rules (match the rest of CashWise):
 *  - Expense total = approved + pending. Rejected claims are listed and
 *    totalled separately but never counted as spend.
 *  - Cash received = credit transactions, cash spent = debit transactions.
 *    Every submitted expense also books a debit, so expense and debit totals
 *    are never added together.
 *  - Cash balance = cumulative credit − cumulative debit (same as the
 *    account / day-balance screens).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportRow {
  _id: string;
  date: string;
  type: "expense" | "credit" | "debit";
  source: string;
  userName: string;
  userId: string;
  category: string;
  siteName: string;
  amount: number;
  description: string;
  remarks: string;
  status: string;
  attachments: string[];
  createdAt: string;
}

export interface Bucket {
  key: string;
  total: number;
  count: number;
}

export interface Amount {
  total: number;
  count: number;
}

export interface ExpenseDigest {
  total: number;          // approved + pending
  count: number;          // approved + pending entries
  average: number;
  claimed: Amount;        // every expense row incl. rejected
  approved: Amount;
  pending: Amount;
  rejected: Amount;
  byCategory: Bucket[];
  byUser: Bucket[];
  bySource: Bucket[];
  bySite: Bucket[];
  byDate: Bucket[];       // ascending by date
  largest: { amount: number; userName: string; category: string; date: string; siteName: string } | null;
}

export interface CashDigest {
  received: Amount;       // credit
  spent: Amount;          // debit
  net: number;            // received − spent
}

export interface CashPositionUser {
  userId: string;
  name: string;
  opening: number;
  received: number;
  spent: number;
  closing: number;
}

export interface CashPosition {
  opening: number;
  received: number;
  spent: number;
  closing: number;
  users: CashPositionUser[];
}

export interface ReportDigest {
  totalRecords: number;
  expense: ExpenseDigest;
  cash: CashDigest;
}

export interface ReportSection {
  key: "daily" | "weekly" | "monthly";
  label: string;
  from: string;
  to: string;
  rangeLabel: string;
  digest: ReportDigest;
  cashPosition?: CashPosition | null;
  rows: ReportRow[];
}

export interface RowFilters {
  search?: string;
  type?: string;        // "all" | expense | credit | debit
  source?: string;      // "all" | office | travel | toPay | credit | debit
  statuses?: string[];
  users?: string[];
  categories?: string[];
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function fmtINR(value: number | null | undefined, opts: { decimals?: boolean; symbol?: string } = {}): string {
  const n = Number(value ?? 0);
  const decimals = opts.decimals !== false;
  const formatted = Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return `${n < 0 ? "-" : ""}${opts.symbol ?? "₹"}${formatted}`;
}

/** PDF-safe currency (standard PDF fonts have no ₹ glyph). */
export function fmtRs(value: number | null | undefined): string {
  return fmtINR(value, { symbol: "Rs. " });
}

export function fmtCompactINR(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

const CATEGORY_LABELS: Record<string, string> = {
  dailyWages: "Daily Wages",
  toPay: "To Pay",
  credit: "Cash Received",
  debit: "Cash Spent",
  Credit: "Cash Received",
  Debit: "Cash Spent",
};

export function labelize(key: string): string {
  if (!key) return "—";
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ─── Calculation ──────────────────────────────────────────────────────────────

function emptyAmount(): Amount {
  return { total: 0, count: 0 };
}

function addTo(map: Map<string, Bucket>, key: string, amount: number) {
  const k = key || "—";
  const b = map.get(k) ?? { key: k, total: 0, count: 0 };
  b.total += amount;
  b.count += 1;
  map.set(k, b);
}

function sortedBuckets(map: Map<string, Bucket>): Bucket[] {
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summarizeRows(rows: ReportRow[]): ReportDigest {
  const claimed = emptyAmount();
  const approved = emptyAmount();
  const pending = emptyAmount();
  const rejected = emptyAmount();
  const received = emptyAmount();
  const spent = emptyAmount();

  const byCategory = new Map<string, Bucket>();
  const byUser = new Map<string, Bucket>();
  const bySource = new Map<string, Bucket>();
  const bySite = new Map<string, Bucket>();
  const byDate = new Map<string, Bucket>();
  let largest: ExpenseDigest["largest"] = null;

  for (const row of rows) {
    const amount = Number(row.amount) || 0;

    if (row.type === "credit") {
      received.total += amount;
      received.count += 1;
      continue;
    }
    if (row.type === "debit") {
      spent.total += amount;
      spent.count += 1;
      continue;
    }

    claimed.total += amount;
    claimed.count += 1;

    const status = String(row.status || "pending").toLowerCase();
    if (status === "rejected") {
      rejected.total += amount;
      rejected.count += 1;
      continue;
    }
    if (status === "approved") {
      approved.total += amount;
      approved.count += 1;
    } else {
      pending.total += amount;
      pending.count += 1;
    }

    addTo(byCategory, row.category, amount);
    addTo(byUser, row.userName || "Unknown", amount);
    addTo(bySource, row.source, amount);
    addTo(bySite, row.siteName || "—", amount);
    addTo(byDate, row.date, amount);

    if (!largest || amount > largest.amount) {
      largest = {
        amount,
        userName: row.userName,
        category: row.category,
        date: row.date,
        siteName: row.siteName,
      };
    }
  }

  const total = approved.total + pending.total;
  const count = approved.count + pending.count;

  return {
    totalRecords: rows.length,
    expense: {
      total: round2(total),
      count,
      average: count ? round2(total / count) : 0,
      claimed: { total: round2(claimed.total), count: claimed.count },
      approved: { total: round2(approved.total), count: approved.count },
      pending: { total: round2(pending.total), count: pending.count },
      rejected: { total: round2(rejected.total), count: rejected.count },
      byCategory: sortedBuckets(byCategory),
      byUser: sortedBuckets(byUser),
      bySource: sortedBuckets(bySource),
      bySite: sortedBuckets(bySite),
      byDate: Array.from(byDate.values()).sort((a, b) => a.key.localeCompare(b.key)),
      largest,
    },
    cash: {
      received: { total: round2(received.total), count: received.count },
      spent: { total: round2(spent.total), count: spent.count },
      net: round2(received.total - spent.total),
    },
  };
}

// ─── Filtering (shared-report page + filtered exports) ────────────────────────

export function filterRows(rows: ReportRow[], filters: RowFilters = {}): ReportRow[] {
  const q = (filters.search || "").trim().toLowerCase();
  const statuses = (filters.statuses || []).map((s) => s.toLowerCase());
  const users = filters.users || [];
  const categories = filters.categories || [];

  return rows.filter((row) => {
    if (filters.type && filters.type !== "all" && row.type !== filters.type) return false;
    if (filters.source && filters.source !== "all" && row.source !== filters.source) return false;
    if (statuses.length && !statuses.includes(String(row.status || "").toLowerCase())) return false;
    if (users.length && !users.includes(row.userName)) return false;
    if (categories.length && !categories.includes(row.category)) return false;
    if (q) {
      const text = `${row.userName} ${row.siteName} ${row.category} ${row.description} ${row.remarks} ${row.source} ${row.date} ${row.amount}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });
}

export function parseRowFilters(params: URLSearchParams): RowFilters {
  const list = (key: string) =>
    (params.get(key) || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    search: params.get("q") || "",
    type: params.get("type") || "all",
    source: params.get("source") || "all",
    statuses: list("status"),
    users: list("users"),
    categories: list("categories"),
  };
}

export function rowFiltersToQuery(filters: RowFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.statuses?.length) params.set("status", filters.statuses.join(","));
  if (filters.users?.length) params.set("users", filters.users.join(","));
  if (filters.categories?.length) params.set("categories", filters.categories.join(","));
  return params.toString();
}

export function hasActiveFilters(filters: RowFilters): boolean {
  return rowFiltersToQuery(filters).length > 0;
}

/** Build a single section from a legacy (pre-sections) snapshot. */
export function legacySection(snapshot: {
  fromDate?: string;
  toDate?: string;
  period?: string;
  rows?: ReportRow[];
}): ReportSection {
  const rows = Array.isArray(snapshot.rows) ? snapshot.rows : [];
  const key = (["daily", "weekly", "monthly"].includes(String(snapshot.period))
    ? snapshot.period
    : "daily") as ReportSection["key"];
  const from = snapshot.fromDate || "";
  const to = snapshot.toDate || from;
  return {
    key,
    label: "Report",
    from,
    to,
    rangeLabel: from === to ? from : `${from} – ${to}`,
    digest: summarizeRows(rows),
    cashPosition: null,
    rows,
  };
}
