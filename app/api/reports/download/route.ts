'use server';
// app/api/reports/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { stringify } from "csv-stringify/sync";
import mongoose from "mongoose";
import { DateTime } from "luxon";

import DB from "@app/_database/db";
import Users from "@app/_model/user.model";
import TravelExpense from "@app/_model/travel.modal";
import OfficeExpense from "@app/_model/office.modal";
import ToPayExpense from "@app/_model/toPay.modal";
import { generateExcelBuffer, generatePdfBuffer, sendReportEmail } from "@app/_lib/email";
import { ReportItem } from "@app/_api_query/report.api";

// Ensure DB is connected
let dbReady = false;
async function ensureDB() {
  if (!dbReady) {
    await DB();
    dbReady = true;
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────
type ReportType   = "expense" | "credit" | "debit" | "combined";
type ExportFormat = "json" | "csv" | "excel" | "pdf";
type GroupBy      = "user" | "date" | "category" | "none";

interface ReportFilters {
  reportType:     ReportType;
  expenseType?:   "all" | "office" | "travel" | "toPay";
  fromDate?:      string;   // "YYYY-MM-DD"
  toDate?:        string;   // "YYYY-MM-DD"
  users?:         string[];
  status?:        string[];
  categories?:    string[];
  search?:        string;
  groupBy?:       GroupBy;
  sortBy?:        string;
  sortOrder?:     "asc" | "desc";
  page?:          number;
  limit?:         number;
  format?:        ExportFormat;
  includeSummary?: boolean;
}

interface ExpenseItem {
  _id:         string;
  siteName:    string;
  amount:      number;
  date:        string;
  category:    string;
  description?: string;
  userName:    string;
  userId:      string;
  status:      string;
  createdAt:   Date;
  [key: string]: unknown;
}

interface TransactionItem {
  _id:       string;
  name:      string;
  phone:     string;
  money:     number;
  reason:    string;
  remarks?:  string;
  date:      string;
  userName:  string;
  userId:    string;
  type:      "credit" | "debit";
  createdAt: Date;
}

interface ReportSummary {
  grandTotal:      number;
  totalRecords:    number;
  averagePerEntry: number;
  byUser:     Record<string, { total: number; count: number }>;
  byDate:     Record<string, { total: number; count: number }>;
  byCategory: Record<string, { total: number; count: number }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmt     = (n: number | undefined | null) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

/** Convert string[] of IDs to mongoose ObjectId[] safely */
function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));
}

const IST = "Asia/Kolkata";

/**
 * Normalizes any stored date value (BSON Date, ISO String, YYYY-MM-DD, or fallback timestamp)
 * into a consistent calendar day string "YYYY-MM-DD" in Indian Standard Time (IST).
 */
function normalizeDate(val: any, fallbackDate?: any): string {
  if (!val && fallbackDate) val = fallbackDate;
  if (!val) return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    return DateTime.fromJSDate(val).setZone(IST).toISODate() || "";
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = DateTime.fromISO(s, { zone: IST });
  if (dt.isValid) return dt.toISODate() || "";
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return DateTime.fromJSDate(d).setZone(IST).toISODate() || "";
  }
  return s.length >= 10 ? s.slice(0, 10) : s;
}

// All expense category keys across all expense models (including contractor)
const ALL_EXPENSE_CATEGORIES = [
  "conveyance", "purchase", "food", "tea", "hotel", "labour",
  "contractor", "courier", "loading", "porter", "cartage", "rider",
  "dailyWages", "transport", "maintenance", "other",
] as const;

// ─── Fetch Expense Data ─────────────────────────────────────────────────────

async function fetchExpenseData(
  filters: ReportFilters,
  targetUserIds: string[],
  usersMap: Map<string, any>
): Promise<ExpenseItem[]> {
  const isUserFilterActive = targetUserIds.length > 0 && !targetUserIds.includes("all");
  const andClauses: any[] = [];

  // Robust user filter: matches createdBy whether stored as ObjectId, String, or embedded object
  if (isUserFilterActive) {
    const targetObjectIds = toObjectIds(targetUserIds);
    const targetKeys = [...targetObjectIds, ...targetUserIds];
    andClauses.push({
      $or: [
        { createdBy: { $in: targetKeys } },
        { "createdBy._id": { $in: targetKeys } },
      ],
    });
  }

  // Robust date filter: covers BSON Date, String "YYYY-MM-DD", ISO with time, and createdAt fallback
  if (filters.fromDate || filters.toDate) {
    const fromDay = filters.fromDate;
    const toDay = filters.toDate;
    const startJSDate = fromDay
      ? DateTime.fromISO(fromDay, { zone: IST }).startOf("day").toJSDate()
      : new Date(0);
    const endJSDate = toDay
      ? DateTime.fromISO(toDay, { zone: IST }).endOf("day").toJSDate()
      : new Date(8640000000000000);

    const dateConditions: any[] = [
      { date: { $gte: startJSDate, $lte: endJSDate } },
      { createdAt: { $gte: startJSDate, $lte: endJSDate } },
    ];

    if (fromDay && toDay) {
      dateConditions.push(
        { date: { $gte: fromDay, $lte: toDay } },
        { date: { $gte: fromDay, $lte: `${toDay}T23:59:59.999Z` } }
      );
    } else if (fromDay) {
      dateConditions.push({ date: { $gte: fromDay } });
    } else if (toDay) {
      dateConditions.push(
        { date: { $lte: toDay } },
        { date: { $lte: `${toDay}T23:59:59.999Z` } }
      );
    }

    andClauses.push({ $or: dateConditions });
  }

  const baseQuery: Record<string, unknown> = andClauses.length > 0 ? { $and: andClauses } : {};

  // Determine which expense models to query
  const expenseModelMap: Record<string, typeof TravelExpense> = {
    travel: TravelExpense,
    office: OfficeExpense,
    toPay:  ToPayExpense,
  };

  const rawExpenseType = filters.expenseType || "all";
  const modelsToQuery = rawExpenseType === "all"
    ? ["travel", "office", "toPay"]
    : rawExpenseType.split(",").map(s => s.trim()).filter(Boolean);

  // Which categories to look inside each document
  const categoriesToScan =
    filters.categories?.length
      ? filters.categories
      : [...ALL_EXPENSE_CATEGORIES];

  const results: ExpenseItem[] = [];

  for (const modelKey of modelsToQuery) {
    const Model = expenseModelMap[modelKey];
    if (!Model) continue;

    // Project only the needed category arrays + metadata
    const projection: Record<string, number> = {
      createdBy: 1,
      date:      1,
      createdAt: 1,
    };
    categoriesToScan.forEach(cat => { projection[cat] = 1; });

    let docs: any[];
    try {
      docs = await Model.find(baseQuery, projection).lean();
    } catch (err) {
      console.error(`[fetchExpenseData] Error querying ${modelKey}:`, err);
      continue;
    }

    for (const doc of docs) {
      const docDate = normalizeDate(doc.date, doc.createdAt);

      // Verify date range in IST
      if (filters.fromDate && docDate && docDate < filters.fromDate) continue;
      if (filters.toDate && docDate && docDate > filters.toDate) continue;

      const rawCreator = doc.createdBy;
      const creatorId =
        (typeof rawCreator === "object" && rawCreator?._id ? rawCreator._id.toString() : null) ||
        (rawCreator ? rawCreator.toString() : "");

      const user = usersMap.get(creatorId);
      const userName = user?.name || (typeof rawCreator === "object" && rawCreator?.name) || "Unknown";
      const userId = user?._id?.toString() || creatorId;

      if (isUserFilterActive && !targetUserIds.includes(userId)) {
        continue;
      }

      for (const category of categoriesToScan) {
        const items = doc[category];
        if (!Array.isArray(items) || items.length === 0) continue;

        for (const item of items) {
          // Status filter
          if (filters.status?.length && !filters.status.includes(String(item.status ?? ""))) {
            continue;
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

          results.push({
            _id:         String(item._id ?? ""),
            siteName:    String(item.siteName ?? item.serviceProvider ?? ""),
            amount:      Number(item.amount ?? 0),
            date:        docDate,
            category,
            description: String(item.description ?? item.todayWork ?? ""),
            userName,
            userId,
            status:      String(item.status ?? "pending"),
            createdAt:   new Date(item.createdAt || doc.createdAt || Date.now()),
            ledgerType:  item.ledgerType,
            tallyEntry:  item.tallyEntry,
            adminMessage: item.adminMessage,
            // Pass through extra fields for the table
            ...item,
          });
        }
      }
    }
  }

  return results;
}

// ─── Fetch Transaction Data (Credit / Debit) ────────────────────────────────

async function fetchTransactionData(
  filters: ReportFilters,
  targetUserIds: string[],
  type: "credit" | "debit",
  usersMap: Map<string, any>
): Promise<TransactionItem[]> {
  const isUserFilterActive = targetUserIds.length > 0 && !targetUserIds.includes("all");

  const userQuery: any = {};
  if (isUserFilterActive) {
    const targetObjectIds = toObjectIds(targetUserIds);
    const targetKeys = [...targetObjectIds, ...targetUserIds];
    userQuery._id = { $in: targetKeys };
  }

  let users: any[];
  try {
    users = await Users.find(
      userQuery,
      // Project only what we need — the specific credit/debit array + identity fields
      { _id: 1, name: 1, phone: 1, [type]: 1 }
    ).lean();
  } catch (err) {
    console.error(`[fetchTransactionData] Error querying users for ${type}:`, err);
    return [];
  }

  const results: TransactionItem[] = [];

  for (const user of users) {
    const entries: any[] = user[type] || [];
    const uId = user._id?.toString() || "";
    const uName = user.name || usersMap.get(uId)?.name || "Unknown";

    for (const entry of entries) {
      const details: any[] = entry.transactionDetails || [];

      for (const detail of details) {
        const rawDate = detail.createdAt || detail.updatedAt || detail.date;
        const detailDate = normalizeDate(rawDate);

        // Date filter in IST
        if (filters.fromDate && detailDate && detailDate < filters.fromDate) continue;
        if (filters.toDate && detailDate && detailDate > filters.toDate) continue;

        // Search filter
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const haystack = `${entry.name || ""} ${entry.phone || ""} ${detail.reason || ""} ${detail.remarks || ""}`.toLowerCase();
          if (!haystack.includes(q)) continue;
        }

        const createdAt = rawDate ? new Date(rawDate) : new Date();

        results.push({
          _id:       detail._id?.toString() || new mongoose.Types.ObjectId().toString(),
          name:      entry.name      || "",
          phone:     entry.phone     || "",
          money:     Number(detail.money  ?? 0),
          reason:    detail.reason   || "",
          remarks:   detail.remarks  || "",
          date:      detailDate || normalizeDate(createdAt),
          userName:  uName,
          userId:    uId,
          type,
          createdAt,
        });
      }
    }
  }

  return results;
}

// ─── Summary Calculator ─────────────────────────────────────────────────────

function calculateSummary(data: (ExpenseItem | TransactionItem)[]): ReportSummary {
  const summary: any = {
    grandTotal:      0,
    totalRecords:    data.length,
    averagePerEntry: 0,
    byUser:     {},
    byDate:     {},
    byCategory: {},
  };

  for (const item of data) {
    const amount = "money" in item ? item.money : item.amount;
    summary.grandTotal += amount;

    const uKey = item.userName;
    if (!summary.byUser[uKey]) summary.byUser[uKey] = { total: 0, count: 0 };
    summary.byUser[uKey].total += amount;
    summary.byUser[uKey].count++;

    const dKey = item.date;
    if (!summary.byDate[dKey]) summary.byDate[dKey] = { total: 0, count: 0 };
    summary.byDate[dKey].total += amount;
    summary.byDate[dKey].count++;

    if ("category" in item) {
      const cKey = item.category;
      if (!summary.byCategory[cKey]) summary.byCategory[cKey] = { total: 0, count: 0 };
      summary.byCategory[cKey].total += amount;
      summary.byCategory[cKey].count++;
    }
  }

  summary.averagePerEntry = data.length ? summary.grandTotal / data.length : 0;

  // Sort each group by total descending
  const sortDesc = (rec: Record<string, { total: number; count: number }>) =>
    Object.fromEntries(Object.entries(rec).sort((a, b) => b[1].total - a[1].total));

  summary.byUser     = sortDesc(summary.byUser);
  summary.byDate     = sortDesc(summary.byDate);
  summary.byCategory = sortDesc(summary.byCategory);

  return summary;
}

// ─── Sorting & Pagination ───────────────────────────────────────────────────

function sortData<T extends Record<string, any>>(
  data: T[],
  sortBy = "date",
  sortOrder: "asc" | "desc" = "desc"
): T[] {
  return [...data].sort((a, b) => {
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

function paginate<T>(data: T[], page: number, limit: number) {
  const total      = data.length;
  const totalPages = Math.ceil(total / limit);
  const start      = (page - 1) * limit;
  return {
    data: data.slice(start, start + limit),
    pagination: {
      page, limit, total, totalPages,
      hasNext: start + limit < total,
      hasPrev: page > 1,
    },
  };
}

// ─── Export Formatters ──────────────────────────────────────────────────────

function toCSV(data: (ExpenseItem | TransactionItem)[], reportType: ReportType): string {
  const isExpense = reportType === "expense";
  const headers = isExpense
    ? ["Date", "User", "Category", "Site/Party", "Amount", "Description", "Status"]
    : ["Date", "User", "Party", "Amount", "Reason", "Remarks", "Type"];
  const rows = data.map((item: any) =>
    isExpense
      ? [item.date, item.userName, item.category, item.siteName, item.amount, item.description || "", item.status]
      : [item.date, item.userName, item.name, item.money, item.reason, item.remarks || "", item.type]
  );
  return stringify([headers, ...rows], { header: false });
}

function toExcel(data: (ExpenseItem | TransactionItem)[], reportType: ReportType): Buffer {
  const isExpense = reportType === "expense";
  const rows = isExpense
    ? [
        ["Date", "User", "Category", "Site/Party", "Amount", "Description", "Status"],
        ...data.map((item: any) => [item.date, item.userName, item.category, item.siteName, item.amount, item.description || "", item.status]),
      ]
    : [
        ["Date", "User", "Party", "Amount", "Reason", "Remarks", "Type"],
        ...data.map((item: any) => [item.date, item.userName, item.name, item.money, item.reason, item.remarks || "", item.type]),
      ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 15 }, { wch: 28 }, { wch: 12 }, { wch: 40 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

async function toPDF(
  data: (ExpenseItem | TransactionItem)[],
  reportType: ReportType,
  summary: ReportSummary
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", chunk => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(18).font("Helvetica-Bold").text("Financial Report", { align: "center" });
  doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString("en-IN")}`, { align: "center" });
  doc.moveDown();

  // Summary section
  doc.fontSize(11).font("Helvetica-Bold").text("Summary");
  doc.fontSize(10).font("Helvetica");
  doc.text(`Grand Total: ${fmt(summary.grandTotal)}`);
  doc.text(`Total Records: ${summary.totalRecords}`);
  doc.text(`Average per Entry: ${fmt(summary.averagePerEntry)}`);
  doc.moveDown();

  // Table headers
  const isExpense = reportType === "expense";
  const headers = isExpense
    ? ["Date", "User", "Category", "Amount", "Description"]
    : ["Date", "User", "Party", "Amount", "Reason"];

  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9);
  headers.forEach((h, i) => doc.text(h, 50 + i * 100, y, { width: 95 }));
  y += 18;
  doc.moveTo(40, y).lineTo(555, y).stroke();
  y += 6;

  doc.font("Helvetica").fontSize(9);
  for (const item of data.slice(0, 100)) {
    if (y > 740) { doc.addPage(); y = 50; }
    const row: string[] = isExpense
      ? [
          (item as ExpenseItem).date,
          item.userName,
          (item as ExpenseItem).category,
          fmt((item as ExpenseItem).amount),
          ((item as ExpenseItem).description || "").slice(0, 30),
        ]
      : [
          (item as TransactionItem).date,
          item.userName,
          (item as TransactionItem).name,
          fmt((item as TransactionItem).money),
          ((item as TransactionItem).reason || "").slice(0, 30),
        ];
    row.forEach((cell, i) => doc.text(cell, 50 + i * 100, y, { width: 95 }));
    y += 14;
  }

  doc.end();
  return done;
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await ensureDB();

    // Auth
    const userHeader = req.headers.get("user");
    if (!userHeader) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "No user header" }, { status: 401 });
    }
    const authUser = JSON.parse(userHeader);
    if (!["admin", "manager"].includes(authUser?.role)) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "Access denied" }, { status: 401 });
    }

    // Parse query params
    const sp = req.nextUrl.searchParams;

    const filters: ReportFilters = {
      reportType:     (sp.get("reportType")  as ReportType)     || "expense",
      expenseType:    (sp.get("expenseType") as ReportFilters["expenseType"]) || "all",
      fromDate:       sp.get("fromDate")  || undefined,
      toDate:         sp.get("toDate")    || undefined,
      // support repeated ?user=id1&user=id2 or comma-separated ?user=id1,id2
      users:          sp.getAll("user").flatMap(u => u.split(",")).filter(Boolean),
      status:         sp.get("status")?.split(",").map(s => s.trim()).filter(Boolean)    || undefined,
      categories:     sp.get("categories")?.split(",").map(c => c.trim()).filter(Boolean) || undefined,
      search:         sp.get("search") || undefined,
      groupBy:        (sp.get("groupBy")   as GroupBy)      || "none",
      sortBy:         sp.get("sortBy")    || "date",
      sortOrder:      (sp.get("sortOrder") as "asc" | "desc") || "desc",
      page:           Math.max(1, parseInt(sp.get("page")  || "1",   10)),
      limit:          Math.min(parseInt(sp.get("limit") || "100", 10), 1000),
      format:         (sp.get("format") as ExportFormat) || "json",
      includeSummary: sp.get("includeSummary") !== "false",
    };

    console.log("[Report API] filters:", JSON.stringify(filters, null, 2));

    // Pre-fetch all users for reliable userName and userId resolution
    const allUsers = await Users.find({}, { _id: 1, name: 1, phone: 1, role: 1 }).lean();
    const usersMap = new Map<string, any>();
    allUsers.forEach((u: any) => {
      usersMap.set(u._id.toString(), u);
    });

    const targetUserIds = (filters.users || []).filter(u => u !== "all" && u.trim() !== "");

    if (allUsers.length === 0) {
      return NextResponse.json({
        type: "SUCCESS", message: "No users found",
        data: [], summary: { grandTotal: 0, totalRecords: 0, averagePerEntry: 0, byUser: {}, byDate: {}, byCategory: {} },
        pagination: { page: 1, limit: filters.limit!, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
        filters,
      }, { status: 200 });
    }

    console.log(`[Report API] querying with userFilter=${targetUserIds.length ? targetUserIds.join(",") : "all"}, type=${filters.reportType}`);

    // Fetch data based on report type
    let rawData: (ExpenseItem | TransactionItem)[] = [];

    if (filters.reportType === "expense") {
      rawData = await fetchExpenseData(filters, targetUserIds, usersMap);
    } else if (filters.reportType === "credit") {
      rawData = await fetchTransactionData(filters, targetUserIds, "credit", usersMap);
    } else if (filters.reportType === "debit") {
      rawData = await fetchTransactionData(filters, targetUserIds, "debit", usersMap);
    } else if (filters.reportType === "combined") {
      const [expenses, credits, debits] = await Promise.all([
        fetchExpenseData(filters, targetUserIds, usersMap),
        fetchTransactionData(filters, targetUserIds, "credit", usersMap),
        fetchTransactionData(filters, targetUserIds, "debit", usersMap),
      ]);
      rawData = [...expenses, ...credits, ...debits];
    }

    console.log(`[Report API] fetched ${rawData.length} raw records`);

    // Sort
    const sorted = sortData(rawData, filters.sortBy, filters.sortOrder);

    // Summary
    const summary = filters.includeSummary
      ? calculateSummary(sorted)
      : { grandTotal: 0, totalRecords: 0, averagePerEntry: 0, byUser: {}, byDate: {}, byCategory: {} };

    // Paginate
    const { data: paged, pagination } = paginate(sorted, filters.page!, filters.limit!);

    // Export formats
    if (filters.format !== "json") {
      const ts  = new Date().toISOString().split("T")[0];
      let buffer: any;
      let contentType: string;
      let filename: string;

      switch (filters.format) {
        case "csv":
          buffer      = Buffer.from(toCSV(paged, filters.reportType));
          contentType = "text/csv";
          filename    = `report_${filters.reportType}_${ts}.csv`;
          break;
        case "excel":
          buffer      = toExcel(paged, filters.reportType);
          contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename    = `report_${filters.reportType}_${ts}.xlsx`;
          break;
        case "pdf":
          buffer      = await toPDF(paged, filters.reportType, summary);
          contentType = "application/pdf";
          filename    = `report_${filters.reportType}_${ts}.pdf`;
          break;
        default:
          buffer      = Buffer.from(JSON.stringify({ data: paged, summary, pagination }));
          contentType = "application/json";
          filename    = `report_${filters.reportType}_${ts}.json`;
      }

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":        contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control":       "no-cache, no-store, must-revalidate",
        },
      });
    }

    return NextResponse.json(
      { type: "SUCCESS", message: "Report generated successfully", data: paged, summary, pagination, filters },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("[Report API] Unhandled error:", error);
    return NextResponse.json(
      {
        type: "ERROR",
        message: error.message || "Failed to generate report",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensureDB();

    const userHeader = req.headers.get("user");
    if (!userHeader) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "No user header" }, { status: 401 });
    }
    
    const authUser = JSON.parse(userHeader);
    if (!["admin", "manager"].includes(authUser?.role)) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "Access denied" }, { status: 401 });
    }

    const body = await req.json();
    const { action, reportIds, email, format, reportData, columns, reportType } = body as {
      action: string;
      reportIds?: string[];
      email?: string;
      format?: "excel" | "pdf";
      reportData?: ReportItem[];
      columns?: { key: string; label: string }[];
      reportType?: string;
    };

    console.log("[Report POST] action:", action, "format:", format, "email:", email);

    if (action === "email" && email && format && reportData?.length && columns) {
      // Generate attachment based on format
      let attachmentBuffer: Buffer;
      let filename: string;
      let contentType: string;

      if (format === "excel") {
        attachmentBuffer = generateExcelBuffer(reportData, columns);
        filename = `report_${reportType}_${new Date().toISOString().split("T")[0]}.xlsx`;
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else {
        attachmentBuffer = await generatePdfBuffer(reportData, columns, `${reportType} Report`);
        filename = `report_${reportType}_${new Date().toISOString().split("T")[0]}.pdf`;
        contentType = "application/pdf";
      }

      // Send email
      await sendReportEmail({
        to: email.trim(),
        subject: `📊 ${reportType?.toUpperCase()} Report - ${new Date().toLocaleDateString("en-IN")}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Report Ready</h2>
            <p>Your requested <strong>${reportType}</strong> report is attached.</p>
            <ul>
              <li><strong>Records:</strong> ${reportData.length}</li>
              <li><strong>Generated:</strong> ${new Date().toLocaleString("en-IN")}</li>
              <li><strong>Format:</strong> ${format.toUpperCase()}</li>
            </ul>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              This is an automated message from Office Pulse. Please do not reply.
            </p>
          </div>
        `,
        attachmentBuffer,
        filename,
        contentType,
      });

      return NextResponse.json({
        type: "SUCCESS",
        message: `Report sent to ${email}`,
        filename,
      });
    }

    return NextResponse.json({ type: "BAD_REQUEST", message: "Invalid action or missing parameters" }, { status: 400 });
    
  } catch (error: any) {
    console.error("[Report POST] Error:", error);
    return NextResponse.json({ 
      type: "ERROR", 
      message: error.message || "Server error",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, { status: 500 });
  }
}