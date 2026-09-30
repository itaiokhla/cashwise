// @app/_lib/email.ts
import nodemailer from "nodemailer";
import XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate Excel buffer (server-side)
export function generateExcelBuffer(data: any[], columns: { key: string; label: string }[]) {
  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.key) });
  
  // Add header row with labels
  const headerRow = columns.map(c => c.label);
  XLSX.utils.sheet_add_aoa(worksheet, [headerRow], { origin: "A1" });
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

// Generate PDF buffer (server-side)
export async function generatePdfBuffer(
  data: any[], 
  columns: { key: string; label: string }[],
  reportTitle: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  
  doc.setFontSize(14);
  doc.text(reportTitle, 14, 15);
  
  const head = [columns.map(c => c.label)];
  const body = data.map(row => columns.map(col => row[col.key] ?? ""));
  
  autoTable(doc, {
    startY: 25,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
  });
  
  return Buffer.from(doc.output("arraybuffer"));
}

// Send email with attachment
export async function sendReportEmail({
  to,
  subject,
  html,
  attachmentBuffer,
  filename,
  contentType,
}: {
  to: string;
  subject: string;
  html: string;
  attachmentBuffer: Buffer;
  filename: string;
  contentType: string;
}) {
  const info = await transporter.sendMail({
    from: `"Office Pulse" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    attachments: [{
      filename,
      content: attachmentBuffer,
      contentType,
    }],
  });
  
  return info;
}