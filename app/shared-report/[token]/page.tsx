"use client";

/**
 * /app/shared-report/[token]/page.tsx
 *
 * Public read-only report viewer — No CashWise login required.
 * Validates the 24-hour secure share token via /api/reports/share/[token].
 * Displays full interactive financial dashboard from the report snapshot.
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface SnapshotRow {
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
  [key: string]: unknown;
}

interface SnapshotSummary {
  expenseTotal: number;
  creditTotal: number;
  debitTotal: number;
  grandTotal: number;
  netCreditDebit: number;
  totalRecords: number;
  averagePerEntry: number;
  byUser: Record<string, { total: number; count: number }>;
  byDate: Record<string, { total: number; count: number }>;
  byCategory: Record<string, { total: number; count: number }>;
}

interface SnapshotData {
  reportType: string;
  fromDate: string;
  toDate: string;
  period: string;
  recordCount: number;
  totalAmount: number;
  filters: Record<string, unknown>;
  summary: SnapshotSummary;
  rows: SnapshotRow[];
  scheduleName?: string;
  timezone?: string;
  recipients?: string[];
}

type PageState = "loading" | "expired" | "revoked" | "not_found" | "error" | "ready";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(val: number | null | undefined): string {
  const n = Number(val ?? 0);
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function calcPct(num: number, denom: number): string {
  if (!denom || denom === 0) return "0.0%";
  return ((num / denom) * 100).toFixed(1) + "%";
}

const TYPE_THEMES: Record<string, { primary: string; light: string; border: string }> = {
  expense: { primary: "#4f46e5", light: "#eef2ff", border: "#c7d2fe" },
  credit: { primary: "#16a34a", light: "#f0fdf4", border: "#bbf7d0" },
  debit: { primary: "#dc2626", light: "#fef2f2", border: "#fecaca" },
  combined: { primary: "#0891b2", light: "#ecfeff", border: "#a5f3fc" },
  all: { primary: "#4f46e5", light: "#eef2ff", border: "#c7d2fe" },
};

const STATUS_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  approved: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  pending: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  rejected: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  default: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SharedReportPage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : Array.isArray(params?.token) ? params.token[0] : "";

  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"table" | "user" | "date" | "category">("table");
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [userFilters, setUserFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[] | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [visibleFields, setVisibleFields] = useState<string[]>([
    "date", "user", "type", "source", "category", "site", "amount", "status", "description", "attachments",
  ]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Modals & Share
  const [copied, setCopied] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // ─── Load Report Snapshot ───────────────────────────────────────────────────

  const loadReport = useCallback(async () => {
    if (!token) {
      setState("error");
      setErrorMsg("No report token provided.");
      return;
    }

    try {
      setState("loading");
      const res = await fetch(`/api/reports/share/${token}`);
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
      } else if (json.type === "NOT_FOUND" || res.status === 404) {
        setState("not_found");
      } else {
        setState("error");
        setErrorMsg(json.message || "Failed to load report data.");
      }
    } catch {
      setState("error");
      setErrorMsg("Network error connecting to CashWise server.");
    }
  }, [token]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ─── Filtered Data ──────────────────────────────────────────────────────────

  const rows = useMemo(() => snapshot?.rows || [], [snapshot]);

  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.userName) set.add(r.userName);
    });
    return Array.from(set).sort();
  }, [rows]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [rows]);

  const uniqueSources = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.source).filter(Boolean))).sort();
  }, [rows]);

  // Progressive faceting: global filters → users → categories → dates/table.
  // Keeping each stage separate lets users select more than one card without
  // making the remaining user/category cards disappear.
  const globallyFilteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilters.length > 0 && !statusFilters.includes(r.status?.toLowerCase())) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (fromDateFilter && r.date < fromDateFilter) return false;
      if (toDateFilter && r.date > toDateFilter) return false;

      if (q) {
        const text = `${r.userName} ${r.siteName} ${r.category} ${r.description} ${r.remarks} ${r.source} ${r.date}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [rows, search, statusFilters, typeFilter, sourceFilter, fromDateFilter, toDateFilter]);

  const userFilteredRows = useMemo(
    () => userFilters.length === 0 ? globallyFilteredRows : globallyFilteredRows.filter((row) => userFilters.includes(row.userName)),
    [globallyFilteredRows, userFilters]
  );

  const filteredRows = useMemo(
    () => categoryFilters === null ? userFilteredRows : userFilteredRows.filter((row) => categoryFilters.includes(row.category)),
    [userFilteredRows, categoryFilters]
  );

  // Summary computed dynamically over filtered rows
  const activeSummary = useMemo(() => {
    let exp = 0;
    let cr = 0;
    let db = 0;
    let grand = 0;

    filteredRows.forEach((r) => {
      const a = Number(r.amount || 0);
      if (r.type === "expense") exp += a;
      else if (r.type === "credit") cr += a;
      else if (r.type === "debit") db += a;
      grand += a;
    });

    return {
      expenseTotal: exp,
      creditTotal: cr,
      debitTotal: db,
      grandTotal: grand,
      netCreditDebit: cr - db,
      count: filteredRows.length,
      avg: filteredRows.length > 0 ? grand / filteredRows.length : 0,
    };
  }, [filteredRows]);

  // Groupings for analysis tabs
  const byUserAnalysis = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    globallyFilteredRows.forEach((r) => {
      const key = r.userName || "Unknown";
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += Number(r.amount || 0);
      map[key].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [globallyFilteredRows]);

  const byCategoryAnalysis = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    userFilteredRows.forEach((r) => {
      const key = r.category || "Uncategorized";
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += Number(r.amount || 0);
      map[key].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [userFilteredRows]);

  const byDateAnalysis = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filteredRows.forEach((r) => {
      const key = r.date || "Unknown";
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += Number(r.amount || 0);
      map[key].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredRows]);

  const globalFacetTotal = useMemo(() => globallyFilteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [globallyFilteredRows]);
  const userFacetTotal = useMemo(() => userFilteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [userFilteredRows]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopyLink = () => {
    if (!currentUrl) return;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const handleShareWhatsApp = () => {
    if (!snapshot) return;
    const text =
      `*CashWise Report:* ${snapshot.scheduleName || "Executive Summary"}\n` +
      `📅 Period: ${snapshot.fromDate} to ${snapshot.toDate}\n` +
      `💰 Total: ${fmtINR(activeSummary.grandTotal)} (${activeSummary.count} records)\n` +
      `🔗 View Report: ${currentUrl}\n` +
      `_Note: Link valid for 24 hours._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareEmail = () => {
    if (!snapshot) return;
    const subject = `CashWise Report: ${snapshot.scheduleName || "Executive Summary"}`;
    const body =
      `Hello,\n\nPlease find the financial report details below:\n\n` +
      `Report: ${snapshot.scheduleName || "Financial Report"}\n` +
      `Type: ${snapshot.reportType.toUpperCase()}\n` +
      `Period: ${snapshot.fromDate} to ${snapshot.toDate}\n` +
      `Total: ${fmtINR(activeSummary.grandTotal)}\n` +
      `Transactions: ${activeSummary.count}\n\n` +
      `Access the full report dashboard securely at:\n${currentUrl}\n\n` +
      `This temporary link will expire 24 hours from generation.\n\n` +
      `Best regards,\nCashWise Finance`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleDownloadPDF = () => {
    if (!snapshot) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Header banner
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 297, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(snapshot.scheduleName || "CashWise Report", 14, 11);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Period: ${snapshot.fromDate} to ${snapshot.toDate}  |  Type: ${(snapshot.reportType || "EXPENSE").toUpperCase()}  |  Records: ${activeSummary.count}  |  Grand Total: ${fmtINR(activeSummary.grandTotal)}`,
      14,
      18
    );

    // Summary strip
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 24, 297, 12, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Expense: ${fmtINR(activeSummary.expenseTotal)}`, 14, 31);
    doc.text(`Credit: ${fmtINR(activeSummary.creditTotal)}`, 85, 31);
    doc.text(`Debit: ${fmtINR(activeSummary.debitTotal)}`, 150, 31);
    doc.text(`Grand Total: ${fmtINR(activeSummary.grandTotal)}`, 220, 31);

    // Table
    const tableCols = ["#", "Date", "User", "Type", "Source", "Category", "Site / Party", "Amount", "Status", "Description"];
    const tableRows = filteredRows.map((r, i) => [
      String(i + 1),
      r.date,
      r.userName,
      r.type,
      r.source || "—",
      r.category || "—",
      r.siteName || "—",
      fmtINR(r.amount),
      r.status,
      (r.description || r.remarks || "—").slice(0, 60),
    ]);

    autoTable(doc, {
      head: [tableCols],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 7: { halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });

    const fileDate = new Date().toISOString().split("T")[0];
    doc.save(`cashwise-report-${snapshot.fromDate}-${fileDate}.pdf`);
  };

  // ─── Status Screen Renders ──────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <div style={styles.centerBox}>
        <div style={styles.spinner} />
        <h2 style={{ fontSize: 18, color: "#1e293b", margin: "16px 0 6px" }}>Loading Report</h2>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Validating secure 24-hour access token…</p>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div style={styles.centerBox}>
        <div style={styles.stateCard}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⏱️</div>
          <h1 style={styles.stateTitle}>Report Link Expired</h1>
          <p style={styles.stateText}>
            For security, shareable report links in CashWise expire automatically after <strong>24 hours</strong>.
          </p>
          {expiresAt && (
            <div style={styles.timeTag}>
              Expired on: {new Date(expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          )}
          <p style={{ ...styles.stateText, fontSize: 12, marginTop: 14, color: "#94a3b8" }}>
            Please contact your CashWise administrator to generate or email an updated report.
          </p>
        </div>
      </div>
    );
  }

  if (state === "revoked") {
    return (
      <div style={styles.centerBox}>
        <div style={styles.stateCard}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <h1 style={styles.stateTitle}>Access Revoked</h1>
          <p style={styles.stateText}>This report link has been revoked by the administrator.</p>
        </div>
      </div>
    );
  }

  if (state === "not_found") {
    return (
      <div style={styles.centerBox}>
        <div style={styles.stateCard}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
          <h1 style={styles.stateTitle}>Report Not Found</h1>
          <p style={styles.stateText}>The requested report does not exist or may have already been purged.</p>
        </div>
      </div>
    );
  }

  if (state === "error" || !snapshot) {
    return (
      <div style={styles.centerBox}>
        <div style={styles.stateCard}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
          <h1 style={styles.stateTitle}>Unable to Display Report</h1>
          <p style={styles.stateText}>{errorMsg || "An unexpected error occurred."}</p>
          <button onClick={loadReport} style={styles.primaryBtn}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ─── Dashboard Screen ───────────────────────────────────────────────────────

  const theme = TYPE_THEMES[snapshot.reportType] || TYPE_THEMES.expense;
  const hasCreditsOrDebits = ["credit", "debit", "combined"].includes(snapshot.reportType);

  return (
    <div style={styles.page}>
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header style={styles.topHeader}>
        <div style={styles.headerLeft}>
          <div style={{ ...styles.logoBadge, background: theme.primary }}>
            {snapshot.reportType === "credit" ? "💳" : snapshot.reportType === "debit" ? "🧾" : "📊"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h1 style={styles.reportTitle}>{snapshot.scheduleName || "Executive Expense Report"}</h1>
              <span style={{ ...styles.badge, background: theme.light, color: theme.primary, borderColor: theme.border }}>
                {snapshot.period.toUpperCase()} · {snapshot.reportType.toUpperCase()}
              </span>
            </div>
            <p style={styles.reportMeta}>
              <span>Period: <strong>{fmtDate(snapshot.fromDate)}</strong> to <strong>{fmtDate(snapshot.toDate)}</strong></span>
              {expiresAt && (
                <span style={{ color: "#d97706", marginLeft: 12 }}>
                  ⏳ Link valid until {new Date(expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Share & Export Actions */}
        <div style={styles.headerActions}>
          <button onClick={handleDownloadPDF} style={{ ...styles.actionBtn, background: theme.primary, color: "#fff" }}>
            📥 Download PDF
          </button>
          <button onClick={handleShareWhatsApp} style={{ ...styles.actionBtn, background: "#25d366", color: "#fff" }}>
            WhatsApp
          </button>
          <button onClick={handleShareEmail} style={{ ...styles.actionBtn, background: "#0284c7", color: "#fff" }}>
            Email
          </button>
          <button onClick={handleCopyLink} style={{ ...styles.actionBtn, background: copied ? "#16a34a" : "#e2e8f0", color: copied ? "#fff" : "#1e293b" }}>
            {copied ? "✓ Copied" : "🔗 Copy Link"}
          </button>
        </div>
      </header>

      {/* ── Main Dashboard Content ──────────────────────────────────────────── */}
      <main style={styles.mainContainer}>
        {/* KPI Cards */}
        <div style={styles.kpiGrid}>
          <div style={{ ...styles.kpiCard, borderTop: `4px solid ${theme.primary}` }}>
            <div style={styles.kpiLabel}>Grand Total</div>
            <div style={{ ...styles.kpiVal, color: theme.primary }}>{fmtINR(activeSummary.grandTotal)}</div>
            <div style={styles.kpiSub}>{activeSummary.count} transactions included</div>
          </div>

          <div style={{ ...styles.kpiCard, borderTop: "4px solid #10b981" }}>
            <div style={styles.kpiLabel}>Expense Total</div>
            <div style={{ ...styles.kpiVal, color: "#10b981" }}>{fmtINR(activeSummary.expenseTotal)}</div>
            <div style={styles.kpiSub}>{filteredRows.filter((r) => r.type === "expense").length} expense records</div>
          </div>

          {hasCreditsOrDebits && (
            <>
              <div style={{ ...styles.kpiCard, borderTop: "4px solid #16a34a" }}>
                <div style={styles.kpiLabel}>Credit Total</div>
                <div style={{ ...styles.kpiVal, color: "#16a34a" }}>{fmtINR(activeSummary.creditTotal)}</div>
                <div style={styles.kpiSub}>{filteredRows.filter((r) => r.type === "credit").length} credit records</div>
              </div>

              <div style={{ ...styles.kpiCard, borderTop: "4px solid #dc2626" }}>
                <div style={styles.kpiLabel}>Debit Total</div>
                <div style={{ ...styles.kpiVal, color: "#dc2626" }}>{fmtINR(activeSummary.debitTotal)}</div>
                <div style={styles.kpiSub}>{filteredRows.filter((r) => r.type === "debit").length} debit records</div>
              </div>
              <div style={{ ...styles.kpiCard, borderTop: "4px solid #0ea5e9" }}>
                <div style={styles.kpiLabel}>Net Credit − Debit</div>
                <div style={{ ...styles.kpiVal, color: activeSummary.netCreditDebit >= 0 ? "#0284c7" : "#dc2626" }}>
                  {fmtINR(activeSummary.netCreditDebit)}
                </div>
                <div style={styles.kpiSub}>credit less debit for the current filters</div>
              </div>
            </>
          )}

          <div style={{ ...styles.kpiCard, borderTop: "4px solid #8b5cf6" }}>
            <div style={styles.kpiLabel}>Average per Entry</div>
            <div style={{ ...styles.kpiVal, color: "#8b5cf6" }}>{fmtINR(activeSummary.avg)}</div>
            <div style={styles.kpiSub}>across filtered items</div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div style={styles.filterBar}>
          <input
            type="text"
            placeholder="🔍 Search user, description, category, site..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={styles.searchInput}
          />

          <select
            value={userFilters.length === 1 ? userFilters[0] : "all"}
            onChange={(e) => {
              setUserFilters(e.target.value === "all" ? [] : [e.target.value]);
              setCategoryFilters(null);
              setCurrentPage(1);
            }}
            style={styles.filterDropdown}
          >
            <option value="all">{userFilters.length > 1 ? `${userFilters.length} users selected` : `All Users (${uniqueUsers.length})`}</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }} style={styles.filterDropdown}>
            <option value="all">All Expense Types</option>
            {uniqueSources.map((source) => <option key={source} value={source}>{source === "toPay" ? "To Pay" : source}</option>)}
          </select>

          <input aria-label="From date" type="date" value={fromDateFilter}
            onChange={(e) => { setFromDateFilter(e.target.value); setCurrentPage(1); }} style={styles.filterDropdown} />
          <input aria-label="To date" type="date" value={toDateFilter}
            onChange={(e) => { setToDateFilter(e.target.value); setCurrentPage(1); }} style={styles.filterDropdown} />

          <button onClick={() => { setSearch(""); setStatusFilters([]); setUserFilters([]); setCategoryFilters(null); setTypeFilter("all"); setSourceFilter("all"); setFromDateFilter(""); setToDateFilter(""); setCurrentPage(1); }} style={styles.pageBtn}>
            Reset filters
          </button>

          <div style={{ marginLeft: "auto", fontSize: 13, color: "#64748b", fontWeight: 600 }}>
            Showing {filteredRows.length} of {rows.length}
          </div>
        </div>

        <div style={styles.quickFilterPanel}>
          <div style={styles.filterGroup}>
            <div style={styles.filterLabel}>Report Type</div>
            <div style={styles.chipRow}>
              {(["all", "expense", "credit", "debit"] as const).map((type) => {
                const count = type === "all" ? rows.length : rows.filter((row) => row.type === type).length;
                return <button key={type} onClick={() => { setTypeFilter(type); setCurrentPage(1); }} style={{ ...styles.filterChip, ...(typeFilter === type ? styles.filterChipActive : {}) }}>
                  {type === "expense" ? "📊" : type === "credit" ? "💳" : type === "debit" ? "🧾" : "📈"} {type === "all" ? "Combined" : type[0].toUpperCase() + type.slice(1)} <strong>{count}</strong>
                </button>;
              })}
            </div>
          </div>

          <div style={styles.filterGroup}>
            <div style={styles.filterLabel}>Status</div>
            <div style={styles.chipRow}>
              {["pending", "approved", "rejected"].map((status) => <button key={status}
                onClick={() => { setStatusFilters((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status]); setCurrentPage(1); }}
                style={{ ...styles.filterChip, ...(statusFilters.includes(status) ? styles.filterChipActive : {}) }}>{status[0].toUpperCase() + status.slice(1)}</button>)}
            </div>
          </div>

          <details style={styles.advancedFilters}>
            <summary style={styles.filterSummary}>Category and table-field filters</summary>
            <div style={styles.filterGroup}>
              <div style={styles.filterLabel}>Filter by Category <button onClick={() => setCategoryFilters(null)} style={styles.textBtn}>All</button> · <button onClick={() => setCategoryFilters([])} style={styles.textBtn}>None</button></div>
              <div style={styles.chipRow}>{uniqueCategories.map((category) => <button key={category}
                onClick={() => { setCategoryFilters((current) => current === null ? [category] : current.includes(category) ? current.filter((item) => item !== category) : [...current, category]); setCurrentPage(1); }}
                style={{ ...styles.filterChip, ...(categoryFilters === null || categoryFilters.includes(category) ? styles.filterChipActive : {}) }}>{category}</button>)}</div>
            </div>
            <div style={styles.filterGroup}>
              <div style={styles.filterLabel}>Table Fields <button onClick={() => setVisibleFields(["date", "user", "type", "source", "category", "site", "amount", "status", "description", "attachments"])} style={styles.textBtn}>All</button> · <button onClick={() => setVisibleFields(["date", "user", "site", "category", "amount", "status"])} style={styles.textBtn}>Default</button></div>
              <div style={styles.chipRow}>{[
                ["date", "Date"], ["user", "User"], ["type", "Type"], ["source", "Expense Type"], ["category", "Category"], ["site", "Site/Party"], ["amount", "Amount"], ["status", "Status"], ["description", "Description"], ["attachments", "Attachments"],
              ].map(([field, label]) => <button key={field} onClick={() => setVisibleFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])}
                style={{ ...styles.filterChip, ...(visibleFields.includes(field) ? styles.filterChipActive : {}) }}>{label}</button>)}</div>
            </div>
          </details>
        </div>

        {/* View Tabs */}
        <div style={styles.tabNav}>
          <button
            onClick={() => setActiveTab("table")}
            style={{ ...styles.tabBtn, ...(activeTab === "table" ? styles.tabBtnActive : {}) }}
          >
            📋 Detailed Transactions ({filteredRows.length})
          </button>
          <button
            onClick={() => setActiveTab("user")}
            style={{ ...styles.tabBtn, ...(activeTab === "user" ? styles.tabBtnActive : {}) }}
          >
            👤 By User ({byUserAnalysis.length})
          </button>
          <button
            onClick={() => setActiveTab("category")}
            style={{ ...styles.tabBtn, ...(activeTab === "category" ? styles.tabBtnActive : {}) }}
          >
            🏷 By Category ({byCategoryAnalysis.length})
          </button>
          <button
            onClick={() => setActiveTab("date")}
            style={{ ...styles.tabBtn, ...(activeTab === "date" ? styles.tabBtnActive : {}) }}
          >
            📅 By Date ({byDateAnalysis.length})
          </button>
        </div>

        {/* ── Tab Content: Detailed Table ─────────────────────────────────────── */}
        {activeTab === "table" && (
          <div style={styles.tableCard}>
            {filteredRows.length === 0 ? (
              <div style={styles.emptyNotice}>
                <div style={{ fontSize: 36 }}>📂</div>
                <h3 style={{ margin: "10px 0 4px", color: "#334155" }}>No records match your filters</h3>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>Try clearing your search or status filters</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeadRow}>
                        <th style={{ ...styles.th, width: 44, textAlign: "center" }}>#</th>
                        {visibleFields.includes("date") && <th style={styles.th}>Date</th>}
                        {visibleFields.includes("user") && <th style={styles.th}>User</th>}
                        {visibleFields.includes("type") && <th style={styles.th}>Type</th>}
                        {visibleFields.includes("source") && <th style={styles.th}>Expense Type</th>}
                        {visibleFields.includes("category") && <th style={styles.th}>Head / Category</th>}
                        {visibleFields.includes("site") && <th style={styles.th}>Site / Party</th>}
                        {visibleFields.includes("amount") && <th style={{ ...styles.th, textAlign: "right" }}>Amount</th>}
                        {visibleFields.includes("status") && <th style={styles.th}>Status</th>}
                        {visibleFields.includes("description") && <th style={styles.th}>Description / Remarks</th>}
                        {visibleFields.includes("attachments") && <th style={{ ...styles.th, textAlign: "center" }}>Attachments</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row, idx) => {
                        const globalIndex = (currentPage - 1) * pageSize + idx + 1;
                        const stBadge = STATUS_BADGES[row.status?.toLowerCase()] || STATUS_BADGES.default;

                        return (
                          <tr key={row._id || idx} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                            <td style={{ ...styles.td, textAlign: "center", color: "#94a3b8", fontSize: 11 }}>
                              {globalIndex}
                            </td>
                            {visibleFields.includes("date") && <td style={{ ...styles.td, whiteSpace: "nowrap", fontWeight: 500 }}>
                              {fmtDate(row.date)}
                            </td>}
                            {visibleFields.includes("user") && <td style={{ ...styles.td, fontWeight: 600, color: "#0f172a" }}>
                              {row.userName || "—"}
                            </td>}
                            {visibleFields.includes("type") && (
                              <td style={styles.td}>
                                <span
                                  style={{
                                    ...styles.badge,
                                    textTransform: "uppercase",
                                    fontSize: 10,
                                    background: TYPE_THEMES[row.type]?.light || "#f1f5f9",
                                    color: TYPE_THEMES[row.type]?.primary || "#475569",
                                    borderColor: TYPE_THEMES[row.type]?.border || "#cbd5e1",
                                  }}
                                >
                                  {row.type}
                                </span>
                              </td>
                            )}
                            {visibleFields.includes("source") && <td style={{ ...styles.td, textTransform: "capitalize", color: "#64748b" }}>
                              {row.source || "—"}
                            </td>}
                            {visibleFields.includes("category") && <td style={styles.td}>
                              <span style={styles.categoryPill}>{row.category || "—"}</span>
                            </td>}
                            {visibleFields.includes("site") && <td style={{ ...styles.td, color: "#334155" }}>{row.siteName || "—"}</td>}
                            {visibleFields.includes("amount") && <td style={{ ...styles.td, textAlign: "right", fontWeight: 700, color: theme.primary, fontVariantNumeric: "tabular-nums" }}>
                              {fmtINR(row.amount)}
                            </td>}
                            {visibleFields.includes("status") && <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.badge,
                                  background: stBadge.bg,
                                  color: stBadge.text,
                                  borderColor: stBadge.border,
                                }}
                              >
                                {row.status || "—"}
                              </span>
                            </td>}
                            {visibleFields.includes("description") && <td style={{ ...styles.td, maxWidth: 260, color: "#475569", fontSize: 12 }}>
                              {row.description || row.remarks || "—"}
                            </td>}
                            {visibleFields.includes("attachments") && <td style={{ ...styles.td, textAlign: "center" }}>
                              {row.attachments && row.attachments.length > 0 ? (
                                <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                                  {row.attachments.map((url, aIdx) => (
                                    <button
                                      key={aIdx}
                                      onClick={() => setPreviewImage(url)}
                                      style={styles.attachmentPill}
                                      title="Click to view file"
                                    >
                                      📎 #{aIdx + 1}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: "#cbd5e1" }}>—</span>
                              )}
                            </td>}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={styles.tfootRow}>
                        <td colSpan={Math.max(1, visibleFields.length + 1)} style={{ ...styles.td, fontWeight: 800, color: theme.primary, fontSize: 14 }}>
                          Filtered total: {fmtINR(activeSummary.grandTotal)} · {filteredRows.length} transactions
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Pagination Bar */}
                {totalPages > 1 && (
                  <div style={styles.paginationBar}>
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage <= 1}
                      style={styles.pageBtn}
                    >
                      « First
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      style={styles.pageBtn}
                    >
                      ‹ Previous
                    </button>
                    <span style={styles.pageText}>
                      Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      style={styles.pageBtn}
                    >
                      Next ›
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage >= totalPages}
                      style={styles.pageBtn}
                    >
                      Last »
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tab Content: By User ────────────────────────────────────────────── */}
        {activeTab === "user" && (
          <div style={styles.analysisGrid}>
            {byUserAnalysis.map(([name, data]) => {
              const pct = calcPct(data.total, globalFacetTotal);
              const selected = userFilters.includes(name);
              return (
                <button key={name} type="button" aria-pressed={selected}
                  onClick={() => { setUserFilters((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]); setCurrentPage(1); }}
                  style={{ ...styles.analysisCard, ...styles.analysisButton, ...(selected ? styles.analysisCardSelected : {}) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>👤 {name}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: theme.primary }}>{fmtINR(data.total)}</div>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: pct, background: theme.primary }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    <span>{data.count} transaction{data.count !== 1 ? "s" : ""}</span>
                    <span><strong>{pct}</strong> of total</span>
                  </div>
                  <div style={styles.cardSelectionHint}>{selected ? "✓ Selected — click to remove" : "+ Add user to filter"}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tab Content: By Category ────────────────────────────────────────── */}
        {activeTab === "category" && (
          <div style={styles.analysisGrid}>
            {byCategoryAnalysis.map(([cat, data]) => {
              const pct = calcPct(data.total, userFacetTotal);
              const selected = categoryFilters === null || categoryFilters.includes(cat);
              return (
                <button key={cat} type="button" aria-pressed={selected}
                  onClick={() => { setCategoryFilters((current) => current === null ? [cat] : current.includes(cat) ? current.filter((item) => item !== cat) : [...current, cat]); setCurrentPage(1); }}
                  style={{ ...styles.analysisCard, ...styles.analysisButton, ...(selected && categoryFilters !== null ? styles.analysisCardSelected : {}) }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>🏷️ {cat}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0891b2" }}>{fmtINR(data.total)}</div>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: pct, background: "#0891b2" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    <span>{data.count} item{data.count !== 1 ? "s" : ""}</span>
                    <span><strong>{pct}</strong> of total</span>
                  </div>
                  <div style={styles.cardSelectionHint}>{categoryFilters === null ? "+ Click to focus this category" : selected ? "✓ Selected — click to remove" : "+ Add category to filter"}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tab Content: By Date ────────────────────────────────────────────── */}
        {activeTab === "date" && (
          <div style={styles.analysisGrid}>
            {byDateAnalysis.map(([date, data]) => {
              const pct = calcPct(data.total, activeSummary.grandTotal);
              return (
                <div key={date} style={styles.analysisCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>📅 {fmtDate(date)}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#16a34a" }}>{fmtINR(data.total)}</div>
                  </div>
                  <div style={styles.progressTrack}>
                    <div style={{ ...styles.progressFill, width: pct, background: "#16a34a" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    <span>{data.count} entry{data.count !== 1 ? "ies" : "y"}</span>
                    <span><strong>{pct}</strong> of total</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <footer style={styles.pageFooter}>
          <div>
            <strong>CashWise Financial Intelligence</strong> · Automated Executive Expense Summary
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            {createdAt && `Generated: ${new Date(createdAt).toLocaleString("en-IN")}  |  `}
            Confidential · Intended solely for authorized recipients.
          </div>
        </footer>
      </main>

      {/* ── Attachment Modal ────────────────────────────────────────────────── */}
      {previewImage && (
        <div style={styles.modalOverlay} onClick={() => setPreviewImage(null)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#1e293b" }}>Attachment Preview</h3>
              <button onClick={() => setPreviewImage(null)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              {previewImage.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={previewImage} alt="Attachment" style={styles.modalImg} />
              ) : previewImage.match(/\.pdf(\?.*)?$/i) ? (
                <iframe src={previewImage} title="PDF attachment" style={{ width: "100%", height: "75vh", border: 0, borderRadius: 8 }} />
              ) : (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ color: "#475569", marginBottom: 16 }}>File preview not available for this format.</p>
                  <a
                    href={previewImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...styles.primaryBtn, textDecoration: "none" }}
                  >
                    Open in New Tab ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Styles ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: "#1e293b",
  },
  centerBox: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    padding: 24,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  spinner: {
    width: 44,
    height: 44,
    border: "4px solid #e2e8f0",
    borderTop: "4px solid #4f46e5",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  stateCard: {
    background: "#fff",
    borderRadius: 18,
    padding: "36px 32px",
    maxWidth: 460,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
    border: "1px solid #e2e8f0",
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 10px",
  },
  stateText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
  },
  timeTag: {
    display: "inline-block",
    marginTop: 14,
    padding: "6px 14px",
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 600,
  },
  primaryBtn: {
    display: "inline-block",
    marginTop: 20,
    padding: "10px 22px",
    background: "#4f46e5",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  topHeader: {
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    padding: "14px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 14,
    position: "sticky",
    top: 0,
    zIndex: 40,
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    color: "#fff",
    flexShrink: 0,
    boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.2)",
  },
  reportTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.01em",
  },
  reportMeta: {
    margin: "3px 0 0",
    fontSize: 12,
    color: "#64748b",
  },
  badge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: "8px 14px",
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  mainContainer: {
    maxWidth: 1320,
    margin: "0 auto",
    padding: "24px 20px 60px",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
    marginBottom: 20,
  },
  kpiCard: {
    background: "#fff",
    borderRadius: 14,
    padding: "16px 20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    border: "1px solid #e2e8f0",
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  kpiVal: {
    fontSize: 24,
    fontWeight: 800,
    margin: "6px 0 2px",
    fontVariantNumeric: "tabular-nums",
  },
  kpiSub: {
    fontSize: 11,
    color: "#94a3b8",
  },
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    background: "#ffffff",
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    marginBottom: 16,
  },
  searchInput: {
    flex: "1 1 240px",
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 13,
    outline: "none",
    background: "#f8fafc",
  },
  filterDropdown: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 12,
    background: "#f8fafc",
    color: "#1e293b",
    cursor: "pointer",
  },
  quickFilterPanel: {
    background: "#ffffff",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    marginBottom: 18,
    boxShadow: "0 1px 2px rgba(15,23,42,.03)",
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    marginBottom: 8,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
  },
  filterChip: {
    padding: "7px 11px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 12,
    fontWeight: 650,
    cursor: "pointer",
    textTransform: "capitalize",
  },
  filterChipActive: {
    background: "#eef2ff",
    borderColor: "#818cf8",
    color: "#4338ca",
  },
  advancedFilters: {
    marginTop: 6,
    paddingTop: 10,
    borderTop: "1px solid #e2e8f0",
  },
  filterSummary: {
    cursor: "pointer",
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: 750,
    marginBottom: 12,
  },
  textBtn: {
    border: 0,
    background: "transparent",
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    padding: "2px 4px",
  },
  tabNav: {
    display: "flex",
    gap: 6,
    borderBottom: "2px solid #e2e8f0",
    marginBottom: 16,
    overflowX: "auto",
  },
  tabBtn: {
    padding: "10px 18px",
    border: "none",
    background: "transparent",
    fontSize: 13,
    fontWeight: 600,
    color: "#64748b",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    marginBottom: -2,
    whiteSpace: "nowrap",
  },
  tabBtnActive: {
    color: "#4f46e5",
    borderBottomColor: "#4f46e5",
    fontWeight: 700,
  },
  tableCard: {
    background: "#ffffff",
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  tableHeadRow: {
    background: "#f8fafc",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 14px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },
  trEven: {
    background: "#ffffff",
  },
  trOdd: {
    background: "#fafbfc",
  },
  tfootRow: {
    background: "#f8fafc",
    borderTop: "2px solid #e2e8f0",
  },
  categoryPill: {
    display: "inline-block",
    padding: "2px 8px",
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "capitalize",
  },
  attachmentPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 6px",
    background: "#eff6ff",
    color: "#2563eb",
    border: "1px solid #bfdbfe",
    borderRadius: 6,
    fontSize: 11,
    cursor: "pointer",
    fontWeight: 600,
  },
  paginationBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 16px",
    borderTop: "1px solid #e2e8f0",
    background: "#fafbfc",
  },
  pageBtn: {
    padding: "6px 12px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "#334155",
    cursor: "pointer",
  },
  pageText: {
    fontSize: 12,
    color: "#64748b",
    margin: "0 8px",
  },
  analysisGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 14,
  },
  analysisCard: {
    background: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "16px 18px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  analysisButton: {
    width: "100%",
    textAlign: "left",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "border-color .15s ease, box-shadow .15s ease, transform .15s ease",
  },
  analysisCardSelected: {
    border: "2px solid #6366f1",
    background: "#f5f3ff",
    boxShadow: "0 0 0 3px rgba(99,102,241,.10)",
  },
  cardSelectionHint: {
    marginTop: 10,
    paddingTop: 9,
    borderTop: "1px solid #e2e8f0",
    color: "#6366f1",
    fontSize: 11,
    fontWeight: 700,
  },
  progressTrack: {
    height: 7,
    background: "#f1f5f9",
    borderRadius: 100,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 100,
    transition: "width 0.3s ease",
  },
  emptyNotice: {
    textAlign: "center",
    padding: "48px 20px",
  },
  pageFooter: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: "1px solid #e2e8f0",
    textAlign: "center",
    fontSize: 12,
    color: "#64748b",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 20,
  },
  modalBox: {
    background: "#ffffff",
    borderRadius: 16,
    maxWidth: 720,
    width: "100%",
    overflow: "hidden",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    padding: "14px 20px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalCloseBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    cursor: "pointer",
    color: "#64748b",
  },
  modalBody: {
    padding: 16,
    maxHeight: "80vh",
    overflowY: "auto",
    display: "flex",
    justifyContent: "center",
  },
  modalImg: {
    maxWidth: "100%",
    maxHeight: "70vh",
    objectFit: "contain",
    borderRadius: 8,
  },
};
