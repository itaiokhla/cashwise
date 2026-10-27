"use client";

/**
 * /app/shared-report/[token]/page.tsx
 *
 * Public, read-only report viewer — no CashWise login required.
 * The token is validated server-side by /api/reports/share/[token]; this page
 * renders the immutable snapshot that was emailed.
 *
 * All totals are recomputed in the browser with the same functions that
 * produced the email/PDF/Excel (app/_lib/reportDigest), so they always agree
 * and update live as the viewer filters.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  FiAlertTriangle,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiUser,
  FiCopy,
  FiDownload,
  FiExternalLink,
  FiFileText,
  FiFilter,
  FiGrid,
  FiLink,
  FiLock,
  FiMail,
  FiPaperclip,
  FiRefreshCw,
  FiSearch,
  FiShare2,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import {
  filterRows,
  fmtINR,
  fmtCompactINR,
  hasActiveFilters,
  labelize,
  legacySection,
  pct,
  rowFiltersToQuery,
  summarizeRows,
  type Bucket,
  type CashPosition,
  type ReportRow,
  type ReportSection,
  type RowFilters,
} from "@app/_lib/reportDigest";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Snapshot {
  version?: number;
  reportType: string;
  fromDate: string;
  toDate: string;
  period: string;
  scheduleName?: string;
  scheduleDescription?: string;
  generatedAt?: string;
  timezone?: string;
  sections?: Omit<ReportSection, "rows">[];
  rows: ReportRow[];
}

type PageState = "loading" | "expired" | "revoked" | "not_found" | "error" | "ready";
type SortKey = "newest" | "oldest" | "amount";

// ─── Palette (status colours are reserved for status only) ───────────────────

const STATUS = {
  approved: { label: "Approved", color: "#0ca30c", Icon: FiCheckCircle, pill: "bg-green-50 text-green-800 ring-green-200" },
  pending: { label: "Pending", color: "#fab219", Icon: FiClock, pill: "bg-amber-50 text-amber-800 ring-amber-200" },
  rejected: { label: "Rejected", color: "#d03b3b", Icon: FiXCircle, pill: "bg-red-50 text-red-700 ring-red-200" },
} as const;
const BAR = "#2a78d6"; // single-series magnitude hue

const TYPE_LABEL: Record<string, string> = {
  expense: "Expenses",
  combined: "Cash & Expenses",
  credit: "Cash Received",
  debit: "Cash Spent",
};

const PAGE_SIZE = 30;
const EMPTY_FILTERS: RowFilters = { search: "", type: "all", source: "all", statuses: [], users: [], categories: [] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return isNaN(d.getTime()) ? date : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function shortDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return isNaN(d.getTime()) ? date : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function statusOf(row: ReportRow): keyof typeof STATUS | null {
  if (row.type !== "expense") return null;
  const s = String(row.status || "pending").toLowerCase();
  return s === "approved" || s === "rejected" ? s : "pending";
}

function toggle(list: string[] | undefined, value: string): string[] {
  const l = list || [];
  return l.includes(value) ? l.filter((v) => v !== value) : [...l, value];
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  for (let d = start; d <= end && out.length < 62; d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharedReportPage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : Array.isArray(params?.token) ? params.token[0] : "";

  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const [activeKey, setActiveKey] = useState<string>("");
  const [filters, setFilters] = useState<RowFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("newest");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!token) {
      setState("not_found");
      return;
    }
    try {
      setState("loading");
      const res = await fetch(`/api/reports/share/${token}`, { cache: "no-store" });
      const json = await res.json();
      if (json.type === "SUCCESS" && json.data?.snapshot) {
        setSnapshot(json.data.snapshot);
        setExpiresAt(json.data.expiresAt || null);
        setCreatedAt(json.data.createdAt || null);
        setState("ready");
      } else if (json.type === "EXPIRED") {
        setExpiresAt(json.expiresAt || null);
        setState("expired");
      } else if (json.type === "REVOKED") {
        setState("revoked");
      } else if (json.type === "NOT_FOUND" || json.type === "INVALID_TOKEN" || res.status === 404) {
        setState("not_found");
      } else {
        setErrorMsg(json.message || "Failed to load the report.");
        setState("error");
      }
    } catch {
      setErrorMsg("Could not reach CashWise. Check your connection and try again.");
      setState("error");
    }
  }, [token]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ── Sections (v2 snapshots carry several; legacy ones become one) ──
  const sections: ReportSection[] = useMemo(() => {
    if (!snapshot) return [];
    const rows = Array.isArray(snapshot.rows) ? snapshot.rows : [];
    if (snapshot.sections?.length) {
      return snapshot.sections.map((s) => ({ ...s, rows: rows.filter((r) => r.date >= s.from && r.date <= s.to) }));
    }
    return [legacySection(snapshot)];
  }, [snapshot]);

  useEffect(() => {
    if (sections.length && !sections.some((s) => s.key === activeKey)) setActiveKey(sections[0].key);
  }, [sections, activeKey]);

  const section = sections.find((s) => s.key === activeKey) || sections[0];
  const filtered = useMemo(() => (section ? filterRows(section.rows, filters) : []), [section, filters]);
  const digest = useMemo(() => summarizeRows(filtered), [filtered]);
  const filtersActive = hasActiveFilters(filters);
  const cashPosition: CashPosition | null | undefined = section?.cashPosition;

  const sorted = useMemo(() => {
    const list = [...filtered];
    const key = (r: ReportRow) => `${r.date || ""}|${r.createdAt || ""}`;
    if (sort === "amount") list.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
    else if (sort === "oldest") list.sort((a, b) => key(a).localeCompare(key(b)));
    else list.sort((a, b) => key(b).localeCompare(key(a)));
    return list;
  }, [filtered, sort]);

  useEffect(() => setVisible(PAGE_SIZE), [filters, activeKey, sort]);

  const facets = useMemo(() => {
    const rows = section?.rows || [];
    return {
      users: Array.from(new Set(rows.map((r) => r.userName).filter(Boolean))).sort(),
      categories: Array.from(new Set(rows.filter((r) => r.type === "expense").map((r) => r.category).filter(Boolean))).sort(),
      sources: Array.from(new Set(rows.filter((r) => r.type === "expense").map((r) => r.source).filter(Boolean))).sort(),
      types: Array.from(new Set(rows.map((r) => r.type))),
    };
  }, [section]);

  const exportUrl = (format: "pdf" | "xlsx") => {
    const q = rowFiltersToQuery(filters);
    return `/api/reports/share/${token}/export?format=${format}${section ? `&section=${section.key}` : ""}${q ? `&${q}` : ""}`;
  };

  // ── Status screens ──
  if (state === "loading") return <LoadingState />;
  if (state === "expired") {
    return (
      <StateCard icon={<FiClock className="w-7 h-7" />} tone="amber" title="This report link has expired">
        For security, shared CashWise reports stop working after a set time.
        {expiresAt && (
          <span className="block mt-3 text-xs font-semibold text-amber-800 bg-amber-50 rounded-full px-3 py-1 w-fit mx-auto">
            Expired {new Date(expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        )}
        <span className="block mt-3">Ask your CashWise administrator to send a fresh report.</span>
      </StateCard>
    );
  }
  if (state === "revoked") {
    return (
      <StateCard icon={<FiLock className="w-7 h-7" />} tone="slate" title="Access revoked">
        The administrator has turned off this report link.
      </StateCard>
    );
  }
  if (state === "not_found") {
    return (
      <StateCard icon={<FiSearch className="w-7 h-7" />} tone="slate" title="Report not found">
        This link is incomplete or the report has been removed. Check that you copied the whole link.
      </StateCard>
    );
  }
  if (state === "error" || !snapshot || !section) {
    return (
      <StateCard icon={<FiAlertTriangle className="w-7 h-7" />} tone="red" title="Couldn’t open the report">
        {errorMsg || "Something went wrong."}
        <button
          onClick={loadReport}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <FiRefreshCw className="w-4 h-4" /> Try again
        </button>
      </StateCard>
    );
  }

  const title = snapshot.scheduleName || "Expense Report";
  const typeLabel = TYPE_LABEL[snapshot.reportType] || labelize(snapshot.reportType);
  const isCombined = facets.types.length > 1;
  const multiDay = section.from !== section.to;
  const generated = snapshot.generatedAt || (createdAt ? new Date(createdAt).toLocaleString("en-IN") : "");

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-12 text-slate-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <FiGrid className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">CashWise · {typeLabel}</div>
            <h1 className="truncate text-base font-bold leading-tight sm:text-lg">{title}</h1>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <a href={exportUrl("pdf")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <FiFileText className="h-4 w-4" /> PDF
            </a>
            <a href={exportUrl("xlsx")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <FiDownload className="h-4 w-4" /> Excel
            </a>
            <button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              <FiShare2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 pt-4 sm:space-y-5 sm:pt-6">
        {/* ── Meta + period switcher ── */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {snapshot.scheduleDescription && <span>{snapshot.scheduleDescription}</span>}
            {generated && <span>· Generated {generated}</span>}
            {expiresAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200">
                <FiLock className="h-3 w-3" /> Link valid until {new Date(expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </div>

          {sections.length > 1 && (
            <div role="tablist" aria-label="Report period" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1">
              {sections.map((s) => {
                const active = s.key === section.key;
                return (
                  <button
                    key={s.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveKey(s.key)}
                    className={`rounded-xl px-2 py-2 text-center transition ${active ? "bg-white shadow-sm" : "hover:bg-white/60"}`}
                  >
                    <div className={`text-xs font-bold sm:text-sm ${active ? "text-indigo-700" : "text-slate-600"}`}>{s.label}</div>
                    <div className="truncate text-[10px] text-slate-500 sm:text-xs">{s.rangeLabel}</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Headline numbers ── */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="col-span-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            <div className="text-xs font-semibold text-slate-500">
              Total expenses · {sections.length > 1 ? section.label : section.rangeLabel}
            </div>
            <div className="mt-1 font-extrabold leading-tight tracking-tight text-slate-900" style={{ fontSize: "clamp(30px, 8vw, 46px)" }}>
              {fmtINR(digest.expense.total)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {digest.expense.count} entr{digest.expense.count === 1 ? "y" : "ies"} · approved + pending · rejected not counted
            </div>
            <StatusBar digest={digest} />
          </div>
          {(["approved", "pending", "rejected"] as const).map((key) => {
            const s = STATUS[key];
            const v = digest.expense[key];
            const active = filters.statuses?.length === 1 && filters.statuses[0] === key;
            return (
              <button
                key={key}
                onClick={() => setFilters((f) => ({ ...f, statuses: active ? [] : [key] }))}
                className={`rounded-2xl bg-white p-4 text-left shadow-sm ring-1 transition hover:ring-indigo-300 ${active ? "ring-2 ring-indigo-500" : "ring-slate-200"} ${key === "rejected" ? "col-span-2 lg:col-span-1" : ""} lg:flex lg:flex-col lg:justify-center`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <s.Icon className="h-3.5 w-3.5" style={{ color: s.color }} /> {s.label}
                </div>
                <div className="mt-1 text-lg font-bold sm:text-xl">{fmtINR(v.total)}</div>
                <div className="text-xs text-slate-500">
                  {v.count} entr{v.count === 1 ? "y" : "ies"}
                  {key === "rejected" && " · not counted"}
                </div>
              </button>
            );
          })}
        </section>

        {/* ── Cash statement ── */}
        {(digest.cash.received.count > 0 || digest.cash.spent.count > 0 || cashPosition) && (
          <CashCard digest={digest} cashPosition={cashPosition || null} filtersActive={filtersActive} />
        )}

        {/* ── Breakdowns ── */}
        <section className="grid gap-4 md:grid-cols-2">
          <BreakdownCard
            title="Where the money went"
            subtitle="Expenses by category"
            buckets={digest.expense.byCategory}
            whole={digest.expense.total}
            labelFn={labelize}
            selected={filters.categories || []}
            onToggle={(k) => setFilters((f) => ({ ...f, categories: toggle(f.categories, k) }))}
          />
          <BreakdownCard
            title="Who spent it"
            subtitle="Expenses by employee"
            buckets={digest.expense.byUser}
            whole={digest.expense.total}
            selected={filters.users || []}
            onToggle={(k) => setFilters((f) => ({ ...f, users: toggle(f.users, k) }))}
          />
        </section>

        {multiDay && <TrendCard from={section.from} to={section.to} byDate={digest.expense.byDate} />}

        {/* ── Transactions ── */}
        <section id="transactions" className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Transactions</h2>
                <p className="text-xs text-slate-500">
                  {filtered.length === section.rows.length
                    ? `${section.rows.length} entr${section.rows.length === 1 ? "y" : "ies"}`
                    : `${filtered.length} of ${section.rows.length} entries match`}
                </p>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort transactions"
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount">Highest amount</option>
              </select>
            </div>

            <div className="flex gap-2">
              <label className="relative flex-1">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Search site, employee, description…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <button
                onClick={() => setFiltersOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${filtersActive ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                <FiFilter className="h-4 w-4" />
                <span className="hidden sm:inline">Filters</span>
                {filtersActive && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
              </button>
            </div>

            {isCombined && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {[["all", "All"], ["expense", "Expenses"], ["credit", "Cash received"], ["debit", "Cash spent"]].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilters((f) => ({ ...f, type: value }))}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${filters.type === value ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-200"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {filtersActive && <ActiveFilters filters={filters} onChange={setFilters} />}
          </div>

          {sorted.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FiSearch className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {section.rows.length === 0 ? "No entries were recorded in this period" : "Nothing matches these filters"}
              </p>
              {filtersActive && (
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-2 text-sm font-semibold text-indigo-600">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {sorted.slice(0, visible).map((row, i) => (
                  <TransactionCard key={`${row._id}-${i}`} row={row} onPreview={setPreview} />
                ))}
              </ul>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Site / Party</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Files</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sorted.slice(0, visible).map((row, i) => {
                      const st = statusOf(row);
                      return (
                        <tr key={`${row._id}-${i}`} className={`hover:bg-slate-50/70 ${st === "rejected" ? "text-slate-400" : ""}`}>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDay(row.date)}</td>
                          <td className="px-4 py-3 font-medium">{row.userName}</td>
                          <td className="px-4 py-3">
                            {row.type === "expense" ? labelize(row.category) : <TypeBadge type={row.type} />}
                            {row.type === "expense" && <div className="text-[11px] text-slate-400">{labelize(row.source)}</div>}
                          </td>
                          <td className="max-w-[180px] px-4 py-3 text-slate-600">{row.siteName || "—"}</td>
                          <td className="max-w-[260px] px-4 py-3 text-slate-600">
                            <span className="line-clamp-2">{row.description || row.remarks || "—"}</span>
                          </td>
                          <td className="px-4 py-3">{st ? <StatusPill status={st} /> : <span className="text-slate-300">—</span>}</td>
                          <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${st === "rejected" ? "line-through" : ""}`}>
                            {row.type === "debit" ? "−" : row.type === "credit" ? "+" : ""}
                            {fmtINR(row.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Attachments urls={row.attachments} onPreview={setPreview} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {visible < sorted.length && (
                <div className="border-t border-slate-100 p-3 text-center">
                  <button
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 sm:w-auto sm:px-8"
                  >
                    Show more ({sorted.length - visible} left)
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <footer className="pb-4 pt-2 text-center text-[11px] leading-relaxed text-slate-400">
          <div className="font-semibold text-slate-500">CashWise · Confidential — for authorised recipients only</div>
          {snapshot.timezone && <div>All dates in {snapshot.timezone}.</div>}
          <div>
            © {new Date().getFullYear()}{" "}
            <a href="https://intertech.com.co/" target="_blank" rel="noreferrer" className="underline">Inter-Tech</a>
            {" · "}Designed by{" "}
            <a href="https://iameya.in/" target="_blank" rel="noreferrer" className="underline">Ameya Innovex</a>
          </div>
        </footer>
      </main>

      {/* ── Mobile action bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur md:hidden">
        <div className="grid grid-cols-3 gap-2">
          <a href={exportUrl("pdf")} className="flex flex-col items-center gap-0.5 rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 active:bg-slate-200">
            <FiFileText className="h-5 w-5" /> PDF
          </a>
          <a href={exportUrl("xlsx")} className="flex flex-col items-center gap-0.5 rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-700 active:bg-slate-200">
            <FiDownload className="h-5 w-5" /> Excel
          </a>
          <button onClick={() => setShareOpen(true)} className="flex flex-col items-center gap-0.5 rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white active:bg-indigo-700">
            <FiShare2 className="h-5 w-5" /> Share
          </button>
        </div>
        {filtersActive && <p className="mt-1.5 text-center text-[10px] text-slate-500">Downloads include your current filters</p>}
      </div>

      {filtersOpen && (
        <FilterSheet
          filters={filters}
          facets={facets}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
          resultCount={filtered.length}
        />
      )}
      {shareOpen && (
        <ShareSheet
          title={title}
          sectionLabel={`${section.label} · ${section.rangeLabel}`}
          total={digest.expense.total}
          count={digest.expense.count}
          expiresAt={expiresAt}
          onClose={() => setShareOpen(false)}
        />
      )}
      {preview && <PreviewModal url={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl animate-pulse space-y-4 pt-4">
        <div className="h-12 rounded-2xl bg-slate-200" />
        <div className="h-14 rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="col-span-2 h-36 rounded-2xl bg-slate-200" />
          <div className="h-24 rounded-2xl bg-slate-200" />
          <div className="h-24 rounded-2xl bg-slate-200" />
        </div>
        <div className="h-64 rounded-2xl bg-slate-200" />
        <p className="text-center text-sm text-slate-500">Opening secure report…</p>
      </div>
    </div>
  );
}

function StateCard({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone: "amber" | "red" | "slate"; children: React.ReactNode }) {
  const tones = { amber: "bg-amber-50 text-amber-600", red: "bg-red-50 text-red-600", slate: "bg-slate-100 text-slate-500" };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${tones[tone]}`}>{icon}</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{title}</h1>
        <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
      </div>
    </div>
  );
}

function StatusBar({ digest }: { digest: ReturnType<typeof summarizeRows> }) {
  const parts = (["approved", "pending", "rejected"] as const).map((k) => ({ k, v: digest.expense[k].total }));
  const whole = digest.expense.claimed.total;
  if (!whole) return null;
  return (
    <div className="mt-4">
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100" role="img"
        aria-label={parts.map((p) => `${STATUS[p.k].label} ${pct(p.v, whole).toFixed(0)}%`).join(", ")}>
        {parts.filter((p) => p.v > 0).map((p) => (
          <div key={p.k} title={`${STATUS[p.k].label}: ${fmtINR(p.v)}`} style={{ width: `${pct(p.v, whole)}%`, background: STATUS[p.k].color }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
        {parts.map((p) => {
          const S = STATUS[p.k];
          return (
            <span key={p.k} className="inline-flex items-center gap-1">
              <S.Icon className="h-3 w-3" style={{ color: S.color }} />
              {S.label} {pct(p.v, whole).toFixed(0)}%
            </span>
          );
        })}
        <span className="text-slate-400">of {fmtINR(whole)} claimed</span>
      </div>
    </div>
  );
}

function CashCard({ digest, cashPosition, filtersActive }: { digest: ReturnType<typeof summarizeRows>; cashPosition: CashPosition | null; filtersActive: boolean }) {
  const [showUsers, setShowUsers] = useState(true);
  const [userSearch, setUserSearch] = useState("");

  const steps = cashPosition
    ? [
        { label: "Opening balance", value: cashPosition.opening, sign: "" },
        { label: "Cash received", value: cashPosition.received, sign: "+" },
        { label: "Cash spent", value: cashPosition.spent, sign: "−" },
        { label: "Remaining balance (in hand)", value: cashPosition.closing, sign: "=" },
      ]
    : [
        { label: "Cash received", value: digest.cash.received.total, sign: "+" },
        { label: "Cash spent", value: digest.cash.spent.total, sign: "−" },
        { label: "Net cash flow", value: digest.cash.net, sign: "=" },
      ];

  const filteredUsers = useMemo(() => {
    if (!cashPosition?.users) return [];
    if (!userSearch.trim()) return cashPosition.users;
    const q = userSearch.toLowerCase().trim();
    return cashPosition.users.filter((u) => u.name.toLowerCase().includes(q));
  }, [cashPosition, userSearch]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Remaining Balance & Cash Statement</h2>
          <p className="text-xs text-slate-500">
            {cashPosition
              ? "Cash in hand, opening balances, cash received, and expenses by employee for this period."
              : `Credits received and debits booked in this period${filtersActive ? " (filtered transactions)" : ""}`}
          </p>
        </div>
        {cashPosition && cashPosition.users.length > 0 && (
          <button
            onClick={() => setShowUsers((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-slate-100"
          >
            <FiUser className="h-3.5 w-3.5" />
            <span>{showUsers ? "Hide User Balances" : `Show All Users (${cashPosition.users.length})`}</span>
            {showUsers ? <FiChevronUp className="h-3.5 w-3.5" /> : <FiChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      <div className={`mt-4 grid gap-2.5 ${steps.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
        {steps.map((s, i) => (
          <div
            key={s.label}
            className={`rounded-xl p-3.5 ${
              i === steps.length - 1
                ? s.value < 0
                  ? "bg-red-50 ring-1 ring-red-200"
                  : "bg-emerald-50 ring-1 ring-emerald-200"
                : "bg-slate-50 ring-1 ring-slate-100"
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500">
              {s.sign && <span className="mr-1 font-bold text-slate-400">{s.sign}</span>}
              {s.label}
            </div>
            <div
              className={`mt-1 text-lg font-extrabold sm:text-xl tabular-nums ${
                i === steps.length - 1
                  ? s.value < 0
                    ? "text-red-700"
                    : "text-emerald-800"
                  : s.value < 0
                  ? "text-red-700"
                  : "text-slate-900"
              }`}
            >
              {fmtINR(s.value)}
            </div>
          </div>
        ))}
      </div>

      {showUsers && cashPosition && cashPosition.users.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Remaining Balance by User</h3>
              <p className="text-xs text-slate-500">
                Individual cash ledger positions ({filteredUsers.length} of {cashPosition.users.length} users)
              </p>
            </div>
            {cashPosition.users.length > 5 && (
              <div className="relative w-full sm:w-64">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name…"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-200"
                />
              </div>
            )}
          </div>

          <div className="-mx-4 overflow-x-auto sm:mx-0 rounded-xl border border-slate-200">
            <table className="w-full min-w-[580px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-2.5">Employee / User</th>
                  <th className="px-4 py-2.5 text-right">Opening Balance</th>
                  <th className="px-4 py-2.5 text-right">Cash Received (+)</th>
                  <th className="px-4 py-2.5 text-right">Cash Spent (−)</th>
                  <th className="px-4 py-2.5 text-right">Remaining Balance (=)</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                      No users match “{userSearch}”
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isPositive = u.closing > 0;
                    const isNegative = u.closing < 0;
                    return (
                      <tr key={u.userId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-900 flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                            {u.name ? u.name.slice(0, 1).toUpperCase() : "U"}
                          </span>
                          <span className="truncate">{u.name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{fmtINR(u.opening)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-sky-700">+{fmtINR(u.received)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">−{fmtINR(u.spent)}</td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold ${
                            isNegative ? "text-red-700" : isPositive ? "text-emerald-700" : "text-slate-700"
                          }`}
                        >
                          {fmtINR(u.closing)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {isPositive ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                              In Hand
                            </span>
                          ) : isNegative ? (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-200">
                              Deficit
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold tabular-nums text-slate-900">
                <tr>
                  <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-slate-600">Total</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{fmtINR(cashPosition.opening)}</td>
                  <td className="px-4 py-2.5 text-right text-sky-700">+{fmtINR(cashPosition.received)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">−{fmtINR(cashPosition.spent)}</td>
                  <td
                    className={`px-4 py-2.5 text-right text-base font-extrabold ${
                      cashPosition.closing < 0 ? "text-red-700" : "text-emerald-800"
                    }`}
                  >
                    {fmtINR(cashPosition.closing)}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                    {cashPosition.users.length} user{cashPosition.users.length === 1 ? "" : "s"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function BreakdownCard({ title, subtitle, buckets, whole, selected, onToggle, labelFn = (k: string) => k }: {
  title: string;
  subtitle: string;
  buckets: Bucket[];
  whole: number;
  selected: string[];
  onToggle: (key: string) => void;
  labelFn?: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const list = expanded ? buckets : buckets.slice(0, 6);
  const max = buckets[0]?.total || 0;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <h2 className="text-base font-bold">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle} · tap to filter</p>
      {buckets.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No expenses in this view</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {list.map((b) => {
            const active = selected.includes(b.key);
            return (
              <li key={b.key}>
                <button
                  onClick={() => onToggle(b.key)}
                  aria-pressed={active}
                  className={`w-full rounded-xl px-2 py-2 text-left transition ${active ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-800">
                      {active && <FiCheck className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
                      <span className="truncate">{labelFn(b.key)}</span>
                      <span className="shrink-0 text-xs font-normal text-slate-400">{b.count}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                      {fmtINR(b.total)}
                      <span className="ml-1.5 text-xs font-normal text-slate-500">{pct(b.total, whole).toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-r-full" style={{ width: `${Math.max(2, pct(b.total, max))}%`, background: BAR }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {buckets.length > 6 && (
        <button onClick={() => setExpanded((e) => !e)} className="mt-2 text-xs font-semibold text-indigo-600">
          {expanded ? "Show less" : `Show all ${buckets.length}`}
        </button>
      )}
    </div>
  );
}

function TrendCard({ from, to, byDate }: { from: string; to: string; byDate: Bucket[] }) {
  const days = daysBetween(from, to);
  const map = new Map(byDate.map((b) => [b.key, b]));
  const max = Math.max(0, ...byDate.map((b) => b.total));
  const peak = byDate.reduce<Bucket | null>((m, b) => (!m || b.total > m.total ? b : m), null);
  const labelEvery = days.length > 16 ? 5 : days.length > 8 ? 2 : 1;
  if (days.length < 2) return null;
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Daily spend</h2>
          <p className="text-xs text-slate-500">Expenses per day, excluding rejected</p>
        </div>
        {peak && (
          <div className="text-right text-xs text-slate-500">
            Highest day
            <div className="text-sm font-semibold text-slate-900">{fmtINR(peak.total)} · {shortDay(peak.key)}</div>
          </div>
        )}
      </div>
      <div className="mt-4 flex h-36 items-end gap-[2px] border-b border-slate-200">
        {days.map((day) => {
          const b = map.get(day);
          const h = max ? (b ? Math.max(3, (b.total / max) * 100) : 0) : 0;
          return (
            <div key={day} className="group relative flex h-full flex-1 items-end justify-center">
              <div className="w-full max-w-[24px] rounded-t-[4px] transition-opacity group-hover:opacity-80" style={{ height: `${h}%`, background: BAR }} />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[11px] text-white shadow group-hover:block">
                {fmtDay(day)} · {b ? `${fmtINR(b.total)} · ${b.count}` : "no entries"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {days.map((day, i) => (
          <div key={day} className="flex-1 text-center text-[10px] text-slate-400">
            {i % labelEvery === 0 ? new Date(`${day}T00:00:00`).getDate() : ""}
          </div>
        ))}
      </div>
      <div className="mt-1 text-right text-[10px] text-slate-400">Scale up to {fmtCompactINR(max)}</div>
    </section>
  );
}

function StatusPill({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.pill}`}>
      <s.Icon className="h-3 w-3" style={{ color: s.color }} /> {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return type === "credit" ? (
    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">Cash received</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">Cash spent</span>
  );
}

function Attachments({ urls, onPreview }: { urls: string[]; onPreview: (u: string) => void }) {
  if (!urls?.length) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {urls.slice(0, 4).map((u, i) => (
        <button key={i} onClick={() => onPreview(u)} className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100">
          <FiPaperclip className="h-3 w-3" />{i + 1}
        </button>
      ))}
    </div>
  );
}

function TransactionCard({ row, onPreview }: { row: ReportRow; onPreview: (u: string) => void }) {
  const st = statusOf(row);
  return (
    <li className={`px-4 py-3 ${st === "rejected" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {row.type === "expense" ? labelize(row.category) : <TypeBadge type={row.type} />}
            {row.type === "expense" && <span className="ml-1.5 text-xs font-normal text-slate-400">{labelize(row.source)}</span>}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {row.userName} · {fmtDay(row.date)}
          </div>
        </div>
        <div className={`shrink-0 text-right text-base font-bold tabular-nums ${st === "rejected" ? "line-through" : ""}`}>
          {row.type === "debit" ? "−" : row.type === "credit" ? "+" : ""}
          {fmtINR(row.amount)}
        </div>
      </div>
      {row.siteName && <div className="mt-1 truncate text-xs text-slate-600">📍 {row.siteName}</div>}
      {(row.description || row.remarks) && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{row.description || row.remarks}</p>}
      {(st || row.attachments?.length > 0) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {st ? <StatusPill status={st} /> : <span />}
          {row.attachments?.length > 0 && <Attachments urls={row.attachments} onPreview={onPreview} />}
        </div>
      )}
    </li>
  );
}

function ActiveFilters({ filters, onChange }: { filters: RowFilters; onChange: (f: RowFilters) => void }) {
  const chips: { label: string; clear: () => void }[] = [];
  if (filters.search) chips.push({ label: `“${filters.search}”`, clear: () => onChange({ ...filters, search: "" }) });
  if (filters.type && filters.type !== "all") chips.push({ label: labelize(filters.type), clear: () => onChange({ ...filters, type: "all" }) });
  if (filters.source && filters.source !== "all") chips.push({ label: labelize(filters.source), clear: () => onChange({ ...filters, source: "all" }) });
  filters.statuses?.forEach((s) => chips.push({ label: labelize(s), clear: () => onChange({ ...filters, statuses: toggle(filters.statuses, s) }) }));
  filters.users?.forEach((u) => chips.push({ label: u, clear: () => onChange({ ...filters, users: toggle(filters.users, u) }) }));
  filters.categories?.forEach((c) => chips.push({ label: labelize(c), clear: () => onChange({ ...filters, categories: toggle(filters.categories, c) }) }));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c, i) => (
        <button key={i} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 ring-1 ring-indigo-200">
          {c.label} <FiX className="h-3 w-3" />
        </button>
      ))}
      <button onClick={() => onChange(EMPTY_FILTERS)} className="px-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
        Clear all
      </button>
    </div>
  );
}

function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">{footer}</div>}
      </div>
    </div>
  );
}

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: { value: string; label: string }[]; selected: string[]; onToggle: (v: string) => void }) {
  if (options.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button key={o.value} onClick={() => onToggle(o.value)} aria-pressed={active}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${active ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSheet({ filters, facets, onChange, onClose, resultCount }: {
  filters: RowFilters;
  facets: { users: string[]; categories: string[]; sources: string[]; types: string[] };
  onChange: (f: RowFilters) => void;
  onClose: () => void;
  resultCount: number;
}) {
  return (
    <Sheet
      title="Filter transactions"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={() => onChange(EMPTY_FILTERS)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700">Reset</button>
          <button onClick={onClose} className="flex-[2] rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white">Show {resultCount} result{resultCount === 1 ? "" : "s"}</button>
        </div>
      }
    >
      <div className="space-y-5">
        <ChipGroup
          label="Status"
          options={(["approved", "pending", "rejected"] as const).map((s) => ({ value: s, label: STATUS[s].label }))}
          selected={filters.statuses || []}
          onToggle={(v) => onChange({ ...filters, statuses: toggle(filters.statuses, v) })}
        />
        {facets.sources.length > 1 && (
          <ChipGroup
            label="Expense type"
            options={facets.sources.map((s) => ({ value: s, label: labelize(s) }))}
            selected={filters.source && filters.source !== "all" ? [filters.source] : []}
            onToggle={(v) => onChange({ ...filters, source: filters.source === v ? "all" : v })}
          />
        )}
        <ChipGroup
          label="Employee"
          options={facets.users.map((u) => ({ value: u, label: u }))}
          selected={filters.users || []}
          onToggle={(v) => onChange({ ...filters, users: toggle(filters.users, v) })}
        />
        <ChipGroup
          label="Category"
          options={facets.categories.map((c) => ({ value: c, label: labelize(c) }))}
          selected={filters.categories || []}
          onToggle={(v) => onChange({ ...filters, categories: toggle(filters.categories, v) })}
        />
      </div>
    </Sheet>
  );
}

function ShareSheet({ title, sectionLabel, total, count, expiresAt, onClose }: {
  title: string;
  sectionLabel: string;
  total: number;
  count: number;
  expiresAt: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const expiry = expiresAt ? new Date(expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";
  const message = `*${title}*\n${sectionLabel}\nTotal expenses: ${fmtINR(total)} (${count} entries)\n\nView report: ${url}${expiry ? `\nLink valid until ${expiry}` : ""}`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet title="Share this report" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
          <FiLink className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
          <input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent text-xs text-slate-600 outline-none" />
          <button onClick={copy} className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${copied ? "bg-green-600 text-white" : "bg-indigo-600 text-white"}`}>
            {copied ? <><FiCheck className="h-3.5 w-3.5" /> Copied</> : <><FiCopy className="h-3.5 w-3.5" /> Copy</>}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25d366] py-3 text-sm font-semibold text-white">
            WhatsApp
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(`${title} — ${sectionLabel}`)}&body=${encodeURIComponent(message.replace(/\*/g, ""))}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white">
            <FiMail className="h-4 w-4" /> Email
          </a>
          {canNativeShare && (
            <button onClick={() => navigator.share({ title, text: `${title} — ${sectionLabel}`, url }).catch(() => {})}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 sm:col-span-1">
              <FiShare2 className="h-4 w-4" /> More apps
            </button>
          )}
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Anyone with this link can view the report{expiry ? ` until ${expiry}` : ""}. No CashWise login is needed — share it only with people who should see these figures.
        </p>
      </div>
    </Sheet>
  );
}

function PreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  const isImage = /\.(jpe?g|png|gif|webp|avif)(\?.*)?$/i.test(url);
  const isPdf = /\.pdf(\?.*)?$/i.test(url);
  return (
    <Sheet title="Attachment" onClose={onClose}>
      <div className="flex flex-col items-center gap-3">
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt="Expense attachment" className="max-h-[60vh] w-auto rounded-xl object-contain" />
        ) : isPdf ? (
          <iframe src={url} title="PDF attachment" className="h-[60vh] w-full rounded-xl border-0" />
        ) : (
          <p className="py-6 text-sm text-slate-500">Preview isn’t available for this file type.</p>
        )}
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
          Open in new tab <FiExternalLink className="h-4 w-4" />
        </a>
      </div>
    </Sheet>
  );
}
