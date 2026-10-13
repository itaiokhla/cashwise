/**
 * @app/_lib/reportExports.ts
 *
 * Server-side PDF (jsPDF + autotable) and Excel (ExcelJS) builders for
 * automated / shared reports. Both are pure JS with fonts compiled in, so they
 * run unchanged inside a Vercel function (no font files to trace).
 *
 * Input is the report snapshot stored with the share link, which means the
 * email attachment, the "Download PDF/Excel" links in the email and the
 * buttons on the shared page all produce identical documents.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import {
  fmtRs,
  labelize,
  pct,
  summarizeRows,
  type ReportRow,
  type ReportSection,
  type CashPosition,
} from "@app/_lib/reportDigest";

export interface ExportSnapshot {
  scheduleName?: string;
  reportType?: string;
  generatedAt?: string;   // already formatted for display
  timezone?: string;
  sections: ReportSection[];
}

type RGB = [number, number, number];

const BRAND: RGB = [79, 70, 229];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const SOFT: RGB = [248, 250, 252];
const AMBER: RGB = [217, 119, 6];
const RED: RGB = [185, 28, 28];
// Reserved status colours (approved / pending / rejected)
const STATUS_GOOD: RGB = [12, 163, 12];
const STATUS_WARN: RGB = [250, 178, 25];
const STATUS_BAD: RGB = [208, 59, 59];

const REPORT_TYPE_LABEL: Record<string, string> = {
  expense: "Expenses",
  combined: "Cash & Expenses",
  credit: "Cash Received",
  debit: "Cash Spent",
};

export function reportTypeLabel(type?: string): string {
  return REPORT_TYPE_LABEL[type || "expense"] || labelize(type || "expense");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Rows that fall inside a section's date window. */
export function rowsForSection(rows: ReportRow[], section: Pick<ReportSection, "from" | "to">): ReportRow[] {
  return rows.filter((r) => r.date >= section.from && r.date <= section.to);
}

export function safeFileName(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "cashwise-report";
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

interface PdfOptions {
  /** Sections whose transaction list is printed in full. Default: the first section only. */
  detailSectionKeys?: string[];
  /** Shown under the title when rows were filtered on the shared page. */
  filterNote?: string;
}

export function buildReportPdf(snapshot: ExportSnapshot, options: PdfOptions = {}): Buffer {
  // compress: a month of transactions is ~4.6 MB uncompressed vs ~1 MB compressed,
  // which matters for email upload time and attachment limits.
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;
  const W = pageW - M * 2;

  const detailKeys = options.detailSectionKeys ?? (snapshot.sections[0] ? [snapshot.sections[0].key] : []);
  const title = snapshot.scheduleName || "CashWise Expense Report";

  // ── Cover header ──
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CASHWISE  ·  " + reportTypeLabel(snapshot.reportType).toUpperCase(), M, 9);
  doc.setFontSize(16);
  doc.text(title, M, 18, { maxWidth: W });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const subtitle = [
    snapshot.sections.map((s) => `${s.label}: ${s.rangeLabel}`).join("   |   "),
  ].join("");
  doc.text(subtitle, M, 25, { maxWidth: W });

  let y = 37;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  const meta = [`Generated ${snapshot.generatedAt || ""}`.trim(), snapshot.timezone ? `Timezone ${snapshot.timezone}` : ""]
    .filter(Boolean)
    .join("   ·   ");
  if (meta) {
    doc.text(meta, M, y);
    y += 5;
  }
  if (options.filterNote) {
    doc.setTextColor(...AMBER);
    doc.text(`Filtered view: ${options.filterNote}`, M, y, { maxWidth: W });
    y += 5;
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 14) {
      doc.addPage();
      y = 16;
    }
  };

  /** Stat tiles: the value is printed in ink (or red when negative); `accent` only colours the side stripe. */
  const kpiRow = (items: { label: string; value: string; sub?: string; accent?: RGB; negative?: boolean }[]) => {
    const gap = 3;
    const boxW = (W - gap * (items.length - 1)) / items.length;
    ensureSpace(20);
    items.forEach((item, i) => {
      const x = M + i * (boxW + gap);
      doc.setFillColor(...SOFT);
      doc.setDrawColor(...LINE);
      doc.roundedRect(x, y, boxW, 17, 2, 2, "FD");
      if (item.accent) {
        doc.setFillColor(...item.accent);
        doc.rect(x + 0.6, y + 3, 0.9, 11, "F");
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(item.label.toUpperCase(), x + 3, y + 5);
      doc.setFontSize(10.5);
      doc.setTextColor(...(item.negative ? RED : INK));
      doc.text(item.value, x + 3, y + 11, { maxWidth: boxW - 6 });
      if (item.sub) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(...MUTED);
        doc.text(item.sub, x + 3, y + 15, { maxWidth: boxW - 6 });
      }
    });
    y += 20;
  };

  const tableTheme = {
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
    headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold" as const, fontSize: 7.5 },
    alternateRowStyles: { fillColor: SOFT },
    margin: { left: M, right: M, top: 16, bottom: 16 },
  };

  const lastY = () => ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;

  for (const section of snapshot.sections) {
    const d = section.digest;
    ensureSpace(40);

    // Section heading
    doc.setFillColor(...BRAND);
    doc.rect(M, y, 1.2, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(section.label, M + 4, y + 5);
    const labelWidth = doc.getTextWidth(section.label);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(section.rangeLabel, M + 4 + labelWidth + 4, y + 5);
    y += 11;

    kpiRow([
      { label: "Total expenses", value: fmtRs(d.expense.total), sub: `${plural(d.expense.count, "entry", "entries")} · excl. rejected`, accent: BRAND },
      { label: "Approved", value: fmtRs(d.expense.approved.total), sub: plural(d.expense.approved.count, "entry", "entries"), accent: STATUS_GOOD },
      { label: "Pending", value: fmtRs(d.expense.pending.total), sub: plural(d.expense.pending.count, "entry", "entries"), accent: STATUS_WARN },
      { label: "Rejected", value: fmtRs(d.expense.rejected.total), sub: `${plural(d.expense.rejected.count, "entry", "entries")} · not counted`, accent: STATUS_BAD },
    ]);

    const hasCash = d.cash.received.count > 0 || d.cash.spent.count > 0 || !!section.cashPosition;
    if (hasCash) {
      const cp = section.cashPosition;
      kpiRow([
        ...(cp ? [{ label: "Opening balance", value: fmtRs(cp.opening) }] : []),
        { label: "Cash received", value: fmtRs(d.cash.received.total), sub: plural(d.cash.received.count, "credit", "credits"), accent: [8, 145, 178] as RGB },
        { label: "Cash spent", value: fmtRs(d.cash.spent.total), sub: plural(d.cash.spent.count, "debit", "debits"), accent: MUTED },
        cp
          ? { label: "Closing balance", value: fmtRs(cp.closing), accent: BRAND, negative: cp.closing < 0 }
          : { label: "Net cash flow", value: fmtRs(d.cash.net), accent: BRAND, negative: d.cash.net < 0 },
      ]);
    }

    // Breakdown tables side by side (category | employee)
    const half = (W - 4) / 2;
    const catBody = d.expense.byCategory.slice(0, 10).map((b) => [
      labelize(b.key),
      String(b.count),
      fmtRs(b.total),
      `${pct(b.total, d.expense.total).toFixed(1)}%`,
    ]);
    const userBody = d.expense.byUser.slice(0, 10).map((b) => [
      b.key,
      String(b.count),
      fmtRs(b.total),
      `${pct(b.total, d.expense.total).toFixed(1)}%`,
    ]);

    if (catBody.length || userBody.length) {
      ensureSpace(30);
      const startY = y;
      autoTable(doc, {
        ...tableTheme,
        startY,
        tableWidth: half,
        margin: { ...tableTheme.margin, left: M, right: M + half + 4 },
        head: [["Category", "Qty", "Amount", "Share"]],
        body: catBody.length ? catBody : [["No expenses", "", "", ""]],
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
      });
      const leftEnd = lastY();
      autoTable(doc, {
        ...tableTheme,
        startY,
        tableWidth: half,
        margin: { ...tableTheme.margin, left: M + half + 4, right: M },
        head: [["Employee", "Qty", "Amount", "Share"]],
        body: userBody.length ? userBody : [["No expenses", "", "", ""]],
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
      });
      y = Math.max(leftEnd, lastY());
    }

    // Per-employee balances are long; print them once, with the detailed section.
    if (section.cashPosition && section.cashPosition.users.length > 0 && detailKeys.includes(section.key)) {
      ensureSpace(24);
      autoTable(doc, {
        ...tableTheme,
        startY: y,
        head: [["Cash position", "Opening", "Received", "Spent", "Closing"]],
        body: section.cashPosition.users.map((u) => [u.name, fmtRs(u.opening), fmtRs(u.received), fmtRs(u.spent), fmtRs(u.closing)]),
        foot: [["Total", fmtRs(section.cashPosition.opening), fmtRs(section.cashPosition.received), fmtRs(section.cashPosition.spent), fmtRs(section.cashPosition.closing)]],
        footStyles: { fillColor: [238, 242, 255], textColor: INK, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      });
      y = lastY();
    }

    if (detailKeys.includes(section.key)) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(`Transactions — ${section.label} (${section.rows.length})`, M, y);
      y += 3;

      const body = section.rows.map((r, i) => [
        String(i + 1),
        r.date,
        r.userName || "—",
        r.type === "expense" ? labelize(r.category) : labelize(r.type),
        r.siteName || "—",
        (r.description || r.remarks || "—").slice(0, 80),
        r.type === "expense" ? labelize(r.status) : "—",
        fmtRs(r.amount),
      ]);
      autoTable(doc, {
        ...tableTheme,
        startY: y,
        head: [["#", "Date", "Employee", "Category", "Site / Party", "Description", "Status", "Amount"]],
        body: body.length ? body : [["", "", "No transactions in this period", "", "", "", "", ""]],
        columnStyles: {
          0: { cellWidth: 7, halign: "center", textColor: MUTED },
          1: { cellWidth: 18 },
          2: { cellWidth: 26 },
          3: { cellWidth: 20 },
          4: { cellWidth: 28 },
          6: { cellWidth: 15 },
          7: { cellWidth: 24, halign: "right", fontStyle: "bold" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 6) {
            const v = String(data.cell.raw || "").toLowerCase();
            // Darker text tones of the status hues so the words stay readable.
            if (v === "approved") data.cell.styles.textColor = [21, 128, 61];
            else if (v === "pending") data.cell.styles.textColor = [180, 83, 9];
            else if (v === "rejected") data.cell.styles.textColor = RED;
          }
        },
      });
      y = lastY();
    }

    y += 2;
  }

  if (snapshot.sections.some((s) => !detailKeys.includes(s.key))) {
    ensureSpace(10);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Full transaction lists for every period are in the Excel file and the online report.",
      M,
      y
    );
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(M, pageH - 10, pageW - M, pageH - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text("CashWise · Confidential — intended for authorised recipients only", M, pageH - 6);
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - 6, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ─── Excel ────────────────────────────────────────────────────────────────────

/** Indian digit grouping (12,34,567.00) with the rupee sign. */
const INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0.00;[>=100000]"₹"##\\,##\\,##0.00;"₹"##,##0.00';

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
const SOFT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 15, color: { argb: "FF0F172A" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };

function sheetName(label: string, used: Set<string>): string {
  const base = label.replace(/[\[\]:*?/\\]/g, " ").slice(0, 28).trim() || "Sheet";
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) name = `${base.slice(0, 26)} ${i++}`;
  used.add(name.toLowerCase());
  return name;
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle" };
  });
  row.height = 20;
}

function addBreakdown(ws: ExcelJS.Worksheet, title: string, rows: { key: string; count: number; total: number }[], whole: number) {
  ws.addRow([]);
  const t = ws.addRow([title]);
  t.font = { bold: true, size: 11 };
  styleHeader(ws.addRow(["Name", "Entries", "Amount", "Share %"]));
  if (rows.length === 0) {
    ws.addRow(["No data"]);
    return;
  }
  for (const b of rows) {
    const r = ws.addRow([b.key, b.count, b.total, whole ? b.total / whole : 0]);
    r.getCell(3).numFmt = INR_FORMAT;
    r.getCell(4).numFmt = "0.0%";
  }
}

function addCashPosition(ws: ExcelJS.Worksheet, cp: CashPosition) {
  ws.addRow([]);
  const t = ws.addRow(["Cash position (credit − debit)"]);
  t.font = { bold: true, size: 11 };
  styleHeader(ws.addRow(["Employee", "Opening", "Received", "Spent", "Closing"]));
  for (const u of cp.users) {
    const r = ws.addRow([u.name, u.opening, u.received, u.spent, u.closing]);
    [2, 3, 4, 5].forEach((c) => (r.getCell(c).numFmt = INR_FORMAT));
  }
  const total = ws.addRow(["Total", cp.opening, cp.received, cp.spent, cp.closing]);
  total.font = { bold: true };
  total.eachCell((c) => (c.fill = SOFT_FILL));
  [2, 3, 4, 5].forEach((c) => (total.getCell(c).numFmt = INR_FORMAT));
}

export async function buildReportExcel(snapshot: ExportSnapshot): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CashWise";
  wb.created = new Date();
  const used = new Set<string>();

  // ── Summary sheet ──
  const summary = wb.addWorksheet(sheetName("Summary", used), { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 34 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 18 }];
  summary.addRow([snapshot.scheduleName || "CashWise Expense Report"]).font = TITLE_FONT;
  summary.addRow([`${reportTypeLabel(snapshot.reportType)} · Generated ${snapshot.generatedAt || ""}`]).font = { color: { argb: "FF64748B" } };

  for (const section of snapshot.sections) {
    const d = section.digest;
    summary.addRow([]);
    const head = summary.addRow([`${section.label} — ${section.rangeLabel}`]);
    head.font = { bold: true, size: 13, color: { argb: "FF4F46E5" } };

    styleHeader(summary.addRow(["Metric", "Entries", "Amount"]));
    const metrics: [string, number, number][] = [
      ["Total expenses (approved + pending)", d.expense.count, d.expense.total],
      ["Approved", d.expense.approved.count, d.expense.approved.total],
      ["Pending approval", d.expense.pending.count, d.expense.pending.total],
      ["Rejected (not counted)", d.expense.rejected.count, d.expense.rejected.total],
      ["Average per expense", d.expense.count, d.expense.average],
    ];
    if (d.cash.received.count || d.cash.spent.count) {
      metrics.push(["Cash received (credit)", d.cash.received.count, d.cash.received.total]);
      metrics.push(["Cash spent (debit)", d.cash.spent.count, d.cash.spent.total]);
      metrics.push(["Net cash flow", d.cash.received.count + d.cash.spent.count, d.cash.net]);
    }
    for (const [label, count, amount] of metrics) {
      const r = summary.addRow([label, count, amount]);
      r.getCell(3).numFmt = INR_FORMAT;
    }

    addBreakdown(summary, "By category", d.expense.byCategory.map((b) => ({ ...b, key: labelize(b.key) })), d.expense.total);
    addBreakdown(summary, "By employee", d.expense.byUser, d.expense.total);
    if (section.cashPosition && section.cashPosition.users.length) addCashPosition(summary, section.cashPosition);
  }

  // ── One transactions sheet per section ──
  for (const section of snapshot.sections) {
    const ws = wb.addWorksheet(sheetName(`${section.label} ${section.from === section.to ? section.from : ""}`.trim(), used), {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Employee", key: "userName", width: 22 },
      { header: "Type", key: "type", width: 10 },
      { header: "Expense type", key: "source", width: 13 },
      { header: "Category", key: "category", width: 16 },
      { header: "Site / Party", key: "siteName", width: 28 },
      { header: "Description", key: "description", width: 40 },
      { header: "Remarks", key: "remarks", width: 26 },
      { header: "Status", key: "status", width: 11 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Attachments", key: "attachments", width: 12 },
    ];
    styleHeader(ws.getRow(1));

    for (const r of section.rows) {
      const row = ws.addRow({
        date: r.date,
        userName: r.userName,
        type: labelize(r.type),
        source: r.type === "expense" ? labelize(r.source) : "—",
        category: labelize(r.category),
        siteName: r.siteName,
        description: r.description,
        remarks: r.remarks,
        status: r.type === "expense" ? labelize(r.status) : "—",
        amount: Number(r.amount) || 0,
        attachments: r.attachments?.length || 0,
      });
      row.getCell("amount").numFmt = INR_FORMAT;
      const status = String(r.status || "").toLowerCase();
      if (r.type === "expense" && status === "rejected") row.font = { color: { argb: "FF94A3B8" }, strike: true };
    }

    const last = ws.rowCount;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, last), column: 11 } };

    if (section.rows.length > 0) {
      ws.addRow([]);
      const totalRow = ws.addRow({ siteName: "Visible total (follows filters)", amount: { formula: `SUBTOTAL(109,J2:J${last})` } });
      totalRow.font = { bold: true };
      totalRow.getCell("amount").numFmt = INR_FORMAT;
      totalRow.eachCell((c) => (c.fill = SOFT_FILL));
      const exp = ws.addRow({
        siteName: "Expenses excl. rejected",
        amount: { formula: `SUMIFS(J2:J${last},C2:C${last},"Expense",I2:I${last},"<>Rejected")` },
      });
      exp.font = { bold: true, color: { argb: "FF4F46E5" } };
      exp.getCell("amount").numFmt = INR_FORMAT;
    } else {
      ws.addRow({ siteName: "No transactions in this period" });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** Re-summarise a section after filtering its rows (used by filtered exports). */
export function filteredSection(section: ReportSection, rows: ReportRow[]): ReportSection {
  return { ...section, rows, digest: summarizeRows(rows), cashPosition: section.cashPosition };
}
