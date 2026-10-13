/**
 * @app/_lib/reportSchedule.ts
 *
 * Time maths for automated reports: when a schedule fires and which dates a
 * report covers. Pure luxon, no server imports — shared by the cron
 * dispatcher, the settings API and the settings page preview so all three
 * always agree.
 *
 * Delivery model: a schedule has "slots" (e.g. every day at 19:00 IST). The
 * dispatcher runs on a coarse tick (hourly on Vercel Hobby, every minute on
 * Pro / external pinger) and sends the most recent slot that has passed and
 * was not yet delivered. Report dates are derived from the slot, never from
 * the moment the tick happened to run, so a late tick still reports the
 * correct day/week/month.
 */

import { DateTime } from "luxon";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportFrequency = "daily" | "weekly" | "monthly";
export type ReportPeriodMode = "daily" | "weekly" | "monthly" | "all";
export type ReportCoverage = "current" | "previous";
export type ReportWindowKey = "daily" | "weekly" | "monthly";

export interface ScheduleTiming {
  frequency: ReportFrequency;
  time: string;         // "HH:mm" 24h
  timezone?: string;    // IANA zone, default Asia/Kolkata
  dayOfWeek?: number;   // weekly: 1 = Monday … 7 = Sunday
  dayOfMonth?: number;  // monthly: 1–31, clamped to the month's last day
}

export interface ReportWindow {
  key: ReportWindowKey;
  label: string;        // "Daily", "Week to date", "Last month" …
  from: string;         // YYYY-MM-DD (inclusive, schedule timezone)
  to: string;           // YYYY-MM-DD (inclusive, schedule timezone)
  rangeLabel: string;   // "Tue, 14 Oct 2026" / "6 – 12 Oct 2026"
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_REPORT_TIMEZONE = "Asia/Kolkata";

export const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

/** Longest gap between two slots of any frequency, plus margin. */
const MAX_SCAN_DAYS = 70;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseTime(time: string | undefined): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || "").trim());
  if (!match) return { hour: 9, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return { hour, minute };
}

export function normaliseDayOfWeek(value: unknown): number {
  const n = Math.round(Number(value));
  return n >= 1 && n <= 7 ? n : 1;
}

export function normaliseDayOfMonth(value: unknown): number {
  const n = Math.round(Number(value));
  return n >= 1 && n <= 31 ? n : 1;
}

function zoneOf(timing: ScheduleTiming): string {
  const zone = timing.timezone || DEFAULT_REPORT_TIMEZONE;
  return DateTime.now().setZone(zone).isValid ? zone : DEFAULT_REPORT_TIMEZONE;
}

/** The slot on a given calendar day, or null when the schedule does not fire that day. */
function slotOnDay(day: DateTime, timing: ScheduleTiming): DateTime | null {
  if (timing.frequency === "weekly" && day.weekday !== normaliseDayOfWeek(timing.dayOfWeek)) {
    return null;
  }
  if (timing.frequency === "monthly") {
    const target = Math.min(normaliseDayOfMonth(timing.dayOfMonth), day.daysInMonth ?? 28);
    if (day.day !== target) return null;
  }
  const { hour, minute } = parseTime(timing.time);
  return day.set({ hour, minute, second: 0, millisecond: 0 });
}

// ─── Slot calculation ─────────────────────────────────────────────────────────

/** First slot strictly after `after`. */
export function nextSlotAfter(timing: ScheduleTiming, after: Date = new Date()): Date {
  const zone = zoneOf(timing);
  const ref = DateTime.fromJSDate(after).setZone(zone);
  let day = ref.startOf("day");
  for (let i = 0; i <= MAX_SCAN_DAYS; i++, day = day.plus({ days: 1 })) {
    const slot = slotOnDay(day, timing);
    if (slot && slot > ref) return slot.toJSDate();
  }
  return ref.plus({ days: 1 }).toJSDate();
}

/** Most recent slot at or before `atOrBefore`, or null if none in range. */
export function latestSlotAtOrBefore(timing: ScheduleTiming, atOrBefore: Date = new Date()): Date | null {
  const zone = zoneOf(timing);
  const ref = DateTime.fromJSDate(atOrBefore).setZone(zone);
  let day = ref.startOf("day");
  for (let i = 0; i <= MAX_SCAN_DAYS; i++, day = day.minus({ days: 1 })) {
    const slot = slotOnDay(day, timing);
    if (slot && slot <= ref) return slot.toJSDate();
  }
  return null;
}

/** Backwards-compatible name used by the settings API. */
export function computeNextRun(timing: ScheduleTiming, after: Date = new Date()): Date {
  return nextSlotAfter(timing, after);
}

// ─── Report windows ───────────────────────────────────────────────────────────

export function formatRangeLabel(from: string, to: string): string {
  const a = DateTime.fromISO(from);
  const b = DateTime.fromISO(to);
  if (!a.isValid || !b.isValid) return `${from} – ${to}`;
  if (from === to) return a.toFormat("ccc, d LLL yyyy");
  if (a.hasSame(b, "month")) return `${a.toFormat("d")} – ${b.toFormat("d LLL yyyy")}`;
  if (a.hasSame(b, "year")) return `${a.toFormat("d LLL")} – ${b.toFormat("d LLL yyyy")}`;
  return `${a.toFormat("d LLL yyyy")} – ${b.toFormat("d LLL yyyy")}`;
}

function makeWindow(key: ReportWindowKey, label: string, from: DateTime, to: DateTime): ReportWindow {
  const f = from.toISODate()!;
  const t = to.toISODate()!;
  return { key, label, from: f, to: t, rangeLabel: formatRangeLabel(f, t) };
}

/**
 * Date windows a report covers for a given slot.
 *
 *  coverage "current"  → the period that is in progress at send time
 *                         (today / this week so far / this month so far)
 *  coverage "previous" → the last completed period
 *                         (yesterday / last Mon–Sun week / last calendar month)
 *
 *  mode "all" sends three sections anchored on the same day:
 *  that day, week-to-date and month-to-date.
 */
export function getReportWindows(
  mode: ReportPeriodMode,
  coverage: ReportCoverage,
  slot: Date,
  timezone: string = DEFAULT_REPORT_TIMEZONE
): ReportWindow[] {
  const zone = DateTime.now().setZone(timezone).isValid ? timezone : DEFAULT_REPORT_TIMEZONE;
  const slotDay = DateTime.fromJSDate(slot).setZone(zone).startOf("day");
  const anchor = coverage === "current" ? slotDay : slotDay.minus({ days: 1 });

  if (mode === "all") {
    return [
      makeWindow("daily", coverage === "current" ? "Today" : "Yesterday", anchor, anchor),
      makeWindow("weekly", "Week to date", anchor.startOf("week"), anchor),
      makeWindow("monthly", "Month to date", anchor.startOf("month"), anchor),
    ];
  }

  if (mode === "weekly") {
    if (coverage === "current") {
      return [makeWindow("weekly", "This week", slotDay.startOf("week"), slotDay)];
    }
    const start = slotDay.startOf("week").minus({ weeks: 1 });
    return [makeWindow("weekly", "Last week", start, start.endOf("week"))];
  }

  if (mode === "monthly") {
    if (coverage === "current") {
      return [makeWindow("monthly", "This month", slotDay.startOf("month"), slotDay)];
    }
    const start = slotDay.startOf("month").minus({ months: 1 });
    return [makeWindow("monthly", "Last month", start, start.endOf("month"))];
  }

  return [makeWindow("daily", coverage === "current" ? "Today" : "Yesterday", anchor, anchor)];
}

// ─── Human-readable descriptions ──────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatTime12h(time: string): string {
  const { hour, minute } = parseTime(time);
  return DateTime.fromObject({ hour, minute }).toFormat("h:mm a");
}

/** "Every day at 7:00 PM" / "Every Monday at 9:00 AM" / "Monthly on the last day at 10:00 AM" */
export function describeSchedule(timing: ScheduleTiming): string {
  const at = formatTime12h(timing.time);
  if (timing.frequency === "weekly") {
    const day = WEEKDAYS.find((d) => d.value === normaliseDayOfWeek(timing.dayOfWeek))?.label ?? "Monday";
    return `Every ${day} at ${at}`;
  }
  if (timing.frequency === "monthly") {
    const dom = normaliseDayOfMonth(timing.dayOfMonth);
    return `Monthly on the ${dom >= 31 ? "last day" : ordinal(dom)} at ${at}`;
  }
  return `Every day at ${at}`;
}

export function describeCoverage(mode: ReportPeriodMode, coverage: ReportCoverage): string {
  const current = coverage === "current";
  switch (mode) {
    case "all":
      return current
        ? "Today + week-to-date + month-to-date"
        : "Yesterday + week-to-date + month-to-date";
    case "weekly":
      return current ? "This week so far (Mon → send day)" : "Last full week (Mon – Sun)";
    case "monthly":
      return current ? "This month so far (1st → send day)" : "Last full calendar month";
    default:
      return current ? "Today's entries (up to send time)" : "Yesterday's entries";
  }
}
