/**
 * @app/_lib/reportEngine.ts
 *
 * SINGLE SOURCE OF TRUTH for CashWise report generation.
 *
 * This module is used by:
 *  - /api/reports/download  (manual interactive reports)
 *  - autoExpenseReport.ts   (cron automated reports)
 *  - /api/reports/generate-now  (manual trigger)
 *  - /api/reports/share/[token] (public shared report, reads snapshot)
 *
 * The same normalisation, filter, and calculation pipeline feeds
 * the web UI, PDF, email, and execution logs so numbers are always consistent.
 */

import mongoose from "mongoose";
import { DateTime } from "luxon";
import DB from "@app/_database/db";
import Users from "@app/_model/user.model";
import OfficeExpense from "@app/_model/office.modal";
import TravelExpense from "@app/_model/travel.modal";
import ToPayExpense from "@app/_model/toPay.modal";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportEngineType = "expense" | "credit" | "debit" | "combined";
export type ExpenseSource = "office" | "travel" | "toPay";
export type ExpenseStatus = "pending" | "approved" | "rejected";

/** A normalised row that can represent any record type */
export interface NormalisedRow {
  _id: string;
  date: string;
  type: "expense" | "credit" | "debit";
  source: ExpenseSource | "credit" | "debit";
  userName: string;
  userId: string;
  category: string;
  siteName: string;       // site or party name
  amount: number;         // expense.amount or transaction.money
  description: string;
  remarks: string;
  status: string;         // expense status; "—" for credit/debit
  attachments: string[];  // file URLs
  createdAt: string;
  // raw fields for detailed views
  [key: string]: unknown;
}

export interface ReportSummary {
  expenseTotal: number;
  creditTotal: number;
  debitTotal: number;
  grandTotal: number;       // expenseTotal + creditTotal + debitTotal
  netCreditDebit: number;   // creditTotal - debitTotal
  totalRecords: number;
  averagePerEntry: number;
  byUser: Record<string, { total: number; count: number }>;
  byDate: Record<string, { total: number; count: number }>;
  byCategory: Record<string, { total: number; count: number }>;
}

export interface ReportEngineFilters {
  reportType: ReportEngineType;
  expenseSources?: ExpenseSource[];    // [] means all
  fromDate?: string;                   // "YYYY-MM-DD"
  toDate?: string;                     // "YYYY-MM-DD"
  userIds?: string[];                  // [] means all users
  statuses?: ExpenseStatus[];          // [] means all statuses
  categories?: string[];               // [] means all categories
  includeCredit?: boolean;
  includeDebit?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
  /** Zone used to turn credit/debit timestamps into calendar days. Default Asia/Kolkata. */
  timezone?: string;
}

export interface ReportEngineResult {
  rows: NormalisedRow[];
  summary: ReportSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  allRows: NormalisedRow[]; // unpaginated — used for PDF/email
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const ALL_EXPENSE_CATEGORIES = [
  "conveyance", "purchase", "food", "tea", "hotel", "labour", "contractor",
  "courier", "loading", "porter", "cartage", "rider", "dailyWages",
  "transport", "maintenance", "other",
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format number as Indian Rupees: ₹1,25,000.00 */
export function fmtINR(n: number | null | undefined): string {
  const value = Number(n ?? 0);
  return "₹" + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

/** String date range filter for expense.date stored as "YYYY-MM-DD" string */
function makeStringDateFilter(from?: string, to?: string) {
  const f: Record<string, string> = {};
  if (from) f.$gte = from;
  if (to) f.$lte = to;
  return f;
}

export const REPORT_TIMEZONE = process.env.AUTO_EXPENSE_REPORT_TIMEZONE || "Asia/Kolkata";

function resolveZone(zone?: string): string {
  const z = zone || REPORT_TIMEZONE;
  return DateTime.now().setZone(z).isValid ? z : "Asia/Kolkata";
}

/**
 * Date range filter for transactionDetails.createdAt stored as JS Date.
 * Day boundaries are taken in the report timezone (not the server's, which
 * is UTC on Vercel) so an IST transaction at 01:00 lands on the right day.
 */
function makeDateRangeFilter(from?: string, to?: string, zone?: string) {
  const z = resolveZone(zone);
  const f: Record<string, Date> = {};
  if (from) f.$gte = DateTime.fromISO(from, { zone: z }).startOf("day").toJSDate();
  if (to) f.$lte = DateTime.fromISO(to, { zone: z }).endOf("day").toJSDate();
  return f;
}

/** Calendar day (YYYY-MM-DD) of a timestamp in the report timezone. */
function localDate(d: Date, zone?: string): string {
  return DateTime.fromJSDate(d).setZone(resolveZone(zone)).toISODate() ?? d.toISOString().split("T")[0];
}

function collectAttachments(item: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const key of ["locationFiles", "paymentFiles", "invoiceFiles", "imageUrl"]) {
    const arr = item[key];
    if (Array.isArray(arr)) {
      arr.forEach((u: unknown) => { if (typeof u === "string" && u) urls.push(u); });
    }
  }
  return urls;
}

// ─── Fetch Expense Rows ───────────────────────────────────────────────────────

async function fetchExpenseRows(
  filters: ReportEngineFilters,
  userObjectIds: mongoose.Types.ObjectId[]
): Promise<NormalisedRow[]> {
  // Register Users model so populate works
  if (!mongoose.models.Users) { const _ = Users.modelName; }

  const sources: ExpenseSource[] =
    filters.expenseSources && filters.expenseSources.length > 0
      ? filters.expenseSources
      : ["office", "travel", "toPay"];

  const modelMap: Record<ExpenseSource, typeof OfficeExpense> = {
    office:  OfficeExpense,
    travel:  TravelExpense,
    toPay:   ToPayExpense,
  };

  const categoriesToScan =
    filters.categories && filters.categories.length > 0
      ? filters.categories
      : [...ALL_EXPENSE_CATEGORIES];

  const stringDateFilter = makeStringDateFilter(filters.fromDate, filters.toDate);
  const baseQuery: Record<string, unknown> = { createdBy: { $in: userObjectIds } };
  if (stringDateFilter.$gte || stringDateFilter.$lte) baseQuery.date = stringDateFilter;

  const rows: NormalisedRow[] = [];

  for (const src of sources) {
    const Model = modelMap[src];
    if (!Model) continue;

    const projection: Record<string, number> = { createdBy: 1, date: 1, createdAt: 1 };
    categoriesToScan.forEach((cat) => { projection[cat] = 1; });

    let docs: unknown[];
    try {
      docs = await Model
        .find(baseQuery, projection)
        .populate({ path: "createdBy", select: "_id name phone role" })
        .lean();
    } catch (err) {
      console.error(`[reportEngine] Error querying ${src}:`, err);
      continue;
    }

    for (const doc of docs as Record<string, unknown>[]) {
      const createdBy = (doc.createdBy ?? {}) as { _id?: { toString(): string }; name?: string };
      const docDate = String(doc.date ?? "");

      for (const category of categoriesToScan) {
        const items = doc[category];
        if (!Array.isArray(items) || items.length === 0) continue;

        for (const item of items as Record<string, unknown>[]) {
          // Status filter
          if (filters.statuses && filters.statuses.length > 0) {
            if (!filters.statuses.includes(String(item.status ?? "") as ExpenseStatus)) continue;
          }

          // Search filter
          if (filters.search) {
            const q = filters.search.toLowerCase();
            const haystack = [
              item.siteName, item.description, item.restaurantName,
              item.shopName, item.hotelName, item.todayWork, item.remarks,
            ].filter(Boolean).join(" ").toLowerCase();
            if (!haystack.includes(q)) continue;
          }

          rows.push({
            // forward all raw item fields for detail views (spread first so
            // the normalised fields below always win)
            ...item,
            _id:         String((item._id ?? doc._id ?? "") as unknown),
            date:        docDate,
            type:        "expense",
            source:      src,
            userName:    createdBy.name || "Unknown",
            userId:      createdBy._id?.toString() || "",
            category,
            siteName:    String(item.siteName || item.serviceProvider || ""),
            amount:      Number(item.amount ?? 0) || 0,
            description: String(item.description || item.todayWork || ""),
            remarks:     String(item.remarks ?? ""),
            status:      String(item.status || "pending"),
            attachments: collectAttachments(item),
            createdAt:   new Date((item.createdAt ?? doc.createdAt ?? Date.now()) as Date).toISOString(),
            _id_raw:     String((item._id ?? doc._id ?? "") as unknown),
          });
        }
      }
    }
  }

  return rows;
}

// ─── Fetch Transaction Rows (Credit / Debit) ──────────────────────────────────

async function fetchTransactionRows(
  filters: ReportEngineFilters,
  userObjectIds: mongoose.Types.ObjectId[],
  txType: "credit" | "debit"
): Promise<NormalisedRow[]> {
  const dateFilter = makeDateRangeFilter(filters.fromDate, filters.toDate, filters.timezone);
  const hasDateFilter = !!(dateFilter.$gte || dateFilter.$lte);

  let users: unknown[];
  try {
    users = await Users.find(
      { _id: { $in: userObjectIds } },
      { _id: 1, name: 1, phone: 1, [txType]: 1 }
    ).lean();
  } catch (err) {
    console.error(`[reportEngine] Error querying users for ${txType}:`, err);
    return [];
  }

  const rows: NormalisedRow[] = [];

  for (const user of users as Record<string, unknown>[]) {
    const entries = (user[txType] as unknown[] | undefined) ?? [];

    for (const entry of entries as Record<string, unknown>[]) {
      const details = (entry.transactionDetails as Record<string, unknown>[] | undefined) ?? [];

      for (const detail of details) {
        // Date filter on createdAt
        if (hasDateFilter) {
          const cat = detail.createdAt ? new Date(detail.createdAt as string | Date) : null;
          if (!cat) continue;
          if (dateFilter.$gte && cat < dateFilter.$gte) continue;
          if (dateFilter.$lte && cat > dateFilter.$lte) continue;
        }

        // Search filter
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const haystack = `${entry.name} ${entry.phone} ${detail.reason} ${detail.remarks}`.toLowerCase();
          if (!haystack.includes(q)) continue;
        }

        const createdAt = detail.createdAt ? new Date(detail.createdAt as string | Date) : new Date();

        rows.push({
          _id:         String(detail._id ?? new mongoose.Types.ObjectId()),
          date:        localDate(createdAt, filters.timezone),
          type:        txType,
          source:      txType,
          userName:    String(user.name ?? "Unknown"),
          userId:      String((user._id as { toString(): string })?.toString() ?? ""),
          category:    txType === "credit" ? "Credit" : "Debit",
          siteName:    String(entry.name ?? ""),
          amount:      Number(detail.money ?? 0),
          description: String(detail.reason ?? ""),
          remarks:     String(detail.remarks ?? ""),
          status:      "—",
          attachments: Array.isArray(detail.imageUrl) ? (detail.imageUrl as string[]) : [],
          createdAt:   createdAt.toISOString(),
          // raw detail fields
          money:       Number(detail.money ?? 0),
          reason:      String(detail.reason ?? ""),
          phone:       String(entry.phone ?? ""),
          name:        String(entry.name ?? ""),
          transactionType: txType,
        });
      }
    }
  }

  return rows;
}

// ─── Summary Calculator ───────────────────────────────────────────────────────

function calculateSummary(rows: NormalisedRow[]): ReportSummary {
  const summary: ReportSummary = {
    expenseTotal: 0,
    creditTotal: 0,
    debitTotal: 0,
    grandTotal: 0,
    netCreditDebit: 0,
    totalRecords: rows.length,
    averagePerEntry: 0,
    byUser: {},
    byDate: {},
    byCategory: {},
  };

  for (const row of rows) {
    const amt = Number(row.amount ?? 0);

    if (row.type === "expense") summary.expenseTotal += amt;
    else if (row.type === "credit") summary.creditTotal += amt;
    else if (row.type === "debit") summary.debitTotal += amt;

    summary.grandTotal += amt;

    const uKey = row.userName || "Unknown";
    if (!summary.byUser[uKey]) summary.byUser[uKey] = { total: 0, count: 0 };
    summary.byUser[uKey].total += amt;
    summary.byUser[uKey].count++;

    const dKey = row.date;
    if (!summary.byDate[dKey]) summary.byDate[dKey] = { total: 0, count: 0 };
    summary.byDate[dKey].total += amt;
    summary.byDate[dKey].count++;

    const cKey = row.category || "other";
    if (!summary.byCategory[cKey]) summary.byCategory[cKey] = { total: 0, count: 0 };
    summary.byCategory[cKey].total += amt;
    summary.byCategory[cKey].count++;
  }

  summary.netCreditDebit = summary.creditTotal - summary.debitTotal;
  summary.averagePerEntry = rows.length > 0 ? summary.grandTotal / rows.length : 0;

  // Sort each group descending by total
  const sortDesc = (rec: Record<string, { total: number; count: number }>) =>
    Object.fromEntries(Object.entries(rec).sort((a, b) => b[1].total - a[1].total));

  summary.byUser = sortDesc(summary.byUser);
  summary.byDate = sortDesc(summary.byDate);
  summary.byCategory = sortDesc(summary.byCategory);

  return summary;
}

// ─── Sort & Paginate ──────────────────────────────────────────────────────────

function sortRows(rows: NormalisedRow[], sortBy = "date", sortOrder: "asc" | "desc" = "desc"): NormalisedRow[] {
  return [...rows].sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return sortOrder === "asc" ? -1 : 1;
    if (bv == null) return sortOrder === "asc" ? 1 : -1;
    if (av instanceof Date && bv instanceof Date)
      return sortOrder === "asc" ? av.getTime() - bv.getTime() : bv.getTime() - av.getTime();
    if (typeof av === "number" && typeof bv === "number")
      return sortOrder === "asc" ? av - bv : bv - av;
    const as = String(av).toLowerCase(), bs = String(bv).toLowerCase();
    return sortOrder === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
  });
}

function paginate(rows: NormalisedRow[], page: number, limit: number) {
  const total = rows.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  return {
    data: rows.slice(start, start + limit),
    pagination: {
      page, limit, total, totalPages,
      hasNext: start + limit < total,
      hasPrev: page > 1,
    },
  };
}

// ─── Main Engine Entry Point ──────────────────────────────────────────────────

export async function runReportEngine(filters: ReportEngineFilters): Promise<ReportEngineResult> {
  await DB();

  // Resolve user IDs
  let userObjectIds: mongoose.Types.ObjectId[];
  if (filters.userIds && filters.userIds.length > 0) {
    userObjectIds = toObjectIds(filters.userIds);
  } else {
    const all = await Users.find({}, { _id: 1 }).lean() as { _id: mongoose.Types.ObjectId }[];
    userObjectIds = all.map((u) => u._id);
  }

  if (userObjectIds.length === 0) {
    const emptySummary: ReportSummary = {
      expenseTotal: 0, creditTotal: 0, debitTotal: 0,
      grandTotal: 0, netCreditDebit: 0, totalRecords: 0,
      averagePerEntry: 0, byUser: {}, byDate: {}, byCategory: {},
    };
    return {
      rows: [], allRows: [], summary: emptySummary,
      pagination: { page: 1, limit: filters.limit ?? 100, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
    };
  }

  let allRows: NormalisedRow[] = [];

  const rType = filters.reportType;

  if (rType === "expense") {
    allRows = await fetchExpenseRows(filters, userObjectIds);
  } else if (rType === "credit") {
    allRows = await fetchTransactionRows(filters, userObjectIds, "credit");
  } else if (rType === "debit") {
    allRows = await fetchTransactionRows(filters, userObjectIds, "debit");
  } else if (rType === "combined") {
    const [expenses, credits, debits] = await Promise.all([
      fetchExpenseRows(filters, userObjectIds),
      filters.includeCredit !== false ? fetchTransactionRows(filters, userObjectIds, "credit") : [],
      filters.includeDebit !== false ? fetchTransactionRows(filters, userObjectIds, "debit") : [],
    ]);
    allRows = [...expenses, ...credits, ...debits];
  }

  const sorted = sortRows(allRows, filters.sortBy, filters.sortOrder);
  const summary = calculateSummary(sorted);

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(1000, Math.max(1, filters.limit ?? 100));
  const { data: rows, pagination } = paginate(sorted, page, limit);

  return { rows, allRows: sorted, summary, pagination };
}

// ─── Cash Position (opening / closing balance) ────────────────────────────────

export interface CashPositionResult {
  opening: number;
  received: number;
  spent: number;
  closing: number;
  users: {
    userId: string;
    name: string;
    opening: number;
    received: number;
    spent: number;
    closing: number;
  }[];
}

/**
 * Cash-in-hand statement for a date window, per user and in total:
 *   opening  = all credit − all debit before `fromDate`
 *   received = credit inside the window
 *   spent    = debit inside the window
 *   closing  = opening + received − spent
 * Uses the same credit − debit rule as the account and day-balance screens.
 */
export async function computeCashPosition(params: {
  userIds?: string[];
  fromDate: string;
  toDate: string;
  timezone?: string;
}): Promise<CashPositionResult> {
  await DB();

  const range = makeDateRangeFilter(params.fromDate, params.toDate, params.timezone);
  const start = range.$gte;
  const end = range.$lte;

  const query: Record<string, unknown> = {};
  if (params.userIds && params.userIds.length > 0) {
    query._id = { $in: toObjectIds(params.userIds) };
  }

  const users = (await Users.find(query, { _id: 1, name: 1, credit: 1, debit: 1 }).lean()) as unknown as Record<string, unknown>[];

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const result: CashPositionResult = { opening: 0, received: 0, spent: 0, closing: 0, users: [] };

  for (const user of users) {
    let opening = 0;
    let received = 0;
    let spent = 0;

    for (const txType of ["credit", "debit"] as const) {
      const sign = txType === "credit" ? 1 : -1;
      const entries = (user[txType] as Record<string, unknown>[] | undefined) ?? [];
      for (const entry of entries) {
        const details = (entry.transactionDetails as Record<string, unknown>[] | undefined) ?? [];
        for (const detail of details) {
          if (!detail.createdAt) continue;
          const at = new Date(detail.createdAt as string | Date);
          const money = Number(detail.money ?? 0) || 0;
          if (start && at < start) {
            opening += sign * money;
          } else if (!end || at <= end) {
            if (txType === "credit") received += money;
            else spent += money;
          }
        }
      }
    }

    if (opening === 0 && received === 0 && spent === 0) continue;

    const closing = opening + received - spent;
    result.users.push({
      userId: String((user._id as { toString(): string }).toString()),
      name: String(user.name ?? "Unknown"),
      opening: round2(opening),
      received: round2(received),
      spent: round2(spent),
      closing: round2(closing),
    });
    result.opening += opening;
    result.received += received;
    result.spent += spent;
    result.closing += closing;
  }

  result.users.sort((a, b) => b.closing - a.closing || a.name.localeCompare(b.name));
  result.opening = round2(result.opening);
  result.received = round2(result.received);
  result.spent = round2(result.spent);
  result.closing = round2(result.closing);
  return result;
}
