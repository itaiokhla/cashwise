/**
 * @app/_lib/autoExpenseReport.ts
 *
 * Automated report orchestrator: runs the report engine, creates a
 * 24-hour secure share link, sends email to recipients.
 *
 * This is called by:
 *  - /api/cron/expense-reports  (scheduled runs)
 *  - /api/reports/generate-now  (manual admin trigger)
 *  - /api/settings/scheduled-reports/test  (test run)
 */

import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { DateTime } from "luxon";
import mongoose from "mongoose";

import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";
import ReportExecution from "@app/_model/reportExecution.model";
import ReportShareLink, { generateShareToken } from "@app/_model/reportShareLink.model";
import { uploadToImageKit } from "@app/_lib/uploadHelpers";
import {
  runReportEngine,
  NormalisedRow,
  ReportSummary,
  ReportEngineFilters,
  fmtINR,
  type ReportEngineType,
  type ExpenseSource,
  type ExpenseStatus,
} from "@app/_lib/reportEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpensePeriod = "daily" | "weekly" | "monthly";

export interface AutoReportConfig {
  scheduleId?: string;
  scheduleName?: string;
  reportType?: ReportEngineType | "office" | "travel" | "toPay" | "all";
  frequency?: "daily" | "weekly" | "monthly";
  time?: string;
  period?: ExpensePeriod | "all";
  timezone?: string;
  recipients?: string[];
  executionKey?: string;
  triggeredBy?: "cron" | "manual_test" | "scheduler" | "manual_generate";
  // Filter overrides from schedule
  filters?: {
    userIds?: string[];
    expenseSources?: ExpenseSource[];
    categories?: string[];
    statuses?: ExpenseStatus[];
    includeCredit?: boolean;
    includeDebit?: boolean;
    visibleFields?: string[];
    search?: string;
  };
  // App base URL for generating share links
  appBaseUrl?: string;
}

export interface AutoReportResult {
  skipped?: boolean;
  reason?: string;
  executionKey: string;
  recipient?: string;
  recipients?: string[];
  recordCount: number;
  totalAmount: number;
  durationMs: number;
  shareUrl?: string;
  shareExpiresAt?: Date;
  pdfUrls?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RECIPIENT = process.env.AUTO_EXPENSE_REPORT_TO || "officepulse@intertech.com";
const DEFAULT_TIMEZONE = process.env.AUTO_EXPENSE_REPORT_TIMEZONE || "Asia/Kolkata";
const APP_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL?.replace("/api", "") || "http://localhost:3000";
const SHARE_LINK_TTL_HOURS = 24;

const PERIOD_CONFIG = {
  daily:   { color: "#2563eb", light: "#dbeafe", icon: "📅", label: "Daily" },
  weekly:  { color: "#16a34a", light: "#dcfce7", icon: "📊", label: "Weekly" },
  monthly: { color: "#7c3aed", light: "#ede9fe", icon: "📈", label: "Monthly" },
};

// ─── Timezone-aware period calculation ───────────────────────────────────────

function getPeriodRange(period: ExpensePeriod, now: DateTime) {
  // All boundaries computed in the schedule timezone — never UTC
  const today = now.startOf("day");

  if (period === "daily") {
    // Previous calendar day: 00:00:00 → 23:59:59
    const yesterday = today.minus({ days: 1 });
    return {
      from: yesterday.toISODate()!,
      to: yesterday.toISODate()!,
      title: "Daily Expense Report",
    };
  }

  if (period === "weekly") {
    // Previous week: Mon–Sun (ISO week)
    const thisWeekStart = today.startOf("week"); // Monday
    const lastWeekEnd = thisWeekStart.minus({ days: 1 }); // Sunday
    const lastWeekStart = lastWeekEnd.startOf("week");
    return {
      from: lastWeekStart.toISODate()!,
      to: lastWeekEnd.toISODate()!,
      title: "Weekly Expense Report",
    };
  }

  // Monthly: previous full calendar month
  const lastMonthEnd = today.startOf("month").minus({ days: 1 });
  const lastMonthStart = lastMonthEnd.startOf("month");
  return {
    from: lastMonthStart.toISODate()!,
    to: lastMonthEnd.toISODate()!,
    title: "Monthly Expense Report",
  };
}

// ─── nextRunAt calculator ─────────────────────────────────────────────────────

export function computeNextRun(
  frequency: "daily" | "weekly" | "monthly",
  timeStr: string,
  zone: string = DEFAULT_TIMEZONE,
  referenceDate = DateTime.now().setZone(zone)
): Date {
  const [hourStr, minuteStr] = (timeStr || "09:00").split(":");
  const hour = parseInt(hourStr, 10) || 9;
  const minute = parseInt(minuteStr, 10) || 0;

  let candidate = referenceDate.set({ hour, minute, second: 0, millisecond: 0 });

  if (frequency === "daily") {
    if (candidate <= referenceDate) candidate = candidate.plus({ days: 1 });
  } else if (frequency === "weekly") {
    // Target next Monday at configured time
    const daysToAdd = (1 - referenceDate.weekday + 7) % 7;
    let mondayCandidate = referenceDate.plus({ days: daysToAdd }).set({ hour, minute, second: 0, millisecond: 0 });
    if (mondayCandidate <= referenceDate) {
      mondayCandidate = mondayCandidate.plus({ weeks: 1 });
    }
    candidate = mondayCandidate;
  } else if (frequency === "monthly") {
    // 1st of month at configured time
    let monthCandidate = referenceDate.set({ day: 1, hour, minute, second: 0, millisecond: 0 });
    if (monthCandidate <= referenceDate) {
      monthCandidate = monthCandidate.plus({ months: 1 });
    }
    candidate = monthCandidate;
  } else {
    if (candidate <= referenceDate) candidate = candidate.plus({ days: 1 });
  }

  return candidate.toJSDate();
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

async function buildReportPDF(params: {
  title: string;
  fromDate: string;
  toDate: string;
  rows: NormalisedRow[];
  summary: ReportSummary;
  timezone: string;
  period: ExpensePeriod;
}): Promise<Buffer> {
  const { title, fromDate, toDate, rows, summary, timezone, period } = params;
  const cfg = PERIOD_CONFIG[period];
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const PAGE_W = 841.89;
  const MARGIN = 36;
  const TABLE_W = PAGE_W - MARGIN * 2;
  const generatedAt = DateTime.now().setZone(timezone).toFormat("dd LLL yyyy, hh:mm a");

  // ── Header band ──
  doc.rect(0, 0, PAGE_W, 76).fill(cfg.color);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text(title, MARGIN, 14);
  doc.fillColor("rgba(255,255,255,0.75)").font("Helvetica").fontSize(9)
    .text(`Period: ${fromDate} → ${toDate}   |   Generated: ${generatedAt}   |   CashWise`, MARGIN, 44);

  // ── Summary bar ──
  doc.fillColor("#f8fafc").rect(MARGIN, 88, TABLE_W, 44).fill();
  doc.fillColor(cfg.color).font("Helvetica-Bold").fontSize(9);
  doc.text(`Records: ${summary.totalRecords}`, MARGIN + 10, 98);
  doc.text(`Expense Total: ${fmtINR(summary.expenseTotal)}`, MARGIN + 100, 98);
  doc.text(`Credit Total: ${fmtINR(summary.creditTotal)}`, MARGIN + 260, 98);
  doc.text(`Debit Total: ${fmtINR(summary.debitTotal)}`, MARGIN + 400, 98);
  doc.text(`Grand Total: ${fmtINR(summary.grandTotal)}`, MARGIN + 540, 98);

  // Top 3 users
  const topUsers = Object.entries(summary.byUser).slice(0, 3)
    .map(([name, v]) => `${name}: ${fmtINR(v.total)}`).join("   ·   ");
  doc.fillColor("#64748b").font("Helvetica").fontSize(8)
    .text(topUsers || "No user data", MARGIN + 10, 116, { width: TABLE_W - 20, ellipsis: true });

  // ── Table ──
  const columns = [
    { label: "Date",        x: MARGIN,       width: 62 },
    { label: "User",        x: MARGIN + 62,  width: 100 },
    { label: "Type",        x: MARGIN + 162, width: 52 },
    { label: "Source",      x: MARGIN + 214, width: 48 },
    { label: "Category",    x: MARGIN + 262, width: 72 },
    { label: "Site/Party",  x: MARGIN + 334, width: 100 },
    { label: "Amount",      x: MARGIN + 434, width: 72 },
    { label: "Status",      x: MARGIN + 506, width: 58 },
    { label: "Description", x: MARGIN + 564, width: TABLE_W - 564 },
  ];

  let y = 148;
  let rowIndex = 0;

  const drawHeader = () => {
    doc.rect(MARGIN, y - 4, TABLE_W, 20).fill(cfg.color);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
    columns.forEach((col) => doc.text(col.label, col.x, y, { width: col.width }));
    doc.fillColor("#1e293b");
    y += 22;
  };

  drawHeader();
  doc.font("Helvetica").fontSize(8);

  if (rows.length === 0) {
    doc.fillColor("#94a3b8").text("No records found for this reporting period.", MARGIN, y + 10);
  }

  for (const row of rows) {
    if (y > 545) { doc.addPage(); y = 48; drawHeader(); doc.font("Helvetica").fontSize(8); rowIndex = 0; }
    if (rowIndex % 2 === 0) doc.fillColor("#f8fafc").rect(MARGIN, y - 2, TABLE_W, 18).fill();
    doc.fillColor("#1e293b");
    const values = [
      row.date, row.userName,
      row.type, row.source,
      row.category, row.siteName,
      fmtINR(row.amount), row.status,
      (row.description || "").toString().slice(0, 40),
    ];
    columns.forEach((col, i) => doc.text(values[i] ?? "", col.x, y, { width: col.width, height: 18, ellipsis: true }));
    y += 18;
    rowIndex++;
  }

  doc.end();
  return done;
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

function buildShareEmailHtml(params: {
  scheduleName: string;
  reportType: string;
  fromDate: string;
  toDate: string;
  period: string;
  summary: ReportSummary;
  shareUrl: string;
  pdfUrls: string[];
  expiresAt: Date;
  generatedAt: string;
}) {
  const { scheduleName, reportType, fromDate, toDate, summary, shareUrl, pdfUrls, expiresAt, generatedAt } = params;
  const expiry = new Date(expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .wrap{max-width:580px;margin:32px auto;padding:0 16px}
    .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
    .hdr{background:linear-gradient(135deg,#1e2735 0%,#312e81 100%);padding:28px 32px}
    .hdr h1{margin:0;font-size:22px;font-weight:700;color:#fff}
    .hdr p{margin:6px 0 0;font-size:12px;color:rgba(255,255,255,.6)}
    .bdy{padding:28px 32px}
    .stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px}
    .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px}
    .stat-label{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
    .stat-value{font-size:18px;font-weight:800;color:#1e293b;margin-top:4px}
    .stat-value.green{color:#16a34a}
    .cta-box{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:14px;padding:22px 24px;text-align:center;margin:20px 0}
    .cta-btn{display:inline-block;background:#fff;color:#4f46e5;padding:13px 32px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:.3px}
    .meta-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
    .pill{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:100px;padding:8px 16px;margin:3px;font-size:11px;color:#64748b;font-weight:600}
    .pill span{color:#1e293b;font-weight:700}
    .stat-grid{margin-left:-5px;margin-right:-5px}
    .stat{margin:5px}
    .note{background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:14px 18px;font-size:12px;color:#713f12;margin-top:16px}
    .note strong{display:block;margin-bottom:3px;color:#92400e;font-size:13px}
    .ftr{padding:18px 32px;border-top:1px solid #f1f5f9;text-align:center}
    .ftr p{margin:0;font-size:11px;color:#94a3b8}
    @media only screen and (max-width:600px){
      .wrap{margin:0 auto;padding:10px}
      .hdr,.bdy,.ftr{padding:20px 16px}
      .hdr h1{font-size:19px}
      .meta-pills{display:block;margin:0 0 16px}
      .pill{display:block;border-radius:10px;margin:8px 0;padding:10px 12px}
      .stat-grid{display:block;margin:0 0 18px}
      .stat{display:block;margin:10px 0;padding:14px}
      .stat-value{font-size:17px}
      .cta-box{padding:18px 12px}
      .cta-btn{display:block;padding:12px 14px}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="hdr">
        <h1>📊 ${scheduleName}</h1>
        <p>CashWise Automated Report &nbsp;·&nbsp; ${generatedAt}</p>
      </div>
      <div class="bdy">
        <div class="meta-pills">
          <div class="pill">Type <span>${reportType.toUpperCase()}</span></div>
          <div class="pill">Period <span>${fromDate} → ${toDate}</span></div>
          <div class="pill">Records <span>${summary.totalRecords.toLocaleString("en-IN")}</span></div>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <div class="stat-label">Expense Total</div>
            <div class="stat-value">${fmtINR(summary.expenseTotal)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Credit Total</div>
            <div class="stat-value green">${fmtINR(summary.creditTotal)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Debit Total</div>
            <div class="stat-value">${fmtINR(summary.debitTotal)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Grand Total</div>
            <div class="stat-value">${fmtINR(summary.grandTotal)}</div>
          </div>
        </div>

        <div class="cta-box">
          <a class="cta-btn" href="${shareUrl}" target="_blank" rel="noopener noreferrer">
            View Web Report
          </a>
          <div style="font-size:11px;color:rgba(255,255,255,.8);margin-top:10px">
            Interactive report with filters, analysis, and PDF download
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:6px;word-break:break-all">
            ${shareUrl}
          </div>
        </div>

        ${pdfUrls.length > 0 ? `
        <div style="text-align:center;margin:16px 0 8px">
          ${pdfUrls.map((url, index) => `
            <a href="${url}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;background:#0f172a;color:#fff;padding:11px 20px;margin:4px;border-radius:9px;text-decoration:none;font-weight:700;font-size:13px">
              Download PDF${pdfUrls.length > 1 ? ` ${index + 1}` : ""}
            </a>`).join("")}
          <div style="font-size:11px;color:#64748b;margin-top:8px">PDF file${pdfUrls.length > 1 ? "s are" : " is"} also attached to this email.</div>
        </div>` : ""}

        <div class="note">
          <strong>⏱ Link Expiry</strong>
          This secure report link expires on <strong>${expiry}</strong> (24 hours from generation).
          After expiry, please request a new report from the CashWise administrator.
        </div>
      </div>
      <div class="ftr">
        <p>Sent by CashWise Reports &nbsp;·&nbsp; ${generatedAt} &nbsp;·&nbsp; Do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildShareEmailText(params: {
  scheduleName: string;
  fromDate: string;
  toDate: string;
  summary: ReportSummary;
  shareUrl: string;
  pdfUrls: string[];
  expiresAt: Date;
  generatedAt: string;
}) {
  const { scheduleName, fromDate, toDate, summary, shareUrl, pdfUrls, expiresAt, generatedAt } = params;
  const expiry = new Date(expiresAt).toLocaleString("en-IN");
  return [
    `CASHWISE — ${scheduleName.toUpperCase()}`,
    `Generated: ${generatedAt}`,
    "=".repeat(45),
    "",
    `Period:        ${fromDate} → ${toDate}`,
    `Records:       ${summary.totalRecords.toLocaleString("en-IN")}`,
    `Expense Total: ${fmtINR(summary.expenseTotal)}`,
    `Credit Total:  ${fmtINR(summary.creditTotal)}`,
    `Debit Total:   ${fmtINR(summary.debitTotal)}`,
    `Grand Total:   ${fmtINR(summary.grandTotal)}`,
    "",
    "View Web Report:",
    shareUrl,
    "",
    ...pdfUrls.flatMap((url, index) => [`Download PDF${pdfUrls.length > 1 ? ` ${index + 1}` : ""}:`, url, ""]),
    "The PDF file is also attached to this email.",
    "",
    `⏱ Link expires: ${expiry}`,
    "---",
    "Sent by CashWise. Do not reply.",
  ].join("\n");
}

// ─── Main Export: sendAutomatedExpenseReports ─────────────────────────────────

export async function sendAutomatedExpenseReports(
  config?: AutoReportConfig
): Promise<AutoReportResult> {
  await DB();

  const startTime = Date.now();
  const timezone = config?.timezone || DEFAULT_TIMEZONE;
  const now = DateTime.now().setZone(timezone);
  const generatedAt = now.toFormat("dd LLL yyyy, hh:mm a");

  const recipients =
    config?.recipients && config.recipients.length > 0
      ? config.recipients
      : [DEFAULT_RECIPIENT];

  const rawReportType = config?.reportType || "expense";
  // Normalise legacy types: "office" | "travel" | "toPay" | "all" → "expense"
  const reportType: ReportEngineType =
    (["expense", "credit", "debit", "combined"] as const).includes(rawReportType as ReportEngineType)
      ? (rawReportType as ReportEngineType)
      : "expense";

  const triggeredBy = config?.triggeredBy || "cron";
  const scheduleName = config?.scheduleName || "Automated Report";

  // Periods to generate
  let periods: ExpensePeriod[] = [];
  if (!config?.period || config.period === "all") {
    periods = ["daily", "weekly", "monthly"];
  } else {
    periods = [config.period as ExpensePeriod];
  }

  // Execution key for idempotency
  const executionKey =
    config?.executionKey ||
    `${config?.scheduleId || "default"}:${reportType}:${config?.period || "all"}:${now.toFormat("yyyy-LL-dd-HH")}:${triggeredBy}`;

  // Idempotency check (skip manual_test to always allow)
  if (triggeredBy !== "manual_test") {
    const existing = await ReportExecution.findOne({ executionKey, status: "success" }).lean();
    if (existing) {
      return {
        skipped: true,
        reason: "Already executed for this window",
        executionKey,
        recipients,
        recipient: recipients.join(", "),
        recordCount: 0,
        totalAmount: 0,
        durationMs: 0,
      };
    }
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    const errMessage = "EMAIL_USER and EMAIL_PASS are required for automated reports";
    await ReportExecution.create({
      scheduleId: config?.scheduleId || null,
      executionKey: `${executionKey}-nomail-${Date.now()}`,
      reportType,
      period: config?.period || "all",
      fromDate: "",
      toDate: "",
      recipients,
      recipientCount: recipients.length,
      recordCount: 0,
      totalAmount: 0,
      status: "failed",
      errorMessage: errMessage,
      pdfUrls: [],
      durationMs: Date.now() - startTime,
      executedAt: new Date(),
      triggeredBy,
    }).catch(() => {});
    throw new Error(errMessage);
  }

  try {
    const appBaseUrl = config?.appBaseUrl || APP_BASE_URL;

    // ── Generate report for each period ──────────────────────────────────────
    let allRows: NormalisedRow[] = [];
    let combinedSummary: ReportSummary | null = null;
    let reportFromDate = "";
    let reportToDate = "";
    const pdfUrls: string[] = [];
    const pdfAttachments: { filename: string; content: Buffer; contentType: string }[] = [];
    let totalRecordCount = 0;
    let totalAmount = 0;

    for (const period of periods) {
      const range = getPeriodRange(period, now);
      reportFromDate = reportFromDate || range.from;
      reportToDate = range.to;

      const engineFilters: ReportEngineFilters = {
        reportType,
        fromDate: range.from,
        toDate: range.to,
        userIds: config?.filters?.userIds || [],
        expenseSources: config?.filters?.expenseSources || [],
        categories: config?.filters?.categories || [],
        statuses: config?.filters?.statuses || [],
        includeCredit: config?.filters?.includeCredit !== false,
        includeDebit: config?.filters?.includeDebit !== false,
        search: config?.filters?.search || "",
        sortBy: "date",
        sortOrder: "desc",
        page: 1,
        limit: 5000, // large batch for PDF/email
      };

      const result = await runReportEngine(engineFilters);
      allRows = [...allRows, ...result.allRows];
      combinedSummary = combinedSummary || result.summary;
      totalRecordCount += result.summary.totalRecords;
      totalAmount += result.summary.grandTotal;

      // Generate PDF and upload to ImageKit
      const pdfBuffer = await buildReportPDF({
        title: range.title,
        fromDate: range.from,
        toDate: range.to,
        rows: result.allRows,
        summary: result.summary,
        timezone,
        period,
      });

      const safeDate = now.toFormat("yyyyLLdd");
      const fileName = `${period}-${reportType}-${safeDate}.pdf`;
      const pdfUrl = await uploadToImageKit(pdfBuffer, "expense-reports", fileName);
      pdfUrls.push(pdfUrl);
      pdfAttachments.push({ filename: fileName, content: pdfBuffer, contentType: "application/pdf" });
    }

    // Use the combined summary of the primary period
    const finalSummary: ReportSummary = combinedSummary || {
      expenseTotal: 0, creditTotal: 0, debitTotal: 0,
      grandTotal: totalAmount, netCreditDebit: 0,
      totalRecords: totalRecordCount, averagePerEntry: 0,
      byUser: {}, byDate: {}, byCategory: {},
    };

    // ── Create secure 24-hour share link ────────────────────────────────────
    const { rawToken, tokenHash } = generateShareToken();
    const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_HOURS * 3600 * 1000);

    // Create ReportExecution first (needed for share link FK)
    const execDoc = await ReportExecution.create({
      scheduleId: config?.scheduleId || null,
      executionKey,
      reportType,
      period: config?.period || "all",
      fromDate: reportFromDate,
      toDate: reportToDate,
      recipients,
      recipientCount: recipients.length,
      recordCount: totalRecordCount,
      totalAmount,
      status: "success",
      errorMessage: null,
      pdfUrls,
      durationMs: Date.now() - startTime,
      executedAt: new Date(),
      triggeredBy,
    });

    // Snapshot: only keep fields needed for display; skip raw mongoose internals
    // Keep the complete result set in the immutable snapshot so the public
    // report, its filters, analysis tabs, and attachment viewer use the same
    // data as the generated PDF/email.
    const snapshotRows = allRows.map((row) => ({
      _id: row._id,
      date: row.date,
      type: row.type,
      source: row.source,
      userName: row.userName,
      userId: row.userId,
      category: row.category,
      siteName: row.siteName,
      amount: row.amount,
      description: row.description,
      remarks: row.remarks,
      status: row.status,
      attachments: row.attachments,
      createdAt: row.createdAt,
    }));

    const shareLinkDoc = await ReportShareLink.create({
      reportExecutionId: execDoc._id,
      scheduleId: config?.scheduleId || null,
      tokenHash,
      expiresAt,
      snapshotData: {
        reportType,
        fromDate: reportFromDate,
        toDate: reportToDate,
        period: config?.period || "all",
        recordCount: totalRecordCount,
        totalAmount,
        filters: {
          reportType,
          fromDate: reportFromDate,
          toDate: reportToDate,
          userIds: config?.filters?.userIds || [],
          expenseSources: config?.filters?.expenseSources || [],
          categories: config?.filters?.categories || [],
          statuses: config?.filters?.statuses || [],
          includeCredit: config?.filters?.includeCredit !== false,
          includeDebit: config?.filters?.includeDebit !== false,
        },
        summary: finalSummary,
        rows: snapshotRows,
        scheduleName,
        timezone,
        recipients,
      },
    });

    const shareUrl = `${appBaseUrl}/shared-report/${rawToken}`;

    // Update execution with share link
    await ReportExecution.findByIdAndUpdate(execDoc._id, {
      shareLinkId: shareLinkDoc._id,
      shareUrl,
      shareExpiresAt: expiresAt,
    });

    // Update ScheduledReport if applicable
    if (config?.scheduleId) {
      const nextRun = computeNextRun(
        config.frequency || "daily",
        config.time || "09:00",
        timezone,
        now
      );
      await ScheduledReport.findByIdAndUpdate(config.scheduleId, {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        lastErrorMessage: null,
        nextRunAt: nextRun,
      });
    }

    // ── Send email ────────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const emailHtml = buildShareEmailHtml({
      scheduleName,
      reportType,
      fromDate: reportFromDate,
      toDate: reportToDate,
      period: config?.period || "all",
      summary: finalSummary,
      shareUrl,
      pdfUrls,
      expiresAt,
      generatedAt,
    });

    const emailText = buildShareEmailText({
      scheduleName,
      fromDate: reportFromDate,
      toDate: reportToDate,
      summary: finalSummary,
      shareUrl,
      pdfUrls,
      expiresAt,
      generatedAt,
    });

    await transporter.sendMail({
      from: `"CashWise Reports" <${process.env.EMAIL_USER}>`,
      to: recipients.join(", "),
      subject: `CashWise ${scheduleName} · ${reportFromDate} → ${reportToDate} (${totalRecordCount} records)`,
      text: emailText,
      html: emailHtml,
      attachments: pdfAttachments,
    });

    const durationMs = Date.now() - startTime;

    return {
      executionKey,
      recipient: recipients.join(", "),
      recipients,
      recordCount: totalRecordCount,
      totalAmount,
      durationMs,
      shareUrl,
      shareExpiresAt: expiresAt,
      pdfUrls,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error?.message || "Failed to generate and send report";

    await ReportExecution.create({
      scheduleId: config?.scheduleId || null,
      executionKey: `${executionKey}-err-${Date.now()}`,
      reportType,
      period: config?.period || "all",
      fromDate: "",
      toDate: "",
      recipients,
      recipientCount: recipients.length,
      recordCount: 0,
      totalAmount: 0,
      status: "failed",
      errorMessage,
      pdfUrls: [],
      durationMs,
      executedAt: new Date(),
      triggeredBy,
    }).catch(() => {});

    if (config?.scheduleId) {
      await ScheduledReport.findByIdAndUpdate(config.scheduleId, {
        lastRunAt: new Date(),
        lastFailedAt: new Date(),
        lastErrorMessage: errorMessage,
      }).catch(() => {});
    }

    throw error;
  }
}
