// @app/(dashboard)/reports/page.tsx
"use client";
import React, { useState, useMemo, useEffect, useCallback, use } from "react";
import Sidebar from "@app/_components/Sidebar";
import { toast } from "react-toastify";
import DatePicker from "antd/es/date-picker";
import Select from 'antd/es/select';
import Checkbox from "antd/es/checkbox";
import dayjs, { type Dayjs } from "dayjs";
import EmailReportModal from "@app/_components/reports/Email";

import {
  useGetReportQuery,
  useGetReportUsersQuery,
  useReportSearch,
  type ReportFilters,
  type ReportType,
  type ReportItem,
  type ExpenseItem,
  type TransactionItem,
  type ExpenseType,
  type ExpenseCategory,
  type ExpenseStatus,
} from "@app/_api_query/report.api";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  def: boolean;
  group: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const REPORT_TYPES: any = {
  expense: { label: "Expense", icon: "📊" },
  credit: { label: "Credit", icon: "💳" },
  debit: { label: "Debit", icon: "🧾" },
  combined: { label: "Combined", icon: "📈" },
};

const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "conveyance", label: "Conveyance" },
  { key: "purchase", label: "Purchase" },
  { key: "food", label: "Food" },
  { key: "tea", label: "Tea" },
  { key: "hotel", label: "Hotel" },
  { key: "labour", label: "Labour" },
  { key: "contractor", label: "Contractor" },
  { key: "courier", label: "Courier" },
  { key: "loading", label: "Loading" },
  { key: "porter", label: "Porter" },
  { key: "rider", label: "Rider" },
  { key: "maintenance", label: "Maintenance" },
  { key: "other", label: "Other" },
  { key: "transport", label: "Transport" },
  { key: "cartage", label: "Cartage" },
  { key: "dailyWages", label: "Daily Wages" },
];

const EXPENSE_FIELDS_WITH_CAT: FieldDef[] = [
  { key: "date", label: "Date", def: true, group: "Identifiers" },
  { key: "userName", label: "User", def: true, group: "Identifiers" },
  { key: "siteName", label: "Site/Party", def: true, group: "Details" },
  { key: "category", label: "Category", def: true, group: "Details" },
  { key: "amount", label: "Amount", def: true, group: "Amounts" },
  { key: "description", label: "Description", def: false, group: "Details" },
  { key: "status", label: "Status", def: true, group: "Meta" },
  { key: "createdAt", label: "Created At", def: false, group: "Meta" },
];

const TRANSACTION_FIELDS: FieldDef[] = [
  { key: "date", label: "Date", def: true, group: "Identifiers" },
  { key: "userName", label: "User", def: true, group: "Identifiers" },
  { key: "name", label: "Party", def: true, group: "Details" },
  { key: "money", label: "Amount", def: true, group: "Amounts" },
  { key: "reason", label: "Reason", def: true, group: "Details" },
  { key: "remarks", label: "Remarks", def: false, group: "Details" },
  { key: "type", label: "Type", def: true, group: "Meta" },
];

const AMT_KEYS = new Set(["amount", "money"]);
const STATUS_OPTIONS: ExpenseStatus[] = ["pending", "approved", "rejected"];
const EXPENSE_TYPE_OPTIONS: { key: ExpenseType; label: string }[] = [
  { key: "all", label: "All Types" },
  { key: "office", label: "Office" },
  { key: "travel", label: "Travel" },
  { key: "toPay", label: "To Pay" },
];
const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const LIMIT_OPTIONS = [25, 50, 100, 200, 500];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | undefined | null) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const fmtRaw = (n: number | undefined | null) => Math.round(n || 0);
const fmtD = (d: Date | string | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const isoD = (d: Date | string | undefined) =>
  d ? new Date(d).toISOString().split("T")[0] : undefined;

const addDays = (d: Date, n: number): Date => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOf = (d: Date): Date => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const endOf = (d: Date): Date => { const r = new Date(d); r.setHours(23, 59, 59, 999); return r; };
const startOfMonth = (d: Date): Date => { const r = new Date(d); r.setDate(1); r.setHours(0, 0, 0, 0); return r; };

function resolvePreset(preset: string): { from: Date; to: Date } | null {
  const today = startOf(new Date());
  switch (preset) {
    case "today": return { from: today, to: endOf(new Date()) };
    case "yesterday": { const y = addDays(today, -1); return { from: y, to: endOf(y) }; }
    case "7days": return { from: addDays(today, -6), to: endOf(new Date()) };
    case "30days": return { from: addDays(today, -29), to: endOf(new Date()) };
    case "thisMonth": return { from: startOfMonth(today), to: endOf(new Date()) };
    case "lastMonth": {
      const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lme = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: startOf(lm), to: endOf(lme) };
    }
    default: return null;
  }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-teal-50 text-teal-700 border-teal-100",
    rejected: "bg-rose-50 text-rose-700 border-rose-100",
    pending: "bg-amber-50 text-amber-700 border-amber-100",
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${map[status] ?? "bg-slate-50 text-slate-600 border-slate-100"}`}>
      {status}
    </span>
  );
}

// ─── Summary View ─────────────────────────────────────────────────────────────
function SummaryView({ data, reportType, groupBy }: {
  data: ReportItem[]; reportType: ReportType; groupBy: "user" | "date" | "category";
}) {
  const grandTotal = useMemo(
    () => data.reduce((s: any, r) => s + (("money" in r ? r.money : (r as ExpenseItem).amount) || 0), 0),
    [data]
  );
  const groups = useMemo(() => {
    const map: Record<string, { label: string; total: number; count: number }> = {};
    data.forEach((row: any) => {
      const key = groupBy === "user" ? row.userName : groupBy === "date" ? row.date :
        "category" in row ? row.category : (row as TransactionItem).type;
      if (!map[key]) map[key] = { label: key, total: 0, count: 0 };
      map[key].total += (("money" in row ? row.money : (row as ExpenseItem).amount) || 0);
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [data, groupBy]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Grand Total", value: fmt(grandTotal), dark: true },
          { label: "Records", value: data.length.toLocaleString(), dark: false },
          { label: "Avg / Entry", value: fmt(data.length ? grandTotal / data.length : 0), dark: false },
        ].map((m, i) => (
          <div key={i} className={`rounded-xl p-3 sm:p-4 ${m.dark ? "bg-purple-900" : "bg-white border border-slate-100"}`}>
            <p className="text-[10px] font-semibold mb-0.5 text-slate-400">{m.label}</p>
            <p className={`text-sm sm:text-base font-bold leading-tight truncate ${m.dark ? "text-white" : "text-slate-800"}`}>{m.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Breakdown by {groupBy === "user" ? "User" : groupBy === "date" ? "Date" : "Category"}
          </p>
        </div>
        <div className="divide-y divide-slate-50 max-h-[60vh] overflow-auto hide-scrollbar">
          {groups.map((g, i) => (
            <div key={i} className="px-3 sm:px-4 py-3 flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">{g.label}</p>
                <p className="text-[10px] text-slate-400">{g.count} records</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs sm:text-sm font-bold text-slate-800">{fmt(g.total)}</p>
                <div className="h-1 rounded-full bg-slate-100 w-14 sm:w-20 mt-1 ml-auto">
                  <div className="h-1 rounded-full bg-amber-400" style={{ width: `${grandTotal ? Math.round((g.total / grandTotal) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="px-4 py-6 text-center text-xs text-slate-400">No data</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Data Table ───────────────────────────────────────────────────────────────
function DataTable({
  data, fieldDefs, fields, isFetching, isExpenseType, visibleCategories,
}: {
  data: ReportItem[]; fieldDefs: FieldDef[]; fields: Record<string, boolean>;
  isFetching: boolean; isExpenseType: boolean; visibleCategories: ExpenseCategory[];
}) {
  const visibleBaseFields = useMemo(() => {
    if (!isExpenseType) return fieldDefs.filter(f => fields[f.key]);
    return fieldDefs.filter(f => fields[f.key] && f.key !== "category");
  }, [fieldDefs, fields, isExpenseType]);

  const categoryLabels = useMemo(
    () => EXPENSE_CATEGORIES.filter(c => visibleCategories.includes(c.key)),
    [visibleCategories]
  );

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    visibleBaseFields.forEach(f => {
      if (AMT_KEYS.has(f.key)) {
        t[f.key] = (data as any[]).reduce((s, r) => s + (Number(r[f.key]) || 0), 0);
      }
    });
    if (isExpenseType) {
      categoryLabels.forEach(cat => {
        t[cat.key] = (data as any[]).reduce((s, r) =>
          r.category === cat.key ? s + (r.amount || 0) : s, 0);
      });
    }
    return t;
  }, [data, visibleBaseFields, isExpenseType, categoryLabels]);

  const totalCols = visibleBaseFields.length + (isExpenseType ? categoryLabels.length : 0);

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl p-10 text-center">
        <p className="text-sm font-semibold text-slate-500">No records found</p>
        <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-xl">
      {isFetching && <div className="h-0.5 bg-teal-400 animate-pulse w-full" />}
      <div className="overflow-x-auto max-h-[70vh] overflow-auto hide-scrollbar">
        <table
          className="text-xs w-full border-collapse"
          style={{ minWidth: Math.max(totalCols * 120 + 50, 400) }}
        >
          <thead className="sticky top-0 z-20">
            <tr className="bg-purple-900">
              <th className="px-3 py-2.5 text-left text-white font-semibold w-8 sticky left-0 bg-purple-900 z-30">S.No</th>
              {visibleBaseFields.map(f => (
                <th key={f.key} className="px-3 py-2.5 text-left text-white font-semibold whitespace-nowrap">
                  {f.label}
                </th>
              ))}
              {isExpenseType && categoryLabels.map(cat => (
                <th key={cat.key} className="px-3 py-2.5 text-right text-amber-300 font-semibold whitespace-nowrap border-l border-slate-700">
                  {cat.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-50">
            {(data as any[]).map((row, i) => (
              <tr key={row._id || i} className="hover:bg-amber-50/30 transition-colors">
                <td className="px-3 py-2 text-slate-400 sticky left-0 bg-white z-10 border-r border-slate-50">{i + 1}</td>
                {visibleBaseFields.map(f => {
                  const v = row[f.key];
                  const isAmt = AMT_KEYS.has(f.key);
                  if (f.key === "status") {
                    return <td key={f.key} className="px-3 py-2"><StatusBadge status={String(v || "pending")} /></td>;
                  }
                  if (f.key === "createdAt" && v) {
                    return <td key={f.key} className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtD(v)}</td>;
                  }
                  return (
                    <td key={f.key} className={`px-3 py-2 whitespace-nowrap ${isAmt ? "text-right font-semibold text-slate-700" : "text-slate-600"}`}>
                      {isAmt
                        ? (v ? fmt(Number(v)) : <span className="text-slate-200">—</span>)
                        : (v != null && v !== "" ? String(v) : <span className="text-slate-200">—</span>)}
                    </td>
                  );
                })}
                {isExpenseType && categoryLabels.map(cat => {
                  const match = row.category === cat.key;
                  const amt = match ? (row.amount ?? null) : null;
                  return (
                    <td key={cat.key} className="px-3 py-2 text-right font-semibold text-slate-700 border-l border-slate-50 whitespace-nowrap">
                      {amt != null ? fmt(Number(amt)) : <span className="text-slate-200">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

          <tfoot className="sticky bottom-0 z-20">
            <tr className="bg-purple-900 border-t-2 border-slate-600">
              <td className="px-3 py-2.5 sticky left-0 bg-purple-900 z-30 text-[10px] font-bold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                Total
              </td>
              {visibleBaseFields.map(f => {
                const isAmt = AMT_KEYS.has(f.key);
                return (
                  <td key={f.key} className={`px-3 py-2.5 whitespace-nowrap ${isAmt ? "text-right font-bold text-white text-xs" : ""}`}>
                    {isAmt ? fmt(totals[f.key] ?? 0) : ""}
                  </td>
                );
              })}
              {isExpenseType && categoryLabels.map(cat => (
                <td key={cat.key} className="px-3 py-2.5 text-right font-bold text-amber-300 text-xs border-l border-slate-700 whitespace-nowrap">
                  {(totals[cat.key] ?? 0) > 0 ? fmt(totals[cat.key]) : <span className="text-slate-500 font-normal">—</span>}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Client-side Excel generator ──────────────────────────────────────────────
async function generateExcel(
  data: any[],
  visibleBaseFields: FieldDef[],
  isExpenseType: boolean,
  categoryLabels: { key: string; label: string }[],
  reportType: string,
  fromDate: Date | undefined,
  toDate: Date | undefined,
) {
  const XLSX = await import("xlsx");

  const headers = [
    "#",
    ...visibleBaseFields.map(f => f.label),
    ...(isExpenseType ? categoryLabels.map(c => c.label) : []),
  ];

  const rows = data.map((row, i) => {
    const base = visibleBaseFields.map(f => {
      const v = row[f.key];
      if (AMT_KEYS.has(f.key)) return v ? fmtRaw(Number(v)) : 0;
      if (f.key === "createdAt" && v) return fmtD(v);
      if (v == null || v === "") return "";
      return String(v);
    });
    const cats = isExpenseType ? categoryLabels.map(cat =>
      row.category === cat.key ? fmtRaw(row.amount) : 0
    ) : [];
    return [i + 1, ...base, ...cats];
  });

  const totalsRow = [
    "Total",
    ...visibleBaseFields.map(f =>
      AMT_KEYS.has(f.key) ? data.reduce((s, r) => s + (Number(r[f.key]) || 0), 0) : ""
    ),
    ...(isExpenseType ? categoryLabels.map(cat =>
      data.reduce((s, r) => r.category === cat.key ? s + (r.amount || 0) : s, 0)
    ) : []),
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalsRow]);
  ws["!cols"] = headers.map((h, idx) =>
    idx === 0 ? { wch: 5 } : { wch: Math.max(String(h).length + 4, 14) }
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${reportType} Report`);
  XLSX.writeFile(wb, `report_${reportType}_${isoD(fromDate) ?? "all"}_to_${isoD(toDate) ?? "all"}.xlsx`);
}

const cleanNumber = (v: unknown): number => {
  if (v == null || v === "" || v === "—") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const cleaned = String(v).replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

// ─── Client-side PDF generator ────────────────────────────────────────────────
async function generatePdf(
  data: any[],
  visibleBaseFields: FieldDef[],
  isExpenseType: boolean,
  categoryLabels: { key: string; label: string }[],
  reportType: string,
  fromDate: Date | undefined,
  toDate: Date | undefined,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const pdfNum = (n: number) => Math.round(n).toString();

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(`${REPORT_TYPES[reportType]?.label ?? reportType} Report`, 14, 14);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Date: ${fmtD(fromDate)} to ${fmtD(toDate)}   |   Records: ${data.length}   |   Generated: ${new Date().toLocaleString("en-IN")}`,
    14, 20
  );

  const head = [[
    "S.N",
    ...visibleBaseFields.map(f => f.label.slice(0, 4)),
    ...(isExpenseType ? categoryLabels.map(c => c.label.slice(0, 4)) : []),
  ]];

  const body = data.map((row, i) => {
    const base = visibleBaseFields.map(f => {
      const v = row[f.key];
      if (AMT_KEYS.has(f.key)) return v ? pdfNum(Number(v)) : "—";
      if (f.key === "createdAt" && v) return fmtD(v);
      if (v == null || v === "") return "—";
      return String(v);
    });
    const cats = isExpenseType ? categoryLabels.map(cat =>
      row.category === cat.key && row.amount ? pdfNum(row.amount) : "—"
    ) : [];
    return [String(i + 1), ...base, ...cats];
  });

  const totalRow = [
    "Tot",
    ...visibleBaseFields.map(f =>
      AMT_KEYS.has(f.key)
        ? pdfNum(data.reduce((s, r) => s + cleanNumber(r[f.key]), 0))
        : ""
    ),
    ...(isExpenseType
      ? categoryLabels.map(cat => {
        const t = data.reduce((s, r) => r.category === cat.key ? s + cleanNumber(r.amount) : s, 0);
        return t > 0 ? pdfNum(t) : "—";
      })
      : []),
  ];

  autoTable(doc, {
    startY: 25,
    head,
    body: [...body, totalRow],
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 7 },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.row.index === body.length) {
        hookData.cell.styles.fillColor = [30, 41, 59];
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = "bold";
      }
      const col = hookData.column.index;
      const isAmtCol = col > 0 && col <= visibleBaseFields.length &&
        AMT_KEYS.has(visibleBaseFields[col - 1]?.key ?? "");
      const isCatCol = isExpenseType && col > visibleBaseFields.length;
      if (isAmtCol || isCatCol) hookData.cell.styles.halign = "right";
    },
    columnStyles: { 0: { cellWidth: 8 } },
    margin: { top: 25, left: 14, right: 14 },
    tableWidth: "auto",
  });

  doc.save(`report_${reportType}_${isoD(fromDate) ?? "all"}_to_${isoD(toDate) ?? "all"}.pdf`);
}

// ─── Download Buttons ─────────────────────────────────────────────────────────
function DownloadButtons({
  data, visibleBaseFields, isExpenseType, visibleCategories,
  reportType, fromDate, toDate, disabled,
}: {
  data: any[];
  visibleBaseFields: FieldDef[];
  isExpenseType: boolean;
  visibleCategories: ExpenseCategory[];
  reportType: ReportType;
  fromDate: Date | undefined;
  toDate: Date | undefined;
  disabled?: boolean;
}) {
  const [xlLoading, setXlLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const categoryLabels = useMemo(
    () => EXPENSE_CATEGORIES.filter(c => visibleCategories.includes(c.key)),
    [visibleCategories]
  );

  const handleExcel = async () => {
    if (disabled || xlLoading || !data.length) return;
    setXlLoading(true);
    try {
      await generateExcel(data, visibleBaseFields, isExpenseType, categoryLabels, reportType, fromDate, toDate);
      toast.success("Excel downloaded");
    } catch (e: any) { toast.error(e?.message || "Excel failed"); }
    finally { setXlLoading(false); }
  };

  const handlePdf = async () => {
    if (disabled || pdfLoading || !data.length) return;
    setPdfLoading(true);
    try {
      await generatePdf(data, visibleBaseFields, isExpenseType, categoryLabels, reportType, fromDate, toDate);
      toast.success("PDF downloaded");
    } catch (e: any) { toast.error(e?.message || "PDF failed"); }
    finally { setPdfLoading(false); }
  };

  return (
    <>
      <button onClick={handleExcel} disabled={disabled || xlLoading || !data.length}
        className="relative inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden select-none">
        {xlLoading ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="hidden sm:inline">Preparing…</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h2.5l1.5 2.5 1.5-2.5H16l-2.5 4 2.5 4h-2.5L12 18.5 10.5 21H8l2.5-4L8 13z" />
            </svg>
            <span className="hidden sm:inline">↓ Excel</span>
            <span className="sm:hidden">↓ XLS</span>
          </>
        )}
      </button>

      <button onClick={handlePdf} disabled={disabled || pdfLoading || !data.length}
        className="relative inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-purple-900 text-white rounded-lg font-bold hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden select-none">
        {pdfLoading ? (
          <>
            <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="hidden sm:inline">Generating…</span>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14a2 2 0 002 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
            </svg>
            <span className="hidden sm:inline">↓ PDF</span>
            <span className="sm:hidden">↓ PDF</span>
          </>
        )}
      </button>
    </>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
interface FilterPanelProps {
  reportType: ReportType; setReportType: (t: ReportType) => void;
  expenseTypes: ExpenseType[]; toggleExpenseType: (t: ExpenseType) => void;
  datePreset: string; setDatePreset: (p: string) => void;
  fromDate: Date | undefined; toDate: Date | undefined;
  setFromDate: (d: Date | undefined) => void; setToDate: (d: Date | undefined) => void;
  selectedUsers: string[]; setSelectedUsers: (u: string[]) => void;
  usersData: Array<{ _id: string; name: string; type: string }>; usersLoading: boolean;
  status: ExpenseStatus[]; toggleStatus: (s: ExpenseStatus) => void;
  selectedCategories: ExpenseCategory[]; toggleCategory: (c: ExpenseCategory) => void;
  visibleCategories: ExpenseCategory[]; toggleVisibleCategory: (c: ExpenseCategory) => void;
  fields: Record<string, boolean>; setFields: (f: Record<string, boolean>) => void;
  toggleField: (k: string) => void; fieldDefs: FieldDef[]; fieldGroups: Record<string, FieldDef[]>;
  dataCount: number; onClose?: () => void;
}

function FilterPanel({
  reportType, setReportType, expenseTypes, toggleExpenseType,
  datePreset, setDatePreset, fromDate, toDate, setFromDate, setToDate,
  selectedUsers, setSelectedUsers, usersData, usersLoading,
  status, toggleStatus, selectedCategories, toggleCategory,
  visibleCategories, toggleVisibleCategory,
  fields, setFields, toggleField, fieldDefs, fieldGroups,
  dataCount, onClose,
}: FilterPanelProps) {
  const isExpense = reportType === "expense" || reportType === "combined";
  const userOptions = useMemo(() => usersData.map(u => ({ label: u.name, value: u._id, type: u.type })), [usersData]);

  return (
    <div className="space-y-5">
      <div>
        <p className="filter-section-label">Report Type</p>
        <div className="space-y-0.5">
          {(Object.entries(REPORT_TYPES) as [ReportType, { label: string; icon: string }][]).map(([key, cfg]) => (
            <button key={key} onClick={() => { setReportType(key); onClose?.(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${reportType === key ? "bg-purple-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              <span className="text-base">{cfg.icon}</span>{cfg.label}
              {reportType === key && <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-bold">{dataCount}</span>}
            </button>
          ))}
        </div>
      </div>

      {isExpense && (
        <div>
          <p className="filter-section-label">Expense Type</p>
          <div className="space-y-1.5 px-1">
            {EXPENSE_TYPE_OPTIONS.map(opt => (
              <Checkbox key={opt.key} checked={expenseTypes.includes(opt.key)} onChange={() => toggleExpenseType(opt.key)} className="!text-xs !text-slate-700">{opt.label}</Checkbox>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="filter-section-label">Date Range</p>
        <Select value={datePreset} onChange={(val: string) => {
          setDatePreset(val);
          if (val !== "custom") { const r = resolvePreset(val); if (r) { setFromDate(r.from); setToDate(r.to); } }
        }} options={DATE_PRESETS} className="w-full mb-2" size="small" />
        {datePreset === "custom" && (
          <DatePicker.RangePicker
            value={[fromDate ? dayjs(fromDate) : null, toDate ? dayjs(toDate) : null]}
            onChange={(dates: [Dayjs | null, Dayjs | null] | null) => {
              setFromDate(dates?.[0] ? startOf(dates[0].toDate()) : undefined);
              setToDate(dates?.[1] ? endOf(dates[1].toDate()) : undefined);
            }} size="small" className="w-full"
            disabledDate={(cur: any) => cur && cur > dayjs().endOf("day")} format="DD MMM YYYY" />
        )}
        {datePreset !== "custom" && fromDate && toDate && (
          <p className="text-[10px] text-slate-400 mt-1 px-1">{fmtD(fromDate)} → {fmtD(toDate)}</p>
        )}
      </div>

      <div>
        <p className="filter-section-label">Users</p>
        {usersLoading ? <p className="text-xs text-slate-400 py-1">Loading users…</p> : (
          <Select mode="multiple" placeholder="All users"
            value={selectedUsers.filter(u => u !== "all")}
            onChange={(vals: string[]) => setSelectedUsers(vals.length ? vals : ["all"])}
            options={userOptions} className="w-full" size="small" maxTagCount="responsive" allowClear
            filterOption={(input: any, opt: any) => String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            optionRender={(opt: any) => (
              <div>
                <p className="text-xs font-medium leading-tight">{opt.label}</p>
                <p className="text-[10px] text-slate-400 capitalize">{(opt as any).type}</p>
              </div>
            )} />
        )}
      </div>

      {isExpense && (
        <div>
          <p className="filter-section-label">Status</p>
          <div className="flex flex-wrap gap-1.5 px-1">
            {STATUS_OPTIONS.map(s => (
              <button key={s} onClick={() => toggleStatus(s)}
                className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-all ${status.includes(s)
                  ? s === "approved" ? "bg-teal-600 text-white border-teal-600"
                    : s === "rejected" ? "bg-rose-600 text-white border-rose-600"
                      : "bg-amber-500 text-white border-amber-500"
                  : "text-slate-600 border-slate-200 hover:border-slate-400 bg-white"}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {isExpense && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="filter-section-label !mb-0">Filter by Category</p>
            <div className="flex gap-2">
              <button onClick={() => EXPENSE_CATEGORIES.forEach(c => !selectedCategories.includes(c.key) && toggleCategory(c.key))} className="text-[10px] text-teal-600 font-bold hover:underline">All</button>
              <span className="text-slate-200 text-xs">·</span>
              <button onClick={() => EXPENSE_CATEGORIES.forEach(c => selectedCategories.includes(c.key) && toggleCategory(c.key))} className="text-[10px] text-slate-400 font-bold hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-1">
            {EXPENSE_CATEGORIES.map(cat => (
              <Checkbox key={cat.key} checked={selectedCategories.includes(cat.key)} onChange={() => toggleCategory(cat.key)} className="!text-[11px] !text-slate-600">{cat.label}</Checkbox>
            ))}
          </div>
        </div>
      )}

      {isExpense && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="filter-section-label !mb-0">Category Columns</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Show as separate table columns</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => EXPENSE_CATEGORIES.forEach(c => !visibleCategories.includes(c.key) && toggleVisibleCategory(c.key))} className="text-[10px] text-teal-600 font-bold hover:underline">All</button>
              <span className="text-slate-200 text-xs">·</span>
              <button onClick={() => EXPENSE_CATEGORIES.forEach(c => visibleCategories.includes(c.key) && toggleVisibleCategory(c.key))} className="text-[10px] text-slate-400 font-bold hover:underline">None</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-1">
            {EXPENSE_CATEGORIES.map(cat => (
              <Checkbox key={cat.key} checked={visibleCategories.includes(cat.key)} onChange={() => toggleVisibleCategory(cat.key)} className="!text-[11px] !text-amber-700">{cat.label}</Checkbox>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 mt-2 px-1">{visibleCategories.length} column{visibleCategories.length !== 1 ? "s" : ""} visible</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="filter-section-label !mb-0">Table Fields</p>
          <div className="flex gap-2">
            <button onClick={() => setFields(Object.fromEntries(fieldDefs.map(f => [f.key, true])))} className="text-[10px] text-teal-600 font-bold hover:underline">All</button>
            <span className="text-slate-200 text-xs">·</span>
            <button onClick={() => setFields(Object.fromEntries(fieldDefs.map(f => [f.key, f.def])))} className="text-[10px] text-slate-400 font-bold hover:underline">Default</button>
          </div>
        </div>
        {Object.entries(fieldGroups).map(([group, groupFields]) => (
          <div key={group} className="mb-3">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1 mb-1">{group}</p>
            <div className="space-y-0.5 px-1">
              {groupFields.map(f => (
                <div key={f.key} className="flex items-center justify-between py-0.5">
                  <Checkbox checked={!!fields[f.key]} onChange={() => toggleField(f.key)} className="!text-xs !text-slate-600">{f.label}</Checkbox>
                  {f.def && <span className="text-[9px] text-amber-600 font-bold shrink-0">default</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const today = startOf(new Date());

  const [reportType, setReportType] = useState<ReportType>("expense");
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>(["all"]);
  const [datePreset, setDatePreset] = useState("7days");
  const [fromDate, setFromDate] = useState<Date | undefined>(addDays(today, -6));
  const [toDate, setToDate] = useState<Date | undefined>(endOf(new Date()));
  const [selectedUsers, setSelectedUsers] = useState<string[]>(["all"]);
  const [status, setStatus] = useState<ExpenseStatus[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ExpenseCategory[]>([]);
  const [visibleCategories, setVisibleCategories] = useState<ExpenseCategory[]>(
    () => EXPENSE_CATEGORIES.map(c => c.key)
  );

  const [activeTab, setActiveTab] = useState<"table" | "summary">("table");
  const [groupBy, setGroupBy] = useState<"user" | "date" | "category">("user");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const visibleCategoryLabels = useMemo(
    () => EXPENSE_CATEGORIES.filter(c => visibleCategories.includes(c.key)),
    [visibleCategories],
  );

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const isExpenseType = reportType === "expense" || reportType === "combined";
  const fieldDefs = isExpenseType ? EXPENSE_FIELDS_WITH_CAT : TRANSACTION_FIELDS;

  const [fields, setFields] = useState<Record<string, boolean>>(
    () => Object.fromEntries(EXPENSE_FIELDS_WITH_CAT.map(f => [f.key, f.def]))
  );

  useEffect(() => {
    setFields(Object.fromEntries(fieldDefs.map(f => [f.key, f.def])));
    setStatus([]); setSelectedCategories([]); setPage(1);
  }, [reportType]);


  const fieldGroups = useMemo(() => {
    const g: Record<string, FieldDef[]> = {};
    fieldDefs.forEach(f => { if (!g[f.group]) g[f.group] = []; g[f.group].push(f); });
    return g;
  }, [fieldDefs]);

  const queryFilters: ReportFilters = useMemo(() => ({
  reportType,
  expenseType: isExpenseType 
    ? (expenseTypes.includes("all") ? "all" : (expenseTypes.length > 0 ? (expenseTypes.join(",") as ExpenseType) : "all")) 
    : undefined,
  fromDate: isoD(fromDate), 
  toDate: isoD(toDate),
  users: selectedUsers.includes("all") ? undefined : selectedUsers,
  status: status.length ? status : undefined,
  categories: selectedCategories.length ? selectedCategories : undefined,
  groupBy, 
  sortBy: "date", 
  sortOrder: "desc",
  page, 
  limit, 
  includeSummary: true,
}), [
  // ✅ All dependencies that affect the query
  reportType, isExpenseType, expenseTypes,
  fromDate, toDate,
  selectedUsers, status, selectedCategories,
  groupBy, page, limit
]);

  const { data: reportData, isLoading, isFetching, isError, error: queryError, refetch } = useGetReportQuery(queryFilters);

const { searchTerm, setSearchTerm, filters: searchFilters } = useReportSearch(
  { ...queryFilters, search: undefined } as ReportFilters, 
  400
);

const { data: searchedData, isLoading: searchLoading, refetch: refetchSearch } =
  useGetReportQuery(
    { 
      ...searchFilters, 
      search: searchTerm,
      // ✅ Explicitly pass page/limit to search query
      page,
      limit,
    } as ReportFilters, 
    { skip: !searchTerm }
  );
  const { data: usersRaw = [], isLoading: usersLoading } = useGetReportUsersQuery();
  const usersData = useMemo(() =>
    (usersRaw as any[]).map((u: any) => ({ _id: u._id, name: u.name, type: u.type })), [usersRaw]);

  const activeData = (searchTerm ? searchedData?.data : reportData?.data) ?? [];
  const pagination = searchTerm ? searchedData?.pagination : reportData?.pagination;
  const isLoadingAny = isLoading || (searchTerm ? searchLoading : false);

  const visibleBaseFields = useMemo(() => {
    if (!isExpenseType) return fieldDefs.filter(f => fields[f.key]);
    return fieldDefs.filter(f => fields[f.key] && f.key !== "category");
  }, [fieldDefs, fields, isExpenseType]);

  const toggleExpenseType = useCallback((t: ExpenseType) => {
    setExpenseTypes(prev => {
      if (t === "all") return ["all"];
      const without = prev.filter(x => x !== "all");
      const next = without.includes(t) ? without.filter(x => x !== t) : [...without, t];
      return next.length ? next : ["all"];
    });
  }, []);

  useEffect(() => { setPage(1); refetch(); }, [limit]);
const handleRefetchAll = useCallback(() => {
  refetch();
  if (searchTerm) refetchSearch();
}, [refetch, refetchSearch, searchTerm]);

  const toggleStatus = useCallback((s: ExpenseStatus) => setStatus(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]), []);
  const toggleCategory = useCallback((c: ExpenseCategory) => setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]), []);
  const toggleVisibleCategory = useCallback((c: ExpenseCategory) => setVisibleCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]), []);
  const toggleField = useCallback((k: string) => setFields(prev => ({ ...prev, [k]: !prev[k] })), []);

  const filterProps = {
    reportType, setReportType, expenseTypes, toggleExpenseType,
    datePreset, setDatePreset, fromDate, toDate, setFromDate, setToDate,
    selectedUsers, setSelectedUsers, usersData, usersLoading,
    status, toggleStatus, selectedCategories, toggleCategory,
    visibleCategories, toggleVisibleCategory,
    fields, setFields, toggleField, fieldDefs, fieldGroups,
    dataCount: activeData.length,
  };

  useEffect(() => {
    handleResetAllFilters()
  }, [])


  const handleResetAllFilters = () => {
    setDatePreset("30days");
    const r = resolvePreset("30days");
    if (r) { setFromDate(r.from); setToDate(r.to); }
    setSelectedUsers(["all"]); setStatus([]); setSelectedCategories([]); setSearchTerm("");
  }
  return (
    <section className="flex flex-col min-h-screen bg-slate-50">
      <style>{`
        .filter-section-label { font-size:9px;font-weight:700;color:#888780;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;display:block; }
        .report-filter .ant-select-selector { border-color:#e8e6df!important;border-radius:8px!important;font-size:11px!important; }
        .report-filter .ant-picker { border-color:#e8e6df!important;border-radius:8px!important;font-size:11px!important; }
        .report-filter .ant-checkbox-wrapper { font-size:11px!important;color:#5f5e5a!important; }
      `}</style>

      {showEmail && activeData.length > 0 && (
        <EmailReportModal
          onClose={() => setShowEmail(false)}
          data={activeData as any[]}
          visibleBaseFields={visibleBaseFields}
          isExpenseType={isExpenseType}
          visibleCategoryLabels={visibleCategoryLabels}
          reportLabel={REPORT_TYPES[reportType].label}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {drawerOpen && <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerOpen(false)} />}

          {drawerOpen && (
            <aside className="bg-white border-r border-slate-100 overflow-hidden flex flex-col fixed top-0 right-0 h-full z-50 shadow-2xl w-[300px] transition-all duration-300 ease-in-out">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filters</span>
                <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl p-0.5 rounded hover:bg-slate-100 transition-colors">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 report-filter">
                <FilterPanel {...filterProps} onClose={() => setDrawerOpen(false)} />
              </div>
            </aside>
          )}

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Sticky toolbar */}
            <div className="shrink-0 bg-white border-b border-slate-100 px-3 sm:px-4 py-2.5 flex items-center gap-2 flex-wrap z-10">
              <button onClick={() => setDrawerOpen(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 border rounded-lg font-semibold transition-all shrink-0 ${drawerOpen ? "bg-purple-900 border-slate-800 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M10 12h4" />
                </svg>
                Filters
                {(!selectedUsers.includes("all") || status.length > 0 || selectedCategories.length > 0) && (
                  <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {[!selectedUsers.includes("all") && selectedUsers.length, status.length, selectedCategories.length].filter(Boolean).reduce((s: number, n) => s + Number(n), 0)}
                  </span>
                )}
              </button>

              <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 shrink-0">
                {(["table", "summary"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${activeTab === tab ? "bg-purple-900 text-white" : "text-slate-500 hover:text-slate-700"}`}>
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "summary" && (
                <div className="flex bg-amber-50 rounded-lg p-0.5 gap-0.5 shrink-0 flex-wrap">
                  {(["user", "date", "category"] as const).map(g => (
                    <button key={g} onClick={() => setGroupBy(g)}
                      className={`px-2 py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-all ${groupBy === g ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-100"}`}>
                      {g === "user" ? "By User" : g === "date" ? "By Date" : "By Category"}
                    </button>
                  ))}
                </div>
              )}

              {isExpenseType && activeTab === "table" && visibleCategories.length > 0 && (
                <div className="hidden lg:flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg shrink-0">
                  <span className="font-bold">{visibleCategories.length}</span><span>cat. cols</span>
                </div>
              )}

              <div className="flex-1 min-w-0" />

              <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-400 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                <span className="truncate max-w-[160px]">{fmtD(fromDate)} → {fmtD(toDate)}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${reportType === "expense" ? "bg-amber-50 text-amber-700"
                  : reportType === "credit" ? "bg-teal-50 text-teal-700"
                    : reportType === "debit" ? "bg-rose-50 text-rose-700"
                      : "bg-slate-100 text-slate-700"
                  }`}>{REPORT_TYPES[reportType].label}</span>
              </div>

              <button onClick={() => { refetch(); searchTerm && refetchSearch(); toast.info("Refreshed"); }}
                disabled={isFetching} title="Refresh"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-all disabled:opacity-50">
                <svg className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <button onClick={() => activeData.length ? setShowEmail(true) : toast.error("No records")}
                className="hidden sm:flex items-center gap-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 transition-all">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Email</span>
              </button>

              <DownloadButtons
                data={activeData as any[]}
                visibleBaseFields={visibleBaseFields}
                isExpenseType={isExpenseType}
                visibleCategories={visibleCategories}
                reportType={reportType}
                fromDate={fromDate}
                toDate={toDate}
                disabled={isLoadingAny}
              />
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5">

              {isError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-rose-700">Error loading report</p>
                  <p className="text-xs text-rose-500 mt-0.5">{(queryError as any)?.data?.message || "Please try again"}</p>
                  <button onClick={() => refetch()} className="mt-2 text-xs text-rose-700 font-semibold hover:underline">Retry</button>
                </div>
              )}

              {isLoadingAny && activeData.length === 0 && (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-xl h-12 animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
                  ))}
                </div>
              )}

              {!isLoadingAny && !isError && activeData.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-2xl">📊</div>
                  <p className="text-sm font-semibold text-slate-600">No data for this range</p>
                  <p className="text-xs text-slate-400 mt-1">Adjust your filters or date range</p>
                  <button onClick={() => {
                    handleResetAllFilters()

                  }} className="mt-4 text-xs text-teal-600 font-semibold hover:underline">
                    Reset all filters
                  </button>
                </div>
              )}

              {activeData.length > 0 && (
                <>
                  {activeTab === "summary" ? (
                    <SummaryView data={activeData} reportType={reportType} groupBy={groupBy} />
                  ) : (
                    <>
                      {/* ── Top bar: record count + per-page Select dropdown ── */}
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <p className="text-[10px] text-slate-400">
                          {pagination ? (
                            <>
                              Showing{" "}
                              <span className="font-semibold text-slate-600">
                                {(pagination.page - 1) * pagination.limit + 1}–
                                {Math.min(pagination.page * pagination.limit, pagination.total)}
                              </span>{" "}
                              of{" "}
                              <span className="font-semibold text-slate-600">
                                {pagination.total.toLocaleString()}
                              </span>{" "}

                            </>
                          ) : (
                            <>
                              <span className="font-semibold text-slate-600">{activeData.length.toLocaleString()}</span> records
                            </>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">Rows per page:</span>
                          <Select
                            className="text-xs"
                            size="small"
                            value={limit}
                            onChange={(val: number) => {
                              setLimit(val);
                              setPage(1);
                              // ✅ Fix: Refetch BOTH queries to ensure data syncs in all modes
                              handleRefetchAll();
                              if (searchTerm) refetchSearch();
                            }}
                            options={LIMIT_OPTIONS.map(l => ({ label: `${l} / page`, value: l }))}
                            style={{ width: 110 }}
                            dropdownStyle={{ minWidth: 110 }}
                          />
                        </div>
                      </div>

                      <DataTable
                        data={activeData} fieldDefs={fieldDefs} fields={fields}
                        isFetching={isFetching} isExpenseType={isExpenseType}
                        visibleCategories={visibleCategories}
                      />
                    </>
                  )}

                  {/* Bottom: page navigation only */}
                  <div className="mt-4 flex items-center justify-end flex-wrap gap-3 pb-2">
                    {pagination && pagination.totalPages > 1 && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => { setPage(1); handleRefetchAll(); }} disabled={!pagination.hasPrev}
                          className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold transition-all" title="First">
                          «
                        </button>
                        <button onClick={() => { setPage(p => p - 1); handleRefetchAll(); }} disabled={!pagination.hasPrev}
                          className="text-[10px] px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold transition-all">
                          ‹ Prev
                        </button>

                        <div className="flex items-center gap-0.5 mx-1">
                          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 2)
                            .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                              acc.push(p); return acc;
                            }, [])
                            .map((p, i) =>
                              p === "…"
                                ? <span key={`e${i}`} className="text-[10px] text-slate-300 px-0.5">…</span>
                                : (
                                  <button key={p} onClick={() => { setPage(p as number); handleRefetchAll(); }}
                                    className={`text-[10px] min-w-[26px] py-1 rounded-lg font-semibold transition-all border ${pagination.page === p
                                      ? "bg-slate-800 text-white border-slate-800"
                                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                      }`}>
                                    {p}
                                  </button>
                                )
                            )}
                        </div>

                        <button onClick={() => { setPage(p => p + 1); handleRefetchAll(); }} disabled={!pagination.hasNext}
                          className="text-[10px] px-2.5 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold transition-all">
                          Next ›
                        </button>
                        <button onClick={() => { setPage(pagination.totalPages); handleRefetchAll(); }} disabled={!pagination.hasNext}
                          className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold transition-all" title="Last">
                          »
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* {activeData.length > 0 && (
                <div className="sm:hidden mt-4">
                  <button onClick={() => setShowEmail(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Report via Email
                  </button>
                </div>
              )} */}

              <p className="mt-6 text-center text-[10px] text-slate-300">
                {activeData.length.toLocaleString()} records · {REPORT_TYPES[reportType].label}
                {searchTerm ? ` · "${searchTerm}"` : ""}
                {isExpenseType && visibleCategories.length > 0 ? ` · ${visibleCategories.length} category columns` : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}