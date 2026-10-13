/**
 * /api/settings/scheduled-reports/route.ts
 *
 * Full CRUD for report schedules.
 * Admin/Manager only.
 *
 * GET    — list all schedules + scheduler heartbeat
 * POST   — create new schedule
 * PUT    — update existing schedule (id in body)
 * DELETE — delete schedule (?id=)
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";
import SchedulerStatus, { SCHEDULER_STATUS_ID } from "@app/_model/schedulerStatus.model";
import {
  computeNextRun,
  latestSlotAtOrBefore,
  normaliseDayOfMonth,
  normaliseDayOfWeek,
  DEFAULT_REPORT_TIMEZONE,
} from "@app/_lib/reportSchedule";

export const dynamic = "force-dynamic";
(async () => await DB())();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const REPORT_TYPES = ["expense", "credit", "debit", "combined", "office", "travel", "toPay", "all"];
const FREQUENCIES = ["daily", "weekly", "monthly"];
const PERIODS = ["daily", "weekly", "monthly", "all"];
const COVERAGES = ["current", "previous"];
const LINK_TTL_CHOICES = [24, 72, 168, 336, 720];
/** A slot that passed less than this long ago and is undelivered stays pending on edit. */
const PENDING_SLOT_GRACE_MS = 3 * 60 * 60 * 1000;

function getAuthUser(req: NextRequest) {
  const h = req.headers.get("user");
  if (!h) return null;
  try { return JSON.parse(h); } catch { return null; }
}

function isAdmin(user: unknown): boolean {
  return !!(user && typeof user === "object" && ["admin", "manager"].includes((user as Record<string, string>).role));
}

function validateScheduleBody(body: Record<string, unknown>) {
  const errors: string[] = [];

  if (!String(body.name || "").trim()) errors.push("Schedule name is required");

  const time = String(body.time || "");
  if (!TIME_RE.test(time)) errors.push("Invalid time format — use HH:mm (24-hour)");

  const timezone = String(body.timezone || DEFAULT_REPORT_TIMEZONE);
  if (!DateTime.now().setZone(timezone).isValid) errors.push(`Unknown timezone "${timezone}"`);

  const recipients = Array.isArray(body.recipients) ? body.recipients as string[] : [];
  if (recipients.length === 0) errors.push("At least one recipient email is required");
  if (recipients.length > 50) errors.push("A schedule can have at most 50 recipients");
  const badEmails = recipients.filter((e) => !EMAIL_RE.test(String(e).trim()));
  if (badEmails.length > 0) errors.push(`Invalid email(s): ${badEmails.join(", ")}`);

  if (!REPORT_TYPES.includes(String(body.reportType || ""))) {
    errors.push(`Invalid reportType — allowed: ${REPORT_TYPES.join(", ")}`);
  }
  if (!FREQUENCIES.includes(String(body.frequency || ""))) {
    errors.push("Invalid frequency — allowed: daily, weekly, monthly");
  }
  if (!PERIODS.includes(String(body.reportPeriod || "daily"))) {
    errors.push("Invalid reportPeriod");
  }
  if (body.coverage !== undefined && !COVERAGES.includes(String(body.coverage))) {
    errors.push("Invalid coverage — allowed: current, previous");
  }

  return errors;
}

function cleanFilters(filters: Record<string, unknown> = {}) {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String).filter(Boolean) : []);
  return {
    userIds: arr(filters.userIds).filter((id) => mongoose.Types.ObjectId.isValid(id)),
    expenseSources: arr(filters.expenseSources).filter((s) => ["office", "travel", "toPay"].includes(s)),
    categories: arr(filters.categories),
    statuses: arr(filters.statuses).filter((s) => ["pending", "approved", "rejected"].includes(s)),
    includeCredit: filters.includeCredit !== false,
    includeDebit: filters.includeDebit !== false,
    visibleFields: arr(filters.visibleFields),
    search: typeof filters.search === "string" ? filters.search.slice(0, 100) : "",
  };
}

/** Normalised document fields shared by create and update. */
function scheduleFields(body: Record<string, unknown>) {
  const frequency = String(body.frequency || "daily") as "daily" | "weekly" | "monthly";
  const time = String(body.time || "09:00");
  const timezone = String(body.timezone || DEFAULT_REPORT_TIMEZONE);
  const dayOfWeek = normaliseDayOfWeek(body.dayOfWeek);
  const dayOfMonth = normaliseDayOfMonth(body.dayOfMonth);
  const enabled = body.enabled !== false;
  const ttl = Number(body.linkTtlHours);

  return {
    name: String(body.name || "Automated Report").trim().slice(0, 100),
    reportType: String(body.reportType || "expense"),
    frequency,
    time,
    timezone,
    dayOfWeek,
    dayOfMonth,
    recipients: Array.from(new Set((body.recipients as string[]).map((e) => e.trim().toLowerCase()))),
    reportPeriod: String(body.reportPeriod || "daily"),
    // Absent on schedules created before coverage existed — keep their behaviour.
    coverage: COVERAGES.includes(String(body.coverage)) ? String(body.coverage) : "previous",
    linkTtlHours: LINK_TTL_CHOICES.includes(ttl) ? ttl : 168,
    attachFiles: body.attachFiles !== false,
    enabled,
    nextRunAt: enabled ? computeNextRun({ frequency, time, timezone, dayOfWeek, dayOfMonth }) : null,
    filters: cleanFilters((body.filters || {}) as Record<string, unknown>),
    // Any change to timing or content starts a fresh retry cycle.
    consecutiveFailures: 0,
    lockedUntil: null,
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!isAdmin(authUser)) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "Access denied" }, { status: 403 });
    }

    await DB();
    const [schedules, scheduler] = await Promise.all([
      ScheduledReport.find().sort({ createdAt: -1 }).lean(),
      SchedulerStatus.findById(SCHEDULER_STATUS_ID).lean(),
    ]);

    return NextResponse.json({
      type: "SUCCESS",
      message: "Scheduled reports retrieved",
      data: schedules,
      scheduler: scheduler
        ? {
            lastTickAt: scheduler.lastTickAt,
            lastTickSource: scheduler.lastTickSource,
            lastTickSummary: scheduler.lastTickSummary,
            lastSentAt: scheduler.lastSentAt,
            tickCount: scheduler.tickCount,
          }
        : null,
      emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      cronSecretConfigured: !!process.env.CRON_SECRET,
      onVercel: !!process.env.VERCEL,
    });
  } catch (error: any) {
    return NextResponse.json({ type: "ERROR", message: error?.message }, { status: 500 });
  }
}

// ─── POST (create) ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!isAdmin(authUser)) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const errors = validateScheduleBody(body);
    if (errors.length > 0) {
      return NextResponse.json({ type: "VALIDATION_ERROR", message: errors.join("; ") }, { status: 400 });
    }

    await DB();
    const doc = await ScheduledReport.create({
      ...scheduleFields(body),
      createdBy: authUser._id,
      updatedBy: authUser._id,
    });

    return NextResponse.json({
      type: "SUCCESS",
      message: "Schedule created successfully",
      data: doc,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ type: "ERROR", message: error?.message }, { status: 500 });
  }
}

// ─── PUT (update) ─────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!isAdmin(authUser)) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { _id, ...rest } = body;

    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
      return NextResponse.json({ type: "BAD_REQUEST", message: "Valid _id is required for update" }, { status: 400 });
    }

    const errors = validateScheduleBody(rest);
    if (errors.length > 0) {
      return NextResponse.json({ type: "VALIDATION_ERROR", message: errors.join("; ") }, { status: 400 });
    }

    await DB();
    const existing = await ScheduledReport.findById(_id).lean();
    if (!existing) {
      return NextResponse.json({ type: "NOT_FOUND", message: "Schedule not found" }, { status: 404 });
    }

    const fields = scheduleFields(rest);
    // On the hourly Hobby tick a slot can have passed without being delivered
    // yet. Editing an active schedule in that window must not skip today's email.
    if (fields.enabled && existing.enabled) {
      const now = new Date();
      const latest = latestSlotAtOrBefore(fields, now);
      const delivered = latest && existing.lastSuccessSlotAt && new Date(existing.lastSuccessSlotAt) >= latest;
      if (latest && !delivered && now.getTime() - latest.getTime() < PENDING_SLOT_GRACE_MS && new Date(existing.createdAt) < latest) {
        fields.nextRunAt = latest;
      }
    }

    const updated = await ScheduledReport.findByIdAndUpdate(
      _id,
      { ...fields, updatedBy: authUser._id },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ type: "NOT_FOUND", message: "Schedule not found" }, { status: 404 });
    }

    return NextResponse.json({
      type: "SUCCESS",
      message: "Schedule updated successfully",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ type: "ERROR", message: error?.message }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!isAdmin(authUser)) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ type: "BAD_REQUEST", message: "Valid id query param required" }, { status: 400 });
    }

    await DB();
    await ScheduledReport.findByIdAndDelete(id);

    return NextResponse.json({ type: "SUCCESS", message: "Schedule deleted" });
  } catch (error: any) {
    return NextResponse.json({ type: "ERROR", message: error?.message }, { status: 500 });
  }
}
