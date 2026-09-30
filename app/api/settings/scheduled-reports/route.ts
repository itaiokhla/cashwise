/**
 * /api/settings/scheduled-reports/route.ts
 *
 * Full CRUD for report schedules.
 * Admin/Manager only.
 *
 * GET    — list all schedules
 * POST   — create new schedule
 * PUT    — update existing schedule (id in body)
 * DELETE — delete schedule (?id=)
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";
import { computeNextRun } from "@app/_lib/autoExpenseReport";
import type { ExpenseSource, ExpenseStatus } from "@app/_lib/reportEngine";

export const dynamic = "force-dynamic";
(async () => await DB())();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

  const time = String(body.time || "");
  if (!TIME_RE.test(time)) errors.push("Invalid time format — use HH:mm (24-hour)");

  const recipients = Array.isArray(body.recipients) ? body.recipients as string[] : [];
  if (recipients.length === 0) errors.push("At least one recipient email is required");
  const badEmails = recipients.filter((e) => !EMAIL_RE.test(String(e).trim()));
  if (badEmails.length > 0) errors.push(`Invalid email(s): ${badEmails.join(", ")}`);

  const allowedTypes = ["expense", "credit", "debit", "combined", "office", "travel", "toPay", "all"];
  if (!allowedTypes.includes(String(body.reportType || ""))) {
    errors.push(`Invalid reportType — allowed: ${allowedTypes.join(", ")}`);
  }

  const allowedFreq = ["daily", "weekly", "monthly"];
  if (!allowedFreq.includes(String(body.frequency || ""))) {
    errors.push("Invalid frequency — allowed: daily, weekly, monthly");
  }

  const allowedPeriods = ["daily", "weekly", "monthly", "all"];
  if (!allowedPeriods.includes(String(body.reportPeriod || "all"))) {
    errors.push("Invalid reportPeriod");
  }

  return errors;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!isAdmin(authUser)) {
      return NextResponse.json({ type: "UNAUTHORIZED", message: "Access denied" }, { status: 403 });
    }

    const schedules = await ScheduledReport.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      type: "SUCCESS",
      message: "Scheduled reports retrieved",
      data: schedules,
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

    const {
      name = "Automated Report",
      reportType = "expense",
      frequency = "daily",
      time = "09:00",
      timezone = "Asia/Kolkata",
      recipients = [],
      reportPeriod = "all",
      enabled = true,
      filters = {},
    } = body;

    const cleanRecipients = (recipients as string[]).map((e) => e.trim().toLowerCase());
    const nextRunAt = enabled ? computeNextRun(frequency, time, timezone) : null;

    // Validate and clean filters
    const cleanFilters = {
      userIds: Array.isArray(filters.userIds) ? filters.userIds.filter(Boolean) : [],
      expenseSources: Array.isArray(filters.expenseSources)
        ? (filters.expenseSources as string[]).filter((s) => ["office", "travel", "toPay"].includes(s))
        : [],
      categories: Array.isArray(filters.categories) ? filters.categories.filter(Boolean) : [],
      statuses: Array.isArray(filters.statuses)
        ? (filters.statuses as string[]).filter((s) => ["pending", "approved", "rejected"].includes(s))
        : [],
      includeCredit: filters.includeCredit !== false,
      includeDebit: filters.includeDebit !== false,
      visibleFields: Array.isArray(filters.visibleFields) ? filters.visibleFields.filter(Boolean) : [],
      search: typeof filters.search === "string" ? filters.search : "",
    };

    const doc = await ScheduledReport.create({
      name: String(name).trim().slice(0, 100),
      reportType,
      frequency,
      time,
      timezone,
      recipients: cleanRecipients,
      reportPeriod,
      enabled: Boolean(enabled),
      nextRunAt,
      filters: cleanFilters,
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

    const {
      name = "Automated Report",
      reportType = "expense",
      frequency = "daily",
      time = "09:00",
      timezone = "Asia/Kolkata",
      recipients = [],
      reportPeriod = "all",
      enabled = true,
      filters = {},
    } = rest;

    const cleanRecipients = (recipients as string[]).map((e) => e.trim().toLowerCase());
    const nextRunAt = enabled ? computeNextRun(frequency, time, timezone) : null;

    const cleanFilters = {
      userIds: Array.isArray(filters.userIds) ? filters.userIds.filter(Boolean) : [],
      expenseSources: Array.isArray(filters.expenseSources)
        ? (filters.expenseSources as string[]).filter((s) => ["office", "travel", "toPay"].includes(s))
        : [],
      categories: Array.isArray(filters.categories) ? filters.categories.filter(Boolean) : [],
      statuses: Array.isArray(filters.statuses)
        ? (filters.statuses as string[]).filter((s) => ["pending", "approved", "rejected"].includes(s))
        : [],
      includeCredit: filters.includeCredit !== false,
      includeDebit: filters.includeDebit !== false,
      visibleFields: Array.isArray(filters.visibleFields) ? filters.visibleFields.filter(Boolean) : [],
      search: typeof filters.search === "string" ? filters.search : "",
    };

    const updated = await ScheduledReport.findByIdAndUpdate(
      _id,
      {
        name: String(name).trim().slice(0, 100),
        reportType,
        frequency,
        time,
        timezone,
        recipients: cleanRecipients,
        reportPeriod,
        enabled: Boolean(enabled),
        nextRunAt,
        filters: cleanFilters,
        updatedBy: authUser._id,
      },
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

    await ScheduledReport.findByIdAndDelete(id);

    return NextResponse.json({ type: "SUCCESS", message: "Schedule deleted" });
  } catch (error: any) {
    return NextResponse.json({ type: "ERROR", message: error?.message }, { status: 500 });
  }
}
