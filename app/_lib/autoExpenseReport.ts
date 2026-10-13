/**
 * @app/_lib/autoExpenseReport.ts
 *
 * Automated report delivery.
 *
 *  runReport()          — build one report (daily / weekly / monthly sections),
 *                         create a secure share link, render PDF + Excel and
 *                         email the recipients. Used by the scheduler and by the
 *                         "Send now" / "Send test" buttons in Settings.
 *
 *  dispatchDueReports() — called by /api/cron/expense-reports on every tick.
 *                         Sends each schedule's most recent slot that has passed
 *                         and was not delivered yet, exactly once.
 *
 * Why catch-up instead of "fire at exactly HH:mm": Vercel Hobby only allows
 * cron jobs that run once a day, invoked anywhere inside the scheduled hour.
 * vercel.json therefore registers one daily job per hour (24 jobs, all on the
 * same path) and every tick delivers whatever became due since the last one.
 * On Pro, or with an external every-minute pinger, the very same code delivers
 * within a minute of the configured time. Report dates always come from the
 * slot (e.g. "today at 19:00 IST"), never from when the tick ran, so a late
 * tick still reports the correct period.
 */

import nodemailer, { type Transporter } from "nodemailer";
import mongoose from "mongoose";
import { DateTime } from "luxon";

import DB from "@app/_database/db";
import ScheduledReport, { type IScheduledReport } from "@app/_model/scheduledReport.model";
import ReportExecution from "@app/_model/reportExecution.model";
import ReportShareLink, { generateShareToken } from "@app/_model/reportShareLink.model";
import SchedulerStatus, { SCHEDULER_STATUS_ID } from "@app/_model/schedulerStatus.model";
import { uploadToImageKit } from "@app/_lib/uploadHelpers";
import {
  runReportEngine,
  computeCashPosition,
  type ReportEngineType,
  type ExpenseSource,
  type ExpenseStatus,
} from "@app/_lib/reportEngine";
import {
  DEFAULT_REPORT_TIMEZONE,
  describeSchedule,
  getReportWindows,
  latestSlotAtOrBefore,
  nextSlotAfter,
  type ReportCoverage,
  type ReportFrequency,
  type ReportPeriodMode,
  type ScheduleTiming,
} from "@app/_lib/reportSchedule";
import { fmtINR, summarizeRows, type ReportRow, type ReportSection } from "@app/_lib/reportDigest";
import {
  buildReportExcel,
  buildReportPdf,
  reportTypeLabel,
  rowsForSection,
  safeFileName,
} from "@app/_lib/reportExports";
import { buildReportEmailHtml, buildReportEmailText } from "@app/_lib/reportEmail";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegacyReportType = ReportEngineType | "office" | "travel" | "toPay" | "all";
export type TriggeredBy = "cron" | "manual_test" | "scheduler" | "manual_generate";

export interface ReportJobFilters {
  userIds?: string[];
  expenseSources?: ExpenseSource[];
  categories?: string[];
  statuses?: ExpenseStatus[];
  includeCredit?: boolean;
  includeDebit?: boolean;
  search?: string;
}

/** Everything needed to produce one report — a saved schedule or an unsaved draft. */
export interface ReportJob {
  scheduleId?: string | null;
  name: string;
  reportType: LegacyReportType;
  frequency: ReportFrequency;
  time: string;
  timezone?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  reportPeriod: ReportPeriodMode;
  coverage?: ReportCoverage;
  recipients: string[];
  linkTtlHours?: number;
  attachFiles?: boolean;
  filters?: ReportJobFilters;
}

export interface RunReportOptions {
  /** Scheduled time being delivered. Report dates derive from it. Default: now. */
  slotAt?: Date;
  triggeredBy: TriggeredBy;
  appBaseUrl: string;
  /** Idempotency key; generated for manual runs. */
  executionKey?: string;
}

export interface RunReportResult {
  executionId: string;
  executionKey: string;
  recipients: string[];
  recordCount: number;
  totalAmount: number;
  sections: { key: string; label: string; from: string; to: string; total: number; count: number }[];
  shareUrl: string;
  shareExpiresAt: Date;
  pdfUrl: string;
  excelUrl: string;
  durationMs: number;
}

export interface DispatchSummary {
  checked: number;
  due: number;
  sent: number;
  failed: number;
  skipped: number;
  deferred: number;
  durationMs: number;
  results: {
    scheduleId: string;
    name: string;
    status: "sent" | "failed" | "skipped" | "deferred";
    reason?: string;
    slotAt?: string;
    nextRunAt?: string;
    shareUrl?: string;
    recordCount?: number;
  }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LINK_TTL_HOURS = Number(process.env.REPORT_SHARE_LINK_TTL_HOURS) || 168;
const MAX_ATTEMPTS_PER_SLOT = 3;
const RETRY_DELAY_MS = 10 * 60 * 1000;
const LOCK_MS = 4 * 60 * 1000;
const IMAGEKIT_TIMEOUT_MS = 8000;
/** Reports sent in parallel per tick (keeps a 60s Vercel function within its limit). */
const DISPATCH_CONCURRENCY = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Public base URL used in emailed links.
 * APP_URL (explicit) → the URL the request came in on → Vercel production
 * domain → NEXT_PUBLIC_BASE_URL without its /api suffix → localhost.
 */
export function resolveAppBaseUrl(requestOrigin?: string | null): string {
  const strip = (u: string) => u.replace(/\/+$/, "");
  const explicit = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return strip(explicit);
  if (requestOrigin && /^https?:\/\//.test(requestOrigin)) return strip(requestOrigin);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${strip(process.env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  if (process.env.NEXT_PUBLIC_BASE_URL) return strip(process.env.NEXT_PUBLIC_BASE_URL.replace(/\/api\/?$/, ""));
  return "http://localhost:3000";
}

/** Map legacy scope values onto the engine's report types + source filter. */
export function resolveScope(reportType: LegacyReportType, filters: ReportJobFilters = {}) {
  let engineType: ReportEngineType = "expense";
  let expenseSources = (filters.expenseSources || []).filter(Boolean) as ExpenseSource[];

  if (reportType === "office" || reportType === "travel" || reportType === "toPay") {
    engineType = "expense";
    expenseSources = [reportType];
  } else if (reportType === "all" || reportType === "combined") {
    engineType = "combined";
  } else if (reportType === "credit" || reportType === "debit" || reportType === "expense") {
    engineType = reportType;
  }
  return { engineType, expenseSources };
}

function toTiming(job: Pick<ReportJob, "frequency" | "time" | "timezone" | "dayOfWeek" | "dayOfMonth">): ScheduleTiming {
  return {
    frequency: job.frequency,
    time: job.time,
    timezone: job.timezone || DEFAULT_REPORT_TIMEZONE,
    dayOfWeek: job.dayOfWeek,
    dayOfMonth: job.dayOfMonth,
  };
}

export function scheduleToJob(s: Pick<IScheduledReport,
  "name" | "reportType" | "frequency" | "time" | "timezone" | "dayOfWeek" | "dayOfMonth" | "reportPeriod" |
  "coverage" | "recipients" | "linkTtlHours" | "attachFiles" | "filters"> & { _id?: unknown }): ReportJob {
  return {
    scheduleId: s._id ? String(s._id) : null,
    name: s.name || "Automated Report",
    reportType: s.reportType as LegacyReportType,
    frequency: s.frequency,
    time: s.time,
    timezone: s.timezone || DEFAULT_REPORT_TIMEZONE,
    dayOfWeek: s.dayOfWeek,
    dayOfMonth: s.dayOfMonth,
    reportPeriod: s.reportPeriod || "daily",
    coverage: s.coverage || "previous",
    recipients: s.recipients || [],
    linkTtlHours: s.linkTtlHours,
    attachFiles: s.attachFiles !== false,
    filters: {
      userIds: s.filters?.userIds || [],
      expenseSources: (s.filters?.expenseSources || []) as ExpenseSource[],
      categories: s.filters?.categories || [],
      statuses: (s.filters?.statuses || []) as ExpenseStatus[],
      includeCredit: s.filters?.includeCredit !== false,
      includeDebit: s.filters?.includeDebit !== false,
      search: s.filters?.search || "",
    },
  };
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email is not configured: set EMAIL_USER and EMAIL_PASS (Gmail app password) in the environment.");
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    });
  }
  return transporter;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toReportRow(row: Record<string, unknown>): ReportRow {
  return {
    _id: String(row._id ?? ""),
    date: String(row.date ?? ""),
    type: (row.type as ReportRow["type"]) || "expense",
    source: String(row.source ?? ""),
    userName: String(row.userName ?? "Unknown"),
    userId: String(row.userId ?? ""),
    category: String(row.category ?? ""),
    siteName: String(row.siteName ?? ""),
    amount: Number(row.amount ?? 0) || 0,
    description: String(row.description ?? ""),
    remarks: String(row.remarks ?? ""),
    status: String(row.status ?? ""),
    attachments: Array.isArray(row.attachments) ? (row.attachments as string[]).filter((u) => typeof u === "string") : [],
    createdAt: String(row.createdAt ?? ""),
  };
}

// ─── Report building ──────────────────────────────────────────────────────────

/** Query data for every window of a job and compute the sections. */
export async function buildReportSections(job: ReportJob, slotAt: Date) {
  const timezone = job.timezone || DEFAULT_REPORT_TIMEZONE;
  const windows = getReportWindows(job.reportPeriod, job.coverage || "previous", slotAt, timezone);
  const fromDate = windows.reduce((min, w) => (w.from < min ? w.from : min), windows[0].from);
  const toDate = windows.reduce((max, w) => (w.to > max ? w.to : max), windows[0].to);

  const { engineType, expenseSources } = resolveScope(job.reportType, job.filters);
  const filters = job.filters || {};

  // One query over the union of all windows; sections slice it by date.
  const result = await runReportEngine({
    reportType: engineType,
    fromDate,
    toDate,
    userIds: filters.userIds || [],
    expenseSources,
    categories: filters.categories || [],
    statuses: filters.statuses || [],
    includeCredit: filters.includeCredit !== false,
    includeDebit: filters.includeDebit !== false,
    search: filters.search || "",
    sortBy: "date",
    sortOrder: "desc",
    page: 1,
    limit: 1000,
    timezone,
  });

  const rows = result.allRows.map((r) => toReportRow(r as unknown as Record<string, unknown>));
  const wantsCash = engineType !== "expense";

  const sections: ReportSection[] = [];
  for (const w of windows) {
    const sectionRows = rowsForSection(rows, w);
    const cashPosition = wantsCash
      ? await computeCashPosition({ userIds: filters.userIds || [], fromDate: w.from, toDate: w.to, timezone })
      : null;
    sections.push({ ...w, digest: summarizeRows(sectionRows), cashPosition, rows: sectionRows });
  }

  return { sections, rows, fromDate, toDate, engineType, timezone };
}

// ─── runReport ────────────────────────────────────────────────────────────────

export async function runReport(job: ReportJob, options: RunReportOptions): Promise<RunReportResult> {
  await DB();
  const startedAt = Date.now();
  const slotAt = options.slotAt || new Date();
  const timezone = job.timezone || DEFAULT_REPORT_TIMEZONE;
  const recipients = Array.from(new Set((job.recipients || []).map((e) => e.trim().toLowerCase()).filter(Boolean)));
  const executionKey =
    options.executionKey || `${job.scheduleId || "adhoc"}:${options.triggeredBy}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const executionId = new mongoose.Types.ObjectId();
  const periodLabel = job.reportPeriod || "daily";

  let shareLinkId: mongoose.Types.ObjectId | null = null;

  try {
    if (recipients.length === 0) throw new Error("No recipient email addresses configured for this report.");
    const mailer = getTransporter();

    const { sections, rows, fromDate, toDate, engineType } = await buildReportSections(job, slotAt);
    const generatedAt = DateTime.now().setZone(timezone).toFormat("d LLL yyyy, h:mm a");
    const scheduleDescription = describeSchedule(toTiming(job));
    const typeLabel = reportTypeLabel(engineType);
    const primary = sections[0];

    // ── Share link (token is only ever stored hashed) ──
    const ttlHours = Math.min(24 * 31, Math.max(1, Number(job.linkTtlHours) || DEFAULT_LINK_TTL_HOURS));
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
    const { rawToken, tokenHash } = generateShareToken();
    const shareUrl = `${options.appBaseUrl}/shared-report/${rawToken}`;
    const exportBase = `${options.appBaseUrl}/api/reports/share/${rawToken}/export`;
    const pdfUrl = `${exportBase}?format=pdf`;
    const excelUrl = `${exportBase}?format=xlsx`;

    const sectionSummaries = sections.map((s) => ({
      key: s.key,
      label: s.label,
      from: s.from,
      to: s.to,
      total: s.digest.expense.total,
      count: s.digest.expense.count,
    }));

    const shareLink = await ReportShareLink.create({
      reportExecutionId: executionId,
      scheduleId: job.scheduleId || null,
      tokenHash,
      expiresAt,
      snapshotData: {
        version: 2,
        reportType: engineType,
        fromDate,
        toDate,
        period: periodLabel,
        recordCount: rows.length,
        totalAmount: primary?.digest.expense.total ?? 0,
        filters: { ...(job.filters || {}), reportType: engineType },
        sections: sections.map(({ rows: _rows, ...rest }) => rest),
        rows,
        scheduleName: job.name,
        scheduleDescription,
        coverage: job.coverage || "previous",
        frequency: job.frequency,
        generatedAt,
        slotAt: slotAt.toISOString(),
        timezone,
      },
    });
    shareLinkId = shareLink._id as mongoose.Types.ObjectId;

    // ── Files ──
    const exportSnapshot = { scheduleName: job.name, reportType: engineType, generatedAt, timezone, sections };
    const pdfBuffer = buildReportPdf(exportSnapshot);
    const excelBuffer = await buildReportExcel(exportSnapshot);
    const baseName = safeFileName("cashwise", job.name, primary ? primary.to : DateTime.now().toISODate()!);

    // Optional permanent archive copy of the PDF for the Settings history.
    // Runs alongside the email send (not before it) and never fails the report.
    const archive: Promise<string | null> =
      process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT
        ? withTimeout(uploadToImageKit(pdfBuffer, "expense-reports", `${baseName}.pdf`), IMAGEKIT_TIMEOUT_MS).catch((err) => {
            console.warn("[autoExpenseReport] PDF archive upload skipped:", (err as Error).message);
            return null;
          })
        : Promise.resolve(null);

    // ── Email ──
    const attach = job.attachFiles !== false;
    const emailParams = {
      scheduleName: job.name,
      reportTypeLabel: typeLabel,
      scheduleDescription,
      generatedAt,
      sections,
      shareUrl,
      pdfUrl,
      excelUrl,
      expiresAt,
      timezone,
      attachmentsIncluded: attach,
    };
    const subjectRange = primary ? primary.rangeLabel : "";
    const subjectTotal = primary ? ` · ${fmtINR(primary.digest.expense.total)}` : "";

    const info = await mailer.sendMail({
      from: `"CashWise Reports" <${process.env.EMAIL_USER}>`,
      to: recipients.join(", "),
      subject: `${job.name} — ${subjectRange}${subjectTotal}`,
      text: buildReportEmailText(emailParams),
      html: buildReportEmailHtml(emailParams),
      attachments: attach
        ? [
            { filename: `${baseName}.pdf`, content: pdfBuffer, contentType: "application/pdf" },
            {
              filename: `${baseName}.xlsx`,
              content: excelBuffer,
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          ]
        : [],
    });

    const archivedUrl = await archive;
    const pdfUrls = archivedUrl ? [archivedUrl] : [];

    const durationMs = Date.now() - startedAt;
    await ReportExecution.create({
      _id: executionId,
      scheduleId: job.scheduleId || null,
      executionKey,
      reportType: engineType,
      period: periodLabel,
      fromDate,
      toDate,
      recipients,
      recipientCount: recipients.length,
      recordCount: rows.length,
      totalAmount: primary?.digest.expense.total ?? 0,
      status: "success",
      errorMessage: null,
      pdfUrls,
      shareLinkId,
      shareUrl,
      shareExpiresAt: expiresAt,
      slotAt: options.triggeredBy === "cron" ? slotAt : null,
      sections: sectionSummaries,
      emailMessageId: info?.messageId || null,
      durationMs,
      executedAt: new Date(),
      triggeredBy: options.triggeredBy,
    });

    return {
      executionId: executionId.toString(),
      executionKey,
      recipients,
      recordCount: rows.length,
      totalAmount: primary?.digest.expense.total ?? 0,
      sections: sectionSummaries,
      shareUrl,
      shareExpiresAt: expiresAt,
      pdfUrl,
      excelUrl,
      durationMs,
    };
  } catch (error) {
    const message = (error as Error)?.message || "Failed to generate and send report";
    // A link to a report that was never delivered must not stay usable.
    if (shareLinkId) await ReportShareLink.deleteOne({ _id: shareLinkId }).catch(() => {});
    await ReportExecution.create({
      scheduleId: job.scheduleId || null,
      executionKey: `${executionKey}:failed:${Date.now()}`,
      reportType: job.reportType,
      period: periodLabel,
      fromDate: "-",
      toDate: "-",
      recipients,
      recipientCount: recipients.length,
      recordCount: 0,
      totalAmount: 0,
      status: "failed",
      errorMessage: message,
      pdfUrls: [],
      slotAt: options.triggeredBy === "cron" ? slotAt : null,
      durationMs: Date.now() - startedAt,
      executedAt: new Date(),
      triggeredBy: options.triggeredBy,
    }).catch((e) => console.error("[autoExpenseReport] could not log failure:", e));
    throw error;
  }
}

// ─── dispatchDueReports ───────────────────────────────────────────────────────

export async function dispatchDueReports(params: {
  appBaseUrl: string;
  source: string;
  now?: Date;
  /** Stop starting new reports after this long so the function never times out. */
  budgetMs?: number;
}): Promise<DispatchSummary> {
  await DB();
  const started = Date.now();
  const now = params.now || new Date();
  const budgetMs = params.budgetMs ?? 30_000;

  const summary: DispatchSummary = { checked: 0, due: 0, sent: 0, failed: 0, skipped: 0, deferred: 0, durationMs: 0, results: [] };

  const schedules = await ScheduledReport.find({
    enabled: true,
    $or: [{ nextRunAt: { $lte: now } }, { nextRunAt: null }],
  })
    .sort({ nextRunAt: 1 })
    .lean();
  summary.checked = schedules.length;

  const processSchedule = async (schedule: (typeof schedules)[number]) => {
    const id = String(schedule._id);
    const timing = toTiming(schedule);

    // Enabled without a computed next run (e.g. edited directly in the DB).
    if (!schedule.nextRunAt) {
      const nextRunAt = nextSlotAfter(timing, now);
      await ScheduledReport.updateOne({ _id: schedule._id }, { $set: { nextRunAt } });
      summary.skipped++;
      summary.results.push({ scheduleId: id, name: schedule.name, status: "skipped", reason: "Initialised next run", nextRunAt: nextRunAt.toISOString() });
      return;
    }

    const slot = latestSlotAtOrBefore(timing, now);
    const alreadyDelivered = slot && schedule.lastSuccessSlotAt && new Date(schedule.lastSuccessSlotAt) >= slot;
    if (!slot || alreadyDelivered) {
      const nextRunAt = nextSlotAfter(timing, now);
      await ScheduledReport.updateOne({ _id: schedule._id }, { $set: { nextRunAt } });
      summary.skipped++;
      summary.results.push({ scheduleId: id, name: schedule.name, status: "skipped", reason: "Latest slot already delivered", nextRunAt: nextRunAt.toISOString() });
      return;
    }

    summary.due++;

    if (Date.now() - started > budgetMs) {
      summary.deferred++;
      summary.results.push({ scheduleId: id, name: schedule.name, status: "deferred", reason: "Time budget used — will send on the next tick", slotAt: slot.toISOString() });
      return;
    }

    // Atomic claim: only one concurrent tick may work on this schedule.
    const claimed = await ScheduledReport.findOneAndUpdate(
      {
        _id: schedule._id,
        enabled: true,
        nextRunAt: schedule.nextRunAt,
        $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
      },
      { $set: { lockedUntil: new Date(Date.now() + LOCK_MS) } },
      { new: true }
    ).lean();
    if (!claimed) {
      summary.skipped++;
      summary.results.push({ scheduleId: id, name: schedule.name, status: "skipped", reason: "Being processed by another tick" });
      return;
    }

    const executionKey = `${id}:slot:${slot.toISOString()}`;
    const nextRunAt = nextSlotAfter(timing, now);

    // Guard against a crash between "email sent" and "schedule updated".
    if (await ReportExecution.exists({ executionKey, status: "success" })) {
      await ScheduledReport.updateOne(
        { _id: schedule._id },
        { $set: { lastSuccessSlotAt: slot, nextRunAt, lockedUntil: null, consecutiveFailures: 0 } }
      );
      summary.skipped++;
      summary.results.push({ scheduleId: id, name: schedule.name, status: "skipped", reason: "Slot already delivered", nextRunAt: nextRunAt.toISOString() });
      return;
    }

    try {
      const result = await runReport(scheduleToJob(claimed), {
        slotAt: slot,
        triggeredBy: "cron",
        appBaseUrl: params.appBaseUrl,
        executionKey,
      });
      await ScheduledReport.updateOne(
        { _id: schedule._id },
        {
          $set: {
            lastRunAt: new Date(),
            lastSuccessAt: new Date(),
            lastSuccessSlotAt: slot,
            lastErrorMessage: null,
            consecutiveFailures: 0,
            lockedUntil: null,
            nextRunAt,
          },
        }
      );
      summary.sent++;
      summary.results.push({
        scheduleId: id,
        name: schedule.name,
        status: "sent",
        slotAt: slot.toISOString(),
        nextRunAt: nextRunAt.toISOString(),
        shareUrl: result.shareUrl,
        recordCount: result.recordCount,
      });
    } catch (err) {
      const message = (err as Error)?.message || "Unknown error";
      const attempts = (claimed.consecutiveFailures || 0) + 1;
      const giveUp = attempts >= MAX_ATTEMPTS_PER_SLOT;
      const retryAt = giveUp ? nextRunAt : new Date(Date.now() + RETRY_DELAY_MS);
      await ScheduledReport.updateOne(
        { _id: schedule._id },
        {
          $set: {
            lastRunAt: new Date(),
            lastFailedAt: new Date(),
            lastErrorMessage: giveUp ? `${message} (gave up after ${attempts} attempts)` : message,
            consecutiveFailures: giveUp ? 0 : attempts,
            lockedUntil: null,
            nextRunAt: retryAt,
          },
        }
      );
      console.error(`[dispatchDueReports] "${schedule.name}" failed (attempt ${attempts}):`, message);
      summary.failed++;
      summary.results.push({
        scheduleId: id,
        name: schedule.name,
        status: "failed",
        reason: message,
        slotAt: slot.toISOString(),
        nextRunAt: retryAt.toISOString(),
      });
    }
  };

  // Reports are network-bound (SMTP, file upload), so a few run side by side;
  // anything not started within the time budget is sent on the next tick.
  const queue = [...schedules];
  await Promise.all(
    Array.from({ length: Math.min(DISPATCH_CONCURRENCY, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await processSchedule(next);
    })
  );

  summary.durationMs = Date.now() - started;

  await SchedulerStatus.updateOne(
    { _id: SCHEDULER_STATUS_ID },
    {
      $set: {
        lastTickAt: now,
        lastTickSource: params.source,
        lastTickSummary: {
          due: summary.due,
          sent: summary.sent,
          failed: summary.failed,
          skipped: summary.skipped,
          durationMs: summary.durationMs,
        },
        ...(summary.sent > 0 ? { lastSentAt: new Date() } : {}),
      },
      $inc: { tickCount: 1 },
    },
    { upsert: true }
  ).catch((e) => console.error("[dispatchDueReports] heartbeat update failed:", e));

  return summary;
}
