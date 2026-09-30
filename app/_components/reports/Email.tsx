"use client";
// @app/_components/reports/EmailReportModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Flow:
//  1. User picks email + format → "Generate & Send Link"
//  2. File built client-side  (xlsx / pdf / csv)
//  3. 📥 File downloaded locally to user's device
//  4. FormData { file Blob + metadata } → POST /api/report/send-email
//  5. Server uploads Blob to ImageKit, gets CDN URL
//  6. Server sends email with download link  (no attachment)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo } from "react";
import { toast } from "react-toastify";

// ── types ─────────────────────────────────────────────────────────────────────
export type ExportFormat = "excel" | "pdf" | "csv";

export interface FieldDef {
  key: string;
  label: string;
  def: boolean;
  group: string;
}

export interface EmailReportModalProps {
  onClose: () => void;
  data: any[];
  visibleBaseFields: FieldDef[];
  isExpenseType: boolean;
  visibleCategoryLabels: { key: string; label: string }[];
  reportLabel: string;
  fromDate?: Date;
  toDate?: Date;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const AMT_KEYS = new Set(["amount", "money"]);

const fmtD = (d?: Date | string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtRaw = (n: unknown) => Math.round(Number(n) || 0);

const isoD = (d?: Date | string) => (d ? new Date(d).toISOString().split("T")[0] : "all");

const cleanNum = (v: unknown): number => {
  if (v == null || v === "" || v === "—") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
};

/** Trigger browser download of a Blob */
const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url); // cleanup memory
};

// ── file builders (return Blob) ───────────────────────────────────────────────

async function buildExcelBlob(
  data: any[], fields: FieldDef[], isExp: boolean,
  cats: { key: string; label: string }[], label: string,
): Promise<Blob> {
  const XLSX = await import("xlsx");
  const headers = ["#", ...fields.map(f => f.label), ...(isExp ? cats.map(c => c.label) : [])];
  const rows = data.map((row, i) => {
    const base = fields.map(f => {
      const v = row[f.key];
      if (AMT_KEYS.has(f.key)) return v ? fmtRaw(v) : 0;
      if (f.key === "createdAt" && v) return fmtD(v);
      return v == null || v === "" ? "" : String(v);
    });
    const catCols = isExp ? cats.map(c => row.category === c.key ? fmtRaw(row.amount) : 0) : [];
    return [i + 1, ...base, ...catCols];
  });
  const totals = [
    "Total",
    ...fields.map(f => AMT_KEYS.has(f.key) ? data.reduce((s, r) => s + cleanNum(r[f.key]), 0) : ""),
    ...(isExp ? cats.map(c => data.reduce((s, r) => r.category === c.key ? s + cleanNum(r.amount) : s, 0)) : []),
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totals]);
  ws["!cols"] = headers.map((_, i) => i === 0 ? { wch: 5 } : { wch: 16 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${label} Report`);
  const arr: Uint8Array = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([arr as any], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

async function buildPdfBlob(
  data: any[], fields: FieldDef[], isExp: boolean,
  cats: { key: string; label: string }[], label: string,
  fromDate?: Date, toDate?: Date,
): Promise<Blob> {
  const { default: jsPDF }    = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const n = (v: number) => Math.round(v).toString();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(13); doc.setTextColor(30, 41, 59);
  doc.text(`${label} Report`, 14, 14);
  doc.setFontSize(8); doc.setTextColor(100, 116, 139);
  doc.text(`Period: ${fmtD(fromDate)} to ${fmtD(toDate)}   |   Records: ${data.length}   |   ${new Date().toLocaleString("en-IN")}`, 14, 20);
  const head = [["S.N", ...fields.map(f => f.label.slice(0, 12)), ...(isExp ? cats.map(c => c.label.slice(0, 6)) : [])]];
  const body = data.map((row, i) => {
    const base = fields.map(f => {
      const v = row[f.key];
      if (AMT_KEYS.has(f.key)) return v ? n(Number(v)) : "—";
      if (f.key === "createdAt" && v) return fmtD(v);
      return v == null || v === "" ? "—" : String(v);
    });
    const catCols = isExp ? cats.map(c => row.category === c.key && row.amount ? n(row.amount) : "—") : [];
    return [String(i + 1), ...base, ...catCols];
  });
  const totalRow = [
    "Tot",
    ...fields.map(f => AMT_KEYS.has(f.key) ? n(data.reduce((s, r) => s + cleanNum(r[f.key]), 0)) : ""),
    ...(isExp ? cats.map(c => { const t = data.reduce((s, r) => r.category === c.key ? s + cleanNum(r.amount) : s, 0); return t > 0 ? n(t) : "—"; }) : []),
  ];
  autoTable(doc, {
    startY: 25, head, body: [...body, totalRow],
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 7 },
    didParseCell: (h: any) => {
      if (h.section === "body" && h.row.index === body.length) {
        h.cell.styles.fillColor = [30, 41, 59];
        h.cell.styles.textColor = [255, 255, 255];
        h.cell.styles.fontStyle = "bold";
      }
      const col = h.column.index;
      if ((col > 0 && col <= fields.length && AMT_KEYS.has(fields[col - 1]?.key ?? "")) || (isExp && col > fields.length))
        h.cell.styles.halign = "right";
    },
    columnStyles: { 0: { cellWidth: 8 } },
    margin: { top: 25, left: 14, right: 14 },
    tableWidth: "auto",
  });
  return new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
}

function buildCsvBlob(
  data: any[], fields: FieldDef[], isExp: boolean,
  cats: { key: string; label: string }[],
): Blob {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headers = ["#", ...fields.map(f => f.label), ...(isExp ? cats.map(c => c.label) : [])];
  const rows = data.map((row, i) => {
    const base = fields.map(f => {
      const v = row[f.key];
      if (AMT_KEYS.has(f.key)) return v ? fmtRaw(v) : 0;
      if (f.key === "createdAt" && v) return fmtD(v);
      return v == null ? "" : String(v);
    });
    const catCols = isExp ? cats.map(c => row.category === c.key ? fmtRaw(row.amount) : "") : [];
    return [i + 1, ...base, ...catCols];
  });
  const totals = [
    "Total",
    ...fields.map(f => AMT_KEYS.has(f.key) ? data.reduce((s, r) => s + cleanNum(r[f.key]), 0) : ""),
    ...(isExp ? cats.map(c => data.reduce((s, r) => r.category === c.key ? s + cleanNum(r.amount) : s, 0)) : []),
  ];
  const csv = [headers, ...rows, totals].map(r => r.map(esc).join(",")).join("\r\n");
  return new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM → Excel opens correctly
}

// ── format config ─────────────────────────────────────────────────────────────
const FORMATS: {
  key: ExportFormat; label: string; desc: string;
  mime: string; ext: string; ikFolder: string;
}[] = [
  { key: "excel", label: "XLSX", desc: "Spreadsheet", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", ikFolder: "/reports/excel" },
  { key: "pdf",   label: "PDF",  desc: "Print-ready", mime: "application/pdf",  ext: "pdf",  ikFolder: "/reports/pdf"   },
  { key: "csv",   label: "CSV",  desc: "Raw data",    mime: "text/csv",         ext: "csv",  ikFolder: "/reports/csv"   },
];

type Step = "form" | "building" | "downloading" | "uploading" | "sending" | "done";

const STEP_LABELS: Record<Step, string> = {
  form:         "",
  building:     "Building file",
  downloading:  "Saving locally",
  uploading:    "Uploading to ImageKit",
  sending:      "Sending email",
  done:         "",
};

// ── modal ─────────────────────────────────────────────────────────────────────
export default function EmailReportModal({
  onClose, data, visibleBaseFields, isExpenseType,
  visibleCategoryLabels, reportLabel, fromDate, toDate,
}: EmailReportModalProps) {
  const [email,      setEmail]      = useState("");
  const [format,     setFormat]     = useState<ExportFormat>("excel");
  const [step,       setStep]       = useState<Step>("form");
  const [progress,   setProgress]   = useState("");
  const [sendEmail,  setSendEmail]  = useState(true); // Optional: allow download-only

  const baseName = useMemo(
    () => `report_${reportLabel.toLowerCase()}_${isoD(fromDate)}_to_${isoD(toDate)}`,
    [reportLabel, fromDate, toDate],
  );

  const handleSend = async () => {
    const to = email.trim();
    
    // Validate email only if sending email is enabled
    if (sendEmail) {
      if (!to)                                       return toast.error("Enter a recipient email");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))   return toast.error("Enter a valid email address");
    }
    
    if (!data.length) return toast.error("No records to send");

    const cfg = FORMATS.find(f => f.key === format)!;

    try {
      // ── A  Build file client-side ─────────────────────────────────────────
      setStep("building");

      let blob: Blob;
      if (format === "excel") {
        setProgress("Building spreadsheet…");
        blob = await buildExcelBlob(data, visibleBaseFields, isExpenseType, visibleCategoryLabels, reportLabel);
      } else if (format === "pdf") {
        setProgress("Rendering PDF…");
        blob = await buildPdfBlob(data, visibleBaseFields, isExpenseType, visibleCategoryLabels, reportLabel, fromDate, toDate);
      } else {
        setProgress("Generating CSV…");
        blob = buildCsvBlob(data, visibleBaseFields, isExpenseType, visibleCategoryLabels);
      }

      const filename = `${baseName}.${cfg.ext}`;

      // ── 📥 NEW: Download locally first ─────────────────────────────────────
      setStep("downloading");
      setProgress(`Saving ${filename} to your device…`);
      // triggerDownload(blob, filename);
      
      // Small delay so user sees download action + browser processes it
      await new Promise(r => setTimeout(r, 800));

      // ── B  If email enabled, build FormData & send to backend ─────────────
      if (sendEmail) {
        const form = new FormData();
        form.append("file",           blob, filename);
        form.append("to",             to);
        form.append("reportLabel",    reportLabel);
        form.append("fromDate",       isoD(fromDate));
        form.append("toDate",         isoD(toDate));
        form.append("recordCount",    String(data.length));
        form.append("format",         format);
        form.append("filename",       filename);
        form.append("contentType",    cfg.mime);
        form.append("imageKitFolder", cfg.ikFolder);

        // ── C  POST → server uploads to ImageKit, sends email ───────────────
        setStep("uploading");
        setProgress("Uploading to ImageKit…");

        const res = await fetch("/api/reports/send-email", {
          method: "POST",
          body:   form, // do NOT set Content-Type — browser sets multipart boundary
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any)?.message || `Server error ${res.status}`);
        }

        setStep("sending");
        setProgress("Sending email…");
        // Small delay so user sees the "Sending" step
        await new Promise(r => setTimeout(r, 700));
      }

      setStep("done");
      toast.success(sendEmail ? "✅ File downloaded + link sent!" : "✅ File downloaded!");
      setTimeout(onClose, sendEmail ? 2400 : 1500);
      
    } catch (err: any) {
      console.error("[EmailReportModal]", err);
      toast.error(err?.message || "Failed to process report");
      setStep("form");
    }
  };

  const isProcessing = step === "building" || step === "downloading" || step === "uploading" || step === "sending";

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-tight">Send via Email</h3>
              <p className="text-[10px] text-slate-400">{data.length.toLocaleString()} records · {reportLabel}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        {/* ── body ───────────────────────────────────────────────────────────── */}
        <div className="p-5">

          {/* Done */}
          {step === "done" && (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-800">
                {sendEmail ? "Download link sent!" : "File downloaded!"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {sendEmail 
                  ? <>Check <span className="font-semibold text-slate-600">{email}</span> for the link</>
                  : "Check your Downloads folder for the file"
                }
              </p>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="text-center py-10 space-y-5">
              {/* spinner */}
              <div className="relative mx-auto w-14 h-14">
                <svg className="w-14 h-14 text-slate-100" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                </svg>
                <svg className="absolute inset-0 w-14 h-14 animate-spin text-purple-900" fill="none" viewBox="0 0 24 24">
                  <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-500">
                  {format === "excel" ? "XLS" : format.toUpperCase()}
                </span>
              </div>

              <div>
                <p className="text-sm font-bold text-slate-700">{progress}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {step === "building"    && `Processing ${data.length.toLocaleString()} records…`}
                  {step === "downloading" && `📥 Saving ${baseName}.${FORMATS.find(f => f.key === format)?.ext} to Downloads…`}
                  {step === "uploading"   && "Uploading to ImageKit CDN…"}
                  {step === "sending"     && `Sending link to ${email}…`}
                </p>
              </div>

              {/* step pills */}
              <div className="flex items-center justify-center gap-1 text-[10px] flex-wrap">
                {(["building", "downloading", "uploading", "sending"] as const).map((s, i) => {
                  // Only show "uploading" and "sending" if sendEmail is enabled
                  if (!sendEmail && (s === "uploading" || s === "sending")) return null;
                  
                  const steps: Step[] = sendEmail 
                    ? ["building", "downloading", "uploading", "sending"]
                    : ["building", "downloading"];
                  const currentIdx = steps.indexOf(step);
                  const done   = i < currentIdx;
                  const active = i === currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      {i > 0 && <div className="w-3 h-px bg-slate-200" />}
                      <span className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap transition-colors ${
                        done   ? "bg-teal-100 text-teal-700" :
                        active ? "bg-purple-100 text-purple-800" :
                                 "bg-slate-100 text-slate-400"
                      }`}>{STEP_LABELS[s]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form */}
          {step === "form" && (
            <div className="space-y-4">
              {/* email input - only show if sendEmail is enabled */}
              {sendEmail && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Recipient Email
                  </label>
                  <input
                    type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    placeholder="admin@company.com"
                    autoFocus
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all placeholder:text-slate-300"
                  />
                </div>
              )}

              {/* format picker */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  File Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMATS.map(f => (
                    <button key={f.key} onClick={() => setFormat(f.key)}
                      className={`py-2.5 rounded-xl border transition-all text-center ${
                        format === f.key
                          ? "bg-purple-900 text-white border-purple-900 shadow-sm"
                          : "text-slate-600 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50"
                      }`}>
                      <p className="text-xs font-bold">{f.label}</p>
                      <p className={`text-[9px] mt-0.5 ${format === f.key ? "text-white/60" : "text-slate-400"}`}>{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* summary pill */}
              <div className="bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-2 text-[10px] text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                <span className="truncate">{fmtD(fromDate)} → {fmtD(toDate)}</span>
                <span className="ml-auto font-semibold text-slate-700 shrink-0">{data.length.toLocaleString()} rows</span>
              </div>

              {/* download-only toggle */}
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={sendEmail}
                  onChange={e => setSendEmail(e.target.checked)}
                  className="rounded border-slate-300 text-purple-900 focus:ring-purple-900 w-4 h-4"
                />
                <span>Also send via email</span>
              </label>

              {/* how-it-works note */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 flex gap-2">
                <span className="text-base shrink-0 mt-0.5">☁️</span>
                <p className="text-[10px] text-indigo-800 leading-relaxed">
                  File is built in your browser → 📥 downloaded to your device → {sendEmail ? "uploaded to ImageKit CDN → recipient gets a download link via email." : "done!"}
                </p>
              </div>

              {/* CTA */}
              <button onClick={handleSend}
                className="w-full py-2.5 bg-purple-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 active:scale-[0.98] transition-all">
                {sendEmail ? "Send" : "Download"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}