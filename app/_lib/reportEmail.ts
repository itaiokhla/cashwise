/**
 * @app/_lib/reportEmail.ts
 *
 * HTML + plain-text email for automated reports.
 *
 * Built with nested tables and inline styles because that is what Gmail,
 * Outlook and phone mail apps render reliably; a small <style> block adds
 * mobile stacking for clients that support media queries. Every value that
 * can come from user input is HTML-escaped.
 */

import { fmtINR, labelize, pct, type ReportSection, type Bucket } from "@app/_lib/reportDigest";

export interface ReportEmailParams {
  scheduleName: string;
  reportTypeLabel: string;
  scheduleDescription: string;   // "Every day at 7:00 PM"
  generatedAt: string;           // "14 Oct 2026, 7:02 PM"
  sections: ReportSection[];
  shareUrl: string;
  pdfUrl: string;
  excelUrl: string;
  expiresAt: Date;
  timezone: string;
  attachmentsIncluded: boolean;
}

const C = {
  brand: "#4f46e5",
  brandDark: "#3730a3",
  ink: "#0f172a",
  text: "#334155",
  muted: "#64748b",
  line: "#e2e8f0",
  soft: "#f8fafc",
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Stat tile: the value stays in ink; `accent` only colours the marker dot. */
function stat(label: string, value: string, sub: string, accent: string, valueColor: string = C.ink) {
  return `<td class="cw-col" valign="top" width="33%" style="padding:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border:1px solid ${C.line};border-radius:10px;">
      <tr><td class="cw-tile" style="padding:10px 12px;font-family:${FONT};">
        <div class="cw-sl" style="font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:${C.muted};"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${accent};margin-right:5px;"></span>${esc(label)}</div>
        <div class="cw-sv" style="font-size:16px;font-weight:800;color:${valueColor};margin-top:3px;word-break:break-word;">${esc(value)}</div>
        <div style="font-size:11px;color:${C.muted};margin-top:2px;">${esc(sub)}</div>
      </td></tr>
    </table>
  </td>`;
}

function bars(title: string, buckets: Bucket[], whole: number, color: string, labelFn: (k: string) => string = (k) => k, limit = 5) {
  if (buckets.length === 0) return "";
  const top = buckets.slice(0, limit);
  const rows = top
    .map((b) => {
      const p = Math.max(2, Math.round(pct(b.total, whole)));
      return `<tr>
        <td style="padding:6px 0 2px;font-family:${FONT};font-size:13px;color:${C.text};">${esc(labelFn(b.key))}
          <span style="color:${C.muted};font-size:11px;">· ${b.count}</span></td>
        <td align="right" style="padding:6px 0 2px;font-family:${FONT};font-size:13px;font-weight:700;color:${C.ink};white-space:nowrap;">${esc(fmtINR(b.total))}</td>
      </tr>
      <tr><td colspan="2" style="padding:0 0 4px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:4px;"><tr>
          <td width="${p}%" style="background:${color};height:6px;border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>
          <td style="font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td></tr>`;
    })
    .join("");
  const more = buckets.length > limit ? `<div style="font-family:${FONT};font-size:11px;color:${C.muted};padding-top:4px;">+ ${buckets.length - limit} more in the full report</div>` : "";
  return `<div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:${C.muted};margin:16px 0 4px;">${esc(title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>${more}`;
}

function sectionHtml(section: ReportSection, index: number) {
  const d = section.digest;
  const e = d.expense;
  const hasCash = d.cash.received.count > 0 || d.cash.spent.count > 0 || !!section.cashPosition;
  const cp = section.cashPosition;

  const cashRow = hasCash
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;"><tr>
        ${stat("Cash received", fmtINR(d.cash.received.total), `${d.cash.received.count} credit${d.cash.received.count === 1 ? "" : "s"}`, "#0891b2")}
        ${stat("Cash spent", fmtINR(d.cash.spent.total), `${d.cash.spent.count} debit${d.cash.spent.count === 1 ? "" : "s"}`, C.muted)}
        ${cp
          ? stat("Cash in hand", fmtINR(cp.closing), `opening ${fmtINR(cp.opening)}`, C.brand, cp.closing < 0 ? "#b91c1c" : C.ink)
          : stat("Net cash flow", fmtINR(d.cash.net), "received − spent", C.brand, d.cash.net < 0 ? "#b91c1c" : C.ink)}
      </tr></table>`
    : "";

  const empty = e.claimed.count === 0 && !hasCash
    ? `<div style="font-family:${FONT};font-size:13px;color:${C.muted};background:${C.soft};border:1px dashed ${C.line};border-radius:10px;padding:14px;text-align:center;margin-top:8px;">No entries were recorded for this period.</div>`
    : "";

  return `<tr><td style="padding:${index === 0 ? "4px" : "22px"} 24px 0;" class="cw-pad">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"${index > 0 ? ` style="border-top:1px solid ${C.line};"` : ""}>
      <tr><td style="padding-top:${index > 0 ? "18px" : "0"};font-family:${FONT};">
        <div style="font-size:12px;font-weight:700;color:${C.brand};text-transform:uppercase;letter-spacing:.5px;">${esc(section.label)}</div>
        <div style="font-size:13px;color:${C.muted};margin-top:2px;">${esc(section.rangeLabel)}</div>
        <div style="font-size:30px;font-weight:800;color:${C.ink};margin-top:8px;line-height:1.1;" class="cw-big">${esc(fmtINR(e.total))}</div>
        <div style="font-size:12px;color:${C.muted};margin-top:2px;">Total expenses · ${e.count} entr${e.count === 1 ? "y" : "ies"} · excludes rejected</div>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;"><tr>
      ${stat("Approved", fmtINR(e.approved.total), `${e.approved.count} entr${e.approved.count === 1 ? "y" : "ies"}`, "#0ca30c")}
      ${stat("Pending", fmtINR(e.pending.total), `${e.pending.count} awaiting approval`, "#fab219")}
      ${stat("Rejected", fmtINR(e.rejected.total), `${e.rejected.count} not counted`, "#d03b3b")}
    </tr></table>
    ${cashRow}
    ${empty}
    ${bars("Top categories", e.byCategory, e.total, "#2a78d6", labelize, index === 0 ? 5 : 3)}
    ${bars("Top employees", e.byUser, e.total, "#2a78d6", (k) => k, index === 0 ? 5 : 3)}
  </td></tr>`;
}

function button(href: string, label: string, primary: boolean) {
  const bg = primary ? C.brand : "#ffffff";
  const fg = primary ? "#ffffff" : C.brand;
  const border = primary ? C.brand : "#c7d2fe";
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="cw-btn"
    style="display:inline-block;background:${bg};color:${fg};border:1px solid ${border};font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px;margin:4px;">${esc(label)}</a>`;
}

export function buildReportEmailHtml(p: ReportEmailParams): string {
  const expiry = p.expiresAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: p.timezone });
  const preheader = p.sections
    .map((s) => `${s.label}: ${fmtINR(s.digest.expense.total)}`)
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(p.scheduleName)}</title>
<style>
  @media only screen and (max-width:620px){
    .cw-wrap{width:100%!important}
    .cw-pad{padding-left:16px!important;padding-right:16px!important}
    .cw-col{padding:2px!important}
    .cw-tile{padding:8px 7px!important}
    .cw-sl{font-size:9px!important;letter-spacing:0!important}
    .cw-sv{font-size:13px!important}
    .cw-big{font-size:26px!important}
    .cw-btn{display:block!important;margin:6px 0!important;text-align:center}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eef2f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;">
<tr><td align="center" style="padding:20px 8px;">
  <table role="presentation" class="cw-wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${C.line};">

    <tr><td class="cw-pad" style="background:${C.brand};background-image:linear-gradient(135deg,${C.brand},${C.brandDark});padding:22px 24px;">
      <div style="font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1px;color:#c7d2fe;text-transform:uppercase;">CashWise · ${esc(p.reportTypeLabel)}</div>
      <div style="font-family:${FONT};font-size:21px;font-weight:800;color:#ffffff;margin-top:6px;line-height:1.25;">${esc(p.scheduleName)}</div>
      <div style="font-family:${FONT};font-size:12px;color:#e0e7ff;margin-top:6px;">${esc(p.scheduleDescription)} · generated ${esc(p.generatedAt)}</div>
    </td></tr>

    <tr><td style="height:18px;font-size:0;line-height:0;">&nbsp;</td></tr>
    ${p.sections.map((s, i) => sectionHtml(s, i)).join("")}

    <tr><td class="cw-pad" align="center" style="padding:24px 24px 6px;">
      ${button(p.shareUrl, "Open full report", true)}
      ${button(p.pdfUrl, "Download PDF", false)}
      ${button(p.excelUrl, "Download Excel", false)}
    </td></tr>
    <tr><td class="cw-pad" align="center" style="padding:6px 24px 0;font-family:${FONT};font-size:12px;color:${C.muted};">
      The online report has filters, employee &amp; category breakdowns and can be shared on WhatsApp.
    </td></tr>

    <tr><td class="cw-pad" style="padding:18px 24px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
        <tr><td style="padding:12px 14px;font-family:${FONT};font-size:12px;color:#92400e;line-height:1.5;">
          🔒 The report link and download buttons work until <strong>${esc(expiry)}</strong>.
          ${p.attachmentsIncluded ? "The PDF and Excel files are also attached to this email for your records." : ""}
        </td></tr>
      </table>
    </td></tr>

    <tr><td class="cw-pad" style="padding:20px 24px 22px;font-family:${FONT};font-size:11px;color:#94a3b8;line-height:1.5;">
      Sent automatically by CashWise because this address is a recipient of “${esc(p.scheduleName)}”.
      Recipients and timing are managed in CashWise → Settings → Automated Reports. Please do not reply.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildReportEmailText(p: ReportEmailParams): string {
  const expiry = p.expiresAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: p.timezone });
  const lines: string[] = [
    `CASHWISE — ${p.scheduleName}`,
    `${p.reportTypeLabel} · ${p.scheduleDescription} · generated ${p.generatedAt}`,
    "",
  ];
  for (const s of p.sections) {
    const e = s.digest.expense;
    lines.push(`${s.label.toUpperCase()} (${s.rangeLabel})`);
    lines.push(`  Total expenses (excl. rejected): ${fmtINR(e.total)} — ${e.count} entries`);
    lines.push(`  Approved: ${fmtINR(e.approved.total)} (${e.approved.count})`);
    lines.push(`  Pending:  ${fmtINR(e.pending.total)} (${e.pending.count})`);
    lines.push(`  Rejected: ${fmtINR(e.rejected.total)} (${e.rejected.count}, not counted)`);
    if (s.digest.cash.received.count || s.digest.cash.spent.count || s.cashPosition) {
      lines.push(`  Cash received: ${fmtINR(s.digest.cash.received.total)} · Cash spent: ${fmtINR(s.digest.cash.spent.total)}`);
      if (s.cashPosition) lines.push(`  Cash in hand: ${fmtINR(s.cashPosition.opening)} → ${fmtINR(s.cashPosition.closing)}`);
    }
    const topCats = e.byCategory.slice(0, 3).map((b) => `${labelize(b.key)} ${fmtINR(b.total)}`).join(", ");
    if (topCats) lines.push(`  Top categories: ${topCats}`);
    lines.push("");
  }
  lines.push(`Open full report: ${p.shareUrl}`);
  lines.push(`Download PDF:     ${p.pdfUrl}`);
  lines.push(`Download Excel:   ${p.excelUrl}`);
  lines.push("");
  lines.push(`Links work until ${expiry}.${p.attachmentsIncluded ? " PDF and Excel files are attached." : ""}`);
  lines.push("— Sent automatically by CashWise. Please do not reply.");
  return lines.join("\n");
}
