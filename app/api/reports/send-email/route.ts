// app/api/report/send-email/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Next.js App Router Route Handler - POST endpoint for sending report emails
// ─────────────────────────────────────────────────────────────────────────────
'use server';
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// ── ENV Validation ───────────────────────────────────────────────────────────
const IK_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
const IK_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY;
const IK_URL_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, "");

if (!IK_PRIVATE_KEY) {
  console.error("❌ IMAGEKIT_PRIVATE_KEY not set");
}

// ── Nodemailer Transport (cached) ─────────────────────────────────────────────
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  
  return transporter;
}

// ── ImageKit Upload ───────────────────────────────────────────────────────────
async function uploadToImageKit(
  buffer: Buffer,
  filename: string,
  folder: string,
): Promise<{ url: string; fileId: string }> {
  if (!IK_PRIVATE_KEY) {
    throw new Error("IMAGEKIT_PRIVATE_KEY not configured");
  }

  // Build multipart form manually for better control
  const boundary = `----ImageKitUpload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  const formParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
    `Content-Type: application/octet-stream\r\n\r\n`,
  ];
  
  const formEnd = [
    `\r\n--${boundary}\r\n`,
    `Content-Disposition: form-data; name="fileName"\r\n\r\n`,
    `${filename}\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="folder"\r\n\r\n`,
    `${folder}\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="isPrivateFile"\r\n\r\n`,
    `false\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="useUniqueFileName"\r\n\r\n`,
    `true\r\n`,
    `--${boundary}--\r\n`,
  ];

  // Combine all parts into a single buffer
  const headerBuffer = Buffer.from(formParts.join(""), "utf-8");
  const footerBuffer = Buffer.from(formEnd.join(""), "utf-8");
  
  const fullBuffer = Buffer.concat([headerBuffer, buffer, footerBuffer]);

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${IK_PRIVATE_KEY}:`).toString("base64")}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: fullBuffer,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    console.error("❌ ImageKit upload failed:", res.status, errText);
    throw new Error(`ImageKit upload failed: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  
  if (!data.url) {
    throw new Error("ImageKit did not return a URL in response");
  }

  return { url: data.url, fileId: data.fileId };
}

// ── Email Templates ───────────────────────────────────────────────────────────
function buildEmailHtml(params: {
  label: string;
  fromDate: string;
  toDate: string;
  count: number;
  format: string;
  downloadUrl: string;
  filename: string;
}) {
  const { label, fromDate, toDate, count, format, downloadUrl, filename } = params;
  
  const openWith = format === "pdf" 
    ? "any PDF viewer" 
    : format === "csv" 
      ? "Excel or Google Sheets" 
      : "Microsoft Excel or Google Sheets";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .wrap{max-width:560px;margin:32px auto}
    .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    .hdr{background:#1e2735;padding:28px 32px}
    .hdr h1{margin:0;font-size:20px;font-weight:700;color:#fff}
    .hdr p{margin:6px 0 0;font-size:12px;color:rgba(255,255,255,.6)}
    .bdy{padding:28px 32px}
    .pills{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}
    .pill{background:#f8fafc;border:1px solid #e2e8f0;border-radius:100px;padding:6px 14px;font-size:11px;color:#64748b;font-weight:600}
    .pill span{color:#1e293b}
    .dl-box{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:14px;padding:20px 24px;margin:20px 0;text-align:center}
    .dl-btn{display:inline-block;background:#fff;color:#4f46e5;padding:11px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
    .dl-btn:hover{background:#f1f5f9}
    .dl-sub{font-size:11px;color:rgba(255,255,255,.8);margin-top:10px}
    .note{background:#fefce8;border:1px solid #fef08a;border-radius:12px;padding:14px 18px;font-size:12px;color:#713f12;margin-top:16px}
    .note strong{display:block;margin-bottom:3px;color:#92400e;font-size:13px}
    .ftr{padding:18px 32px;border-top:1px solid #f1f5f9;text-align:center}
    .ftr p{margin:0;font-size:11px;color:#94a3b8}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="hdr">
        <h1>📊 ${label} Report Ready</h1>
        <p>Generated ${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})}</p>
      </div>
      <div class="bdy">
        <div class="pills">
          <div class="pill">Period <span>${fromDate} → ${toDate}</span></div>
          <div class="pill">Records <span>${count.toLocaleString()}</span></div>
          <div class="pill">Format <span>${format.toUpperCase()}</span></div>
        </div>
        <div class="dl-box">
          <a class="dl-btn" href="${downloadUrl}" target="_blank" rel="noopener noreferrer">
            ↓ Download ${format.toUpperCase()} Report
          </a>
          <div class="dl-sub">Opens with ${openWith} · File: ${filename}</div>
        </div>
        <div class="note">
          <strong>🔐 Secure Link</strong>
          This URL is hosted on ImageKit CDN. Do not forward if data is confidential.
        </div>
      </div>
      <div class="ftr">
        <p>Sent by CashWise Reports · Do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(params: {
  label: string;
  fromDate: string;
  toDate: string;
  count: number;
  format: string;
  downloadUrl: string;
}) {
  const { label, fromDate, toDate, count, format, downloadUrl } = params;
  return `${label} Report Ready
${"=".repeat(label.length + 14)}

Period:  ${fromDate} → ${toDate}
Records: ${count.toLocaleString()}
Format:  ${format.toUpperCase()}

Download: ${downloadUrl}

---
Sent by CashWise Reports. Do not reply.`;
}

// ── POST Route Handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    console.log("📬 [send-email] Request received");

    // Parse FormData
    const formData = await request.formData();
    
    // Extract fields with validation
    const file = formData.get("file") as File | null;
    const to = formData.get("to") as string | null;
    const reportLabel = (formData.get("reportLabel") as string) || "Report";
    const fromDate = (formData.get("fromDate") as string) || "";
    const toDate = (formData.get("toDate") as string) || "";
    const recordCount = parseInt(formData.get("recordCount") as string) || 0;
    const format = (formData.get("format") as string) || "excel";
    const filename = (formData.get("filename") as string) || `report.${format === "excel" ? "xlsx" : format === "pdf" ? "pdf" : "csv"}`;
    const ikFolder = (formData.get("imageKitFolder") as string) || "/reports";

    // Validate required fields
    if (!file) {
      console.error("❌ No file in request");
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      console.error("❌ Invalid email:", to);
      return NextResponse.json({ message: "Valid recipient email required" }, { status: 400 });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("❌ SMTP credentials not configured");
      return NextResponse.json({ message: "Email configuration error" }, { status: 500 });
    }

    // Convert File to Buffer
    console.log(`📦 Processing file: ${filename} (${file.size} bytes)`);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to ImageKit
    console.log("☁️ Uploading to ImageKit...");
    const { url: downloadUrl } = await uploadToImageKit(buffer, filename, ikFolder);
    console.log(`✅ Uploaded: ${downloadUrl}`);

    // Send email
    console.log(`📧 Sending email to ${to}...`);
    await getTransporter().sendMail({
      from: `"CashWise Reports" <${process.env.EMAIL_USER}>`,
      to,
      subject: `${reportLabel} Report · ${fromDate} → ${toDate} (${recordCount} records)`,
      text: buildEmailText({ label: reportLabel, fromDate, toDate, count: recordCount, format, downloadUrl }),
      html: buildEmailHtml({ label: reportLabel, fromDate, toDate, count: recordCount, format, downloadUrl, filename }),
    });
    console.log("✅ Email sent successfully");

    return NextResponse.json({ 
      success: true, 
      message: "Report sent",
      downloadUrl 
    });

  } catch (error: any) {
    console.error("❌ [send-email] Error:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });

    // Determine error type for user-friendly message
    const isImageKitError = String(error?.message || "").toLowerCase().includes("imagekit");
    const isSmtpError = String(error?.message || "").toLowerCase().includes("smtp") || 
                        String(error?.message || "").toLowerCase().includes("emailer");

    return NextResponse.json(
      { 
        message: isImageKitError 
          ? "Failed to upload file to cloud storage" 
          : isSmtpError 
            ? "Failed to send email" 
            : error?.message || "Internal server error"
      },
      { status: 500 }
    );
  }
}