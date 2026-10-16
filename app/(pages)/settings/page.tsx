"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import Sidebar from "@app/_components/Sidebar";
import { toast } from "react-toastify";
import {
  FiActivity,
  FiAlertTriangle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCopy,
  FiEdit2,
  FiExternalLink,
  FiFileText,
  FiFilter,
  FiInfo,
  FiMail,
  FiPlus,
  FiRefreshCw,
  FiSend,
  FiTrash2,
  FiUsers,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import {
  WEEKDAYS,
  computeNextRun,
  describeCoverage,
  describeSchedule,
  getReportWindows,
  type ReportCoverage,
  type ReportPeriodMode,
} from "@app/_lib/reportSchedule";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = "expense" | "credit" | "debit" | "combined" | "office" | "travel" | "toPay" | "all";
type Frequency = "daily" | "weekly" | "monthly";

interface ScheduleFilters {
  userIds?: string[];
  expenseSources?: ("office" | "travel" | "toPay")[];
  categories?: string[];
  statuses?: ("pending" | "approved" | "rejected")[];
  includeCredit?: boolean;
  includeDebit?: boolean;
  visibleFields?: string[];
  search?: string;
}

interface Schedule {
  _id?: string;
  name: string;
  reportType: ReportType;
  frequency: Frequency;
  time: string;
  timezone: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  recipients: string[];
  reportPeriod: ReportPeriodMode;
  coverage?: ReportCoverage;
  linkTtlHours?: number;
  attachFiles?: boolean;
  enabled: boolean;
  filters?: ScheduleFilters;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  lastFailedAt?: string | null;
  lastErrorMessage?: string | null;
  consecutiveFailures?: number;
  nextRunAt?: string | null;
  createdAt?: string;
}

interface Execution {
  _id: string;
  scheduleId?: string;
  reportType: string;
  period: string;
  fromDate: string;
  toDate: string;
  recipients: string[];
  recordCount: number;
  totalAmount: number;
  status: "success" | "failed";
  errorMessage?: string | null;
  pdfUrls: string[];
  shareUrl?: string | null;
  shareExpiresAt?: string | null;
  sections?: { key: string; label: string; from: string; to: string; total: number; count: number }[];
  durationMs: number;
  executedAt: string;
  triggeredBy: "cron" | "manual_test" | "scheduler" | "manual_generate";
}

interface SchedulerInfo {
  lastTickAt: string | null;
  lastTickSource: string;
  lastTickSummary?: { due: number; sent: number; failed: number; skipped: number; durationMs: number };
  lastSentAt: string | null;
  tickCount: number;
}

interface UserItem {
  _id: string;
  name: string;
  role?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "India (IST, UTC+5:30)" },
  { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
  { value: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "UTC", label: "UTC" },
];

const SCOPES: { value: ReportType; label: string; hint: string }[] = [
  { value: "expense", label: "All expenses", hint: "Office, travel and to-pay claims" },
  { value: "combined", label: "Cash & expenses", hint: "Expenses + cash received/spent + cash in hand" },
  { value: "office", label: "Office expenses", hint: "Office claims only" },
  { value: "travel", label: "Travel expenses", hint: "Travel claims only" },
  { value: "toPay", label: "To-pay (vendors)", hint: "Vendor / contractor payments" },
  { value: "credit", label: "Cash received", hint: "Credit transactions only" },
  { value: "debit", label: "Cash spent", hint: "Debit transactions only" },
];

const CONTENT_OPTIONS: { value: ReportPeriodMode; label: string; hint: string }[] = [
  { value: "all", label: "Day + week + month", hint: "Three sections in one email" },
  { value: "daily", label: "One day", hint: "A single day's entries" },
  { value: "weekly", label: "One week", hint: "Monday to Sunday" },
  { value: "monthly", label: "One month", hint: "Calendar month" },
];

const LINK_TTLS = [
  { value: 24, label: "1 day" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
  { value: 336, label: "14 days" },
  { value: 720, label: "30 days" },
];

const CATEGORIES = [
  "conveyance", "purchase", "food", "tea", "hotel", "labour", "contractor", "courier", "loading",
  "porter", "cartage", "rider", "dailyWages", "transport", "maintenance", "other",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NEW_SCHEDULE: Schedule = {
  name: "Daily Cash Expense Report",
  reportType: "expense",
  frequency: "daily",
  time: "19:00",
  timezone: "Asia/Kolkata",
  dayOfWeek: 1,
  dayOfMonth: 1,
  recipients: [],
  reportPeriod: "all",
  coverage: "current",
  linkTtlHours: 168,
  attachFiles: true,
  enabled: true,
  // All statuses: rejected claims are reported separately and never counted in totals.
  filters: { userIds: [], expenseSources: [], categories: [], statuses: [], includeCredit: true, includeDebit: true },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelize(key: string) {
  if (key === "toPay") return "To pay";
  if (key === "dailyWages") return "Daily wages";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function relative(iso?: string | null): string {
  if (!iso) return "";
  return DateTime.fromISO(iso).toRelative({ style: "short" }) || "";
}

function inZone(iso: string | null | undefined, zone: string, fmt = "ccc d LLL, h:mm a") {
  if (!iso) return "—";
  const dt = DateTime.fromISO(iso).setZone(zone);
  return dt.isValid ? dt.toFormat(fmt) : "—";
}

function fmtINR(n: number | undefined) {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function zoneShort(zone: string) {
  const name = DateTime.now().setZone(zone).offsetNameShort || zone;
  return zone === "Asia/Kolkata" ? "IST" : name;
}

const TRIGGER_LABEL: Record<Execution["triggeredBy"], string> = {
  cron: "Scheduled",
  scheduler: "Scheduled",
  manual_test: "Sent manually",
  manual_generate: "Sent manually",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerInfo | null>(null);
  const [env, setEnv] = useState({ emailConfigured: true, cronSecretConfigured: true, onVercel: false });
  const [users, setUsers] = useState<UserItem[]>([]);
  const [history, setHistory] = useState<Execution[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; data: Schedule } | null>(null);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/scheduled-reports", { cache: "no-store" });
      const json = await res.json();
      if (json.type === "SUCCESS") {
        setSchedules(Array.isArray(json.data) ? json.data : []);
        setScheduler(json.scheduler || null);
        setEnv({
          emailConfigured: json.emailConfigured !== false,
          cronSecretConfigured: json.cronSecretConfigured !== false,
          onVercel: !!json.onVercel,
        });
      } else {
        toast.error(json.message || "Could not load report schedules");
      }
    } catch {
      toast.error("Could not load report schedules");
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      setUsers(Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []);
    } catch {
      /* the employee filter is optional */
    }
  }, []);

  const fetchHistory = useCallback(async (page = 1) => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`/api/settings/scheduled-reports/history?page=${page}&limit=10`, { cache: "no-store" });
      const json = await res.json();
      if (json.type === "SUCCESS" && json.data) {
        setHistory(json.data.executions || []);
        setHistoryTotal(json.data.total || 0);
        setHistoryPage(json.data.page || 1);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchSchedules(), fetchUsers(), fetchHistory(1)]);
      setLoading(false);
    })();
  }, [fetchSchedules, fetchUsers, fetchHistory]);

  const refreshAll = () => Promise.all([fetchSchedules(), fetchHistory(1)]);

  const toggleSchedule = async (s: Schedule) => {
    const enabled = !s.enabled;
    setSchedules((prev) => prev.map((x) => (x._id === s._id ? { ...x, enabled } : x)));
    try {
      const res = await fetch("/api/settings/scheduled-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...s, enabled }),
      });
      const json = await res.json();
      if (json.type !== "SUCCESS") throw new Error(json.message);
      toast.success(enabled ? "Schedule turned on" : "Schedule paused");
      fetchSchedules();
    } catch (err) {
      setSchedules((prev) => prev.map((x) => (x._id === s._id ? { ...x, enabled: !enabled } : x)));
      toast.error((err as Error).message || "Could not update the schedule");
    }
  };

  const deleteSchedule = async (s: Schedule) => {
    if (!s._id || !window.confirm(`Delete “${s.name}”? Recipients will stop receiving this report.`)) return;
    try {
      const res = await fetch(`/api/settings/scheduled-reports?id=${s._id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.type !== "SUCCESS") throw new Error(json.message);
      setSchedules((prev) => prev.filter((x) => x._id !== s._id));
      toast.success("Schedule deleted");
    } catch (err) {
      toast.error((err as Error).message || "Could not delete the schedule");
    }
  };

  const sendNow = async (s: Schedule) => {
    if (!s._id) return;
    if (!window.confirm(`Send “${s.name}” now to ${s.recipients.length} recipient${s.recipients.length === 1 ? "" : "s"}?\n\nThis does not change the regular schedule.`)) return;
    setSendingId(s._id);
    try {
      const res = await fetch("/api/settings/scheduled-reports/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: s._id }),
      });
      const json = await res.json();
      if (json.type !== "SUCCESS") throw new Error(json.message);
      toast.success(`Report emailed to ${json.data.recipients.length} recipient(s)`);
      refreshAll();
    } catch (err) {
      toast.error((err as Error).message || "Sending failed");
      fetchHistory(1);
    } finally {
      setSendingId(null);
    }
  };

  const activeCount = schedules.filter((s) => s.enabled).length;

  return (
    <section className="flex min-h-screen flex-col bg-slate-50">
      <div className="flex min-h-0 flex-grow flex-col md:flex-row">
        <Sidebar />

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-16">
          {/* Page header */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Automated Reports</h1>
                <p className="hidden text-xs text-slate-500 sm:block">
                  Email daily, weekly or monthly expense reports automatically — with a shareable link, PDF and Excel.
                </p>
              </div>
              <button
                onClick={() => setEditor({ mode: "create", data: structuredClone(NEW_SCHEDULE) })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <FiPlus className="h-4 w-4" /> <span>New schedule</span>
              </button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6">
            <SchedulerHealth scheduler={scheduler} env={env} activeCount={activeCount} onRefresh={refreshAll} />

            {/* Schedules */}
            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Schedules</h2>
                  <p className="text-xs text-slate-500">
                    {schedules.length === 0 ? "No schedules yet" : `${activeCount} active · ${schedules.length} total`}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2].map((i) => <div key={i} className="h-60 animate-pulse rounded-2xl bg-slate-200" />)}
                </div>
              ) : schedules.length === 0 ? (
                <EmptySchedules onCreate={() => setEditor({ mode: "create", data: structuredClone(NEW_SCHEDULE) })} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {schedules.map((s) => (
                    <ScheduleCard
                      key={s._id}
                      schedule={s}
                      sending={sendingId === s._id}
                      onToggle={() => toggleSchedule(s)}
                      onEdit={() => setEditor({ mode: "edit", data: structuredClone(s) })}
                      onDelete={() => deleteSchedule(s)}
                      onSend={() => sendNow(s)}
                    />
                  ))}
                </div>
              )}
            </section>

            <HistorySection
              history={history}
              total={historyTotal}
              page={historyPage}
              loading={historyLoading}
              onPage={fetchHistory}
            />
          </div>
        </main>
      </div>

      {editor && (
        <ScheduleEditor
          mode={editor.mode}
          initial={editor.data}
          users={users}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refreshAll();
          }}
          onTestSent={() => fetchHistory(1)}
        />
      )}
    </section>
  );
}

// ─── Scheduler health ─────────────────────────────────────────────────────────

function SchedulerHealth({ scheduler, env, activeCount, onRefresh }: {
  scheduler: SchedulerInfo | null;
  env: { emailConfigured: boolean; cronSecretConfigured: boolean; onVercel: boolean };
  activeCount: number;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const lastTick = scheduler?.lastTickAt ? DateTime.fromISO(scheduler.lastTickAt) : null;
  const minutesSince = lastTick ? -lastTick.diffNow("minutes").minutes : Infinity;
  const healthy = minutesSince <= 130;
  const sourceLabel: Record<string, string> = {
    "vercel-cron": "Vercel Cron",
    external: "external scheduler",
    "local-scheduler": "local scheduler",
    "queue-timer": "on-time delivery timer",
  };

  const problems: string[] = [];
  if (!env.emailConfigured) problems.push("Email is not configured — set EMAIL_USER and EMAIL_PASS (Gmail app password) in the server environment.");
  if (env.onVercel && !env.cronSecretConfigured) problems.push("CRON_SECRET is missing on Vercel — scheduled runs will be rejected. Add it under Project → Settings → Environment Variables.");
  if (activeCount > 0 && !healthy) {
    problems.push(
      lastTick
        ? `The scheduler last ran ${relative(scheduler!.lastTickAt)}. Reports are only sent while it runs.`
        : "The scheduler has not run yet. After deploying to Vercel it starts automatically; locally run “npm run scheduler”."
    );
  }

  const ok = problems.length === 0;
  return (
    <section className={`rounded-2xl p-4 ring-1 sm:p-5 ${ok ? "bg-white ring-slate-200" : "bg-amber-50 ring-amber-200"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ok ? "bg-green-50 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {ok ? <FiActivity className="h-5 w-5" /> : <FiAlertTriangle className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">
              {ok ? "Automatic delivery is running" : "Automatic delivery needs attention"}
            </h2>
            <button onClick={onRefresh} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-indigo-600">
              <FiRefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          {lastTick && (
            <p className="mt-0.5 text-xs text-slate-600">
              Last check {relative(scheduler!.lastTickAt)} via {sourceLabel[scheduler!.lastTickSource] || scheduler!.lastTickSource}
              {scheduler?.lastSentAt && <> · last email sent {relative(scheduler.lastSentAt)}</>}
            </p>
          )}
          {problems.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-900">
              {problems.map((p) => (
                <li key={p} className="flex gap-1.5"><span>•</span><span>{p}</span></li>
              ))}
            </ul>
          )}
          <button onClick={() => setOpen((o) => !o)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
            <FiInfo className="h-3.5 w-3.5" /> When exactly are emails sent?
            <FiChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="mt-2 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <p>
                Every report is sent <strong>once, at or after its scheduled time</strong>, and always covers the dates it promises — even if the check runs late.
              </p>
              <p>
                On Vercel each report’s next run is set as a timer that fires at the exact minute (e.g. 7:00 PM), so emails normally arrive within a minute of the scheduled time.
                An hourly check also runs as a safety net and sends anything a timer missed.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EmptySchedules({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <FiMail className="h-6 w-6" />
      </div>
      <h3 className="mt-3 text-base font-bold text-slate-900">Get expense reports by email</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        Choose who receives it and when. Each email has the day’s, week’s and month’s totals, a shareable link, PDF and Excel.
      </p>
      <button onClick={onCreate} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
        <FiPlus className="h-4 w-4" /> Create your first schedule
      </button>
    </div>
  );
}

// ─── Schedule card ────────────────────────────────────────────────────────────

function ScheduleCard({ schedule: s, sending, onToggle, onEdit, onDelete, onSend }: {
  schedule: Schedule;
  sending: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
}) {
  const zone = s.timezone || "Asia/Kolkata";
  const scope = SCOPES.find((x) => x.value === s.reportType)?.label || labelize(s.reportType);
  const coverage = s.coverage || "previous";
  const windows = s.nextRunAt ? getReportWindows(s.reportPeriod, coverage, new Date(s.nextRunAt), zone) : [];
  const failing = !!s.lastErrorMessage && (!s.lastSuccessAt || (s.lastFailedAt && s.lastFailedAt > s.lastSuccessAt));

  return (
    <article className={`flex flex-col rounded-2xl bg-white shadow-sm ring-1 transition ${s.enabled ? "ring-slate-200 hover:ring-indigo-200" : "ring-slate-200 opacity-75"}`}>
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-slate-900">{s.name}</h3>
            <p className="mt-0.5 text-xs font-medium text-indigo-700">
              {describeSchedule({ ...s, timezone: zone })} {zoneShort(zone)}
            </p>
          </div>
          <Switch checked={s.enabled} onChange={onToggle} label={s.enabled ? "Pause schedule" : "Turn on schedule"} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{scope}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{describeCoverage(s.reportPeriod, coverage)}</span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
          <FiMail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate" title={s.recipients.join(", ")}>
            {s.recipients.slice(0, 2).join(", ")}
            {s.recipients.length > 2 && <span className="text-slate-400"> +{s.recipients.length - 2} more</span>}
          </span>
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs">
          {s.enabled && s.nextRunAt ? (
            <>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <FiClock className="h-3.5 w-3.5 text-indigo-600" />
                Next: {inZone(s.nextRunAt, zone)} <span className="font-normal text-slate-500">({relative(s.nextRunAt)})</span>
              </div>
              {windows.length > 0 && (
                <div className="mt-1 text-slate-500">
                  Covers {windows.map((w) => `${w.label.toLowerCase()} (${w.rangeLabel})`).join(", ")}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1.5 font-medium text-slate-500">
              <FiClock className="h-3.5 w-3.5" /> Paused — no emails will be sent
            </div>
          )}
          {s.lastSuccessAt && !failing && (
            <div className="mt-1.5 flex items-center gap-1.5 text-slate-600">
              <FiCheckCircle className="h-3.5 w-3.5 text-green-600" /> Last sent {relative(s.lastSuccessAt)}
            </div>
          )}
        </div>

        {failing && (
          <div className="mt-2 flex gap-1.5 rounded-xl bg-red-50 p-3 text-xs text-red-800 ring-1 ring-red-100">
            <FiXCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>Last attempt failed</strong> {relative(s.lastFailedAt)}: {s.lastErrorMessage}
              {(s.consecutiveFailures || 0) > 0 && " — will retry automatically."}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5">
        <button
          onClick={onSend}
          disabled={sending}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
        >
          {sending ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiSend className="h-3.5 w-3.5" />}
          {sending ? "Sending…" : "Send now"}
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            <FiEdit2 className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={onDelete} aria-label="Delete schedule" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

function HistorySection({ history, total, page, loading, onPage }: {
  history: Execution[];
  total: number;
  page: number;
  loading: boolean;
  onPage: (p: number) => void;
}) {
  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Delivery history</h2>
          <p className="text-xs text-slate-500">Every report emailed, with its totals and links</p>
        </div>
        <button onClick={() => onPage(page)} disabled={loading} aria-label="Refresh history"
          className="rounded-xl p-2 text-slate-500 ring-1 ring-slate-200 hover:text-indigo-600">
          <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {history.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">{loading ? "Loading…" : "No reports have been sent yet."}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {history.map((h) => <HistoryRow key={h._id} item={h} />)}
        </ul>
      )}

      {total > 10 && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>Page {page} of {Math.ceil(total / 10)}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} className="rounded-lg px-3 py-1.5 font-semibold ring-1 ring-slate-200 disabled:opacity-40">Previous</button>
            <button disabled={page * 10 >= total || loading} onClick={() => onPage(page + 1)} className="rounded-lg px-3 py-1.5 font-semibold ring-1 ring-slate-200 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryRow({ item: h }: { item: Execution }) {
  const [copied, setCopied] = useState(false);
  const expired = !!h.shareExpiresAt && new Date(h.shareExpiresAt) < new Date();
  const ok = h.status === "success";
  const sections = h.sections?.length
    ? h.sections
    : ok ? [{ key: h.period, label: labelize(h.period), from: h.fromDate, to: h.toDate, total: h.totalAmount, count: h.recordCount }] : [];

  const copy = async () => {
    if (!h.shareUrl) return;
    await navigator.clipboard.writeText(h.shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <li className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
      <div className="flex min-w-0 items-start gap-3 md:w-64 md:shrink-0">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {ok ? <FiCheck className="h-4 w-4" /> : <FiXCircle className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {DateTime.fromISO(h.executedAt).toFormat("d LLL yyyy, h:mm a")}
          </div>
          <div className="text-xs text-slate-500">
            {TRIGGER_LABEL[h.triggeredBy] || h.triggeredBy} · {h.recipients?.length || 0} recipient{h.recipients?.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 text-xs">
        {ok ? (
          <div className="flex flex-wrap gap-1.5">
            {sections.map((s) => (
              <span key={s.key + s.from} className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700 ring-1 ring-slate-100">
                <span className="font-semibold">{s.label}</span> {fmtINR(s.total)} <span className="text-slate-400">· {s.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-red-700">{h.errorMessage || "Failed"}</p>
        )}
      </div>

      {ok && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {h.shareUrl && !expired ? (
            <>
              <a href={h.shareUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                <FiExternalLink className="h-3.5 w-3.5" /> Open
              </a>
              <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                {copied ? <FiCheck className="h-3.5 w-3.5 text-green-600" /> : <FiCopy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Link"}
              </button>
            </>
          ) : h.shareUrl ? (
            <span className="text-xs text-slate-400">Link expired</span>
          ) : null}
          {h.pdfUrls?.[0] && (
            <a href={h.pdfUrls[0]} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
              <FiFileText className="h-3.5 w-3.5" /> PDF
            </a>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-slate-700">{label}</div>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={`grid gap-1 rounded-xl bg-slate-100 p-1`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-lg px-2 py-2 text-center text-xs font-semibold transition sm:text-sm ${value === o.value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
        >
          {o.label}
          {o.hint && <span className="block text-[10px] font-normal text-slate-500">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${active ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}

function toggleIn<T>(list: T[] | undefined, v: T): T[] {
  const l = list || [];
  return l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
}

function ScheduleEditor({ mode, initial, users, onClose, onSaved, onTestSent }: {
  mode: "create" | "edit";
  initial: Schedule;
  users: UserItem[];
  onClose: () => void;
  onSaved: () => void;
  onTestSent: () => void;
}) {
  const [form, setForm] = useState<Schedule>({
    ...initial,
    dayOfWeek: initial.dayOfWeek || 1,
    dayOfMonth: initial.dayOfMonth || 1,
    coverage: initial.coverage || "previous",
    linkTtlHours: initial.linkTtlHours || 168,
    attachFiles: initial.attachFiles !== false,
    filters: { userIds: [], expenseSources: [], categories: [], statuses: [], ...initial.filters },
  });
  const [emailInput, setEmailInput] = useState("");
  const [testEmail, setTestEmail] = useState(initial.recipients[0] || "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showFilters, setShowFilters] = useState(
    !!(initial.filters?.userIds?.length || initial.filters?.categories?.length || initial.filters?.expenseSources?.length)
  );
  const [userQuery, setUserQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Schedule>(key: K, value: Schedule[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setFilter = <K extends keyof ScheduleFilters>(key: K, value: ScheduleFilters[K]) =>
    setForm((f) => ({ ...f, filters: { ...f.filters, [key]: value } }));

  const preview = useMemo(() => {
    const timing = { frequency: form.frequency, time: form.time, timezone: form.timezone, dayOfWeek: form.dayOfWeek, dayOfMonth: form.dayOfMonth };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) return null;
    const next = computeNextRun(timing);
    return {
      when: DateTime.fromJSDate(next).setZone(form.timezone).toFormat("cccc, d LLLL yyyy 'at' h:mm a"),
      rel: DateTime.fromJSDate(next).toRelative(),
      windows: getReportWindows(form.reportPeriod, form.coverage || "current", next, form.timezone),
      describe: describeSchedule(timing),
    };
  }, [form.frequency, form.time, form.timezone, form.dayOfWeek, form.dayOfMonth, form.reportPeriod, form.coverage]);

  const addEmails = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return;
    const bad = parts.filter((p) => !EMAIL_RE.test(p));
    const good = parts.filter((p) => EMAIL_RE.test(p) && !form.recipients.includes(p));
    if (good.length) set("recipients", [...form.recipients, ...good]);
    if (!testEmail && good[0]) setTestEmail(good[0]);
    if (bad.length) {
      toast.error(`Not a valid email: ${bad.join(", ")}`);
      setEmailInput(bad.join(", "));
    } else {
      setEmailInput("");
    }
  };

  const payload = () => {
    const pending = emailInput.trim();
    const recipients = [...form.recipients];
    if (pending && EMAIL_RE.test(pending.toLowerCase()) && !recipients.includes(pending.toLowerCase())) recipients.push(pending.toLowerCase());
    return { ...form, recipients };
  };

  const save = async () => {
    const body = payload();
    if (!body.name.trim()) return toast.error("Give the schedule a name");
    if (body.recipients.length === 0) return toast.error("Add at least one recipient email");
    setSaving(true);
    try {
      const res = await fetch("/api/settings/scheduled-reports", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.type !== "SUCCESS") throw new Error(json.message);
      toast.success(mode === "create" ? "Schedule created" : "Schedule saved");
      onSaved();
    } catch (err) {
      toast.error((err as Error).message || "Could not save the schedule");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    const to = testEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(to)) return toast.error("Enter a valid email for the test");
    setTesting(true);
    try {
      const res = await fetch("/api/settings/scheduled-reports/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: payload(), recipients: [to] }),
      });
      const json = await res.json();
      if (json.type !== "SUCCESS") throw new Error(json.message);
      toast.success(`Test report sent to ${to}`);
      onTestSent();
    } catch (err) {
      toast.error((err as Error).message || "Test email failed");
    } finally {
      setTesting(false);
    }
  };

  const filteredUsers = users.filter((u) => u.name?.toLowerCase().includes(userQuery.toLowerCase()));
  const statuses = form.filters?.statuses || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "New report schedule" : "Edit report schedule"}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">{mode === "create" ? "New report schedule" : "Edit schedule"}</h3>
            <p className="text-xs text-slate-500">Who gets the report, when, and what it covers</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Daily Cash Expense Report"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </Field>

          {/* Recipients */}
          <Field label="Send to" hint="Type or paste emails — separate several with commas. Press Enter to add.">
            <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
              {form.recipients.map((email) => (
                <span key={email} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-indigo-800">
                  {email}
                  <button type="button" aria-label={`Remove ${email}`} onClick={() => set("recipients", form.recipients.filter((e) => e !== email))}
                    className="rounded-full p-0.5 hover:bg-indigo-100">
                    <FiX className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="email"
                inputMode="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (["Enter", ",", " ", "Tab"].includes(e.key) && emailInput.trim()) {
                    e.preventDefault();
                    addEmails(emailInput);
                  } else if (e.key === "Backspace" && !emailInput && form.recipients.length) {
                    set("recipients", form.recipients.slice(0, -1));
                  }
                }}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  if (/[,;\s]/.test(text.trim())) {
                    e.preventDefault();
                    addEmails(text);
                  }
                }}
                onBlur={() => emailInput.trim() && addEmails(emailInput)}
                placeholder={form.recipients.length ? "Add another…" : "name@company.com"}
                className="min-w-[160px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
              />
            </div>
          </Field>

          {/* When */}
          <div className="space-y-3">
            <div className="text-sm font-bold text-slate-900">When</div>
            <Segmented
              value={form.frequency}
              onChange={(v) => setForm((f) => ({ ...f, frequency: v, reportPeriod: f.reportPeriod === "all" ? "all" : v }))}
              options={[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            {form.frequency === "weekly" && (
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <ChipToggle key={d.value} active={form.dayOfWeek === d.value} onClick={() => set("dayOfWeek", d.value)}>
                    {d.label.slice(0, 3)}
                  </ChipToggle>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {form.frequency === "monthly" && (
                <Field label="Day of month">
                  <select value={form.dayOfMonth} onChange={(e) => set("dayOfMonth", Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                    <option value={31}>Last day</option>
                  </select>
                </Field>
              )}
              <Field label="Time">
                <input type="time" value={form.time} onChange={(e) => set("time", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </Field>
              <Field label="Time zone">
                <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* What */}
          <div className="space-y-3">
            <div className="text-sm font-bold text-slate-900">What the email contains</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CONTENT_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => set("reportPeriod", o.value)} aria-pressed={form.reportPeriod === o.value}
                  className={`rounded-xl p-3 text-left ring-1 transition ${form.reportPeriod === o.value ? "bg-indigo-50 ring-2 ring-indigo-500" : "ring-slate-200 hover:bg-slate-50"}`}>
                  <div className="text-xs font-bold text-slate-900">{o.label}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{o.hint}</div>
                </button>
              ))}
            </div>
            <Field label="Which period">
              <Segmented
                value={form.coverage || "current"}
                onChange={(v) => set("coverage", v)}
                options={[
                  { value: "current", label: "Up to send time", hint: form.reportPeriod === "weekly" ? "This week so far" : form.reportPeriod === "monthly" ? "This month so far" : "Today so far" },
                  { value: "previous", label: "Last complete period", hint: form.reportPeriod === "weekly" ? "Last week" : form.reportPeriod === "monthly" ? "Last month" : "Yesterday" },
                ]}
              />
            </Field>
            <Field label="Data">
              <select value={form.reportType} onChange={(e) => set("reportType", e.target.value as ReportType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.hint}</option>)}
              </select>
            </Field>
            <Field label="Include claims that are">
              <div className="flex flex-wrap gap-1.5">
                {(["approved", "pending", "rejected"] as const).map((st) => (
                  <ChipToggle key={st} active={statuses.length === 0 || statuses.includes(st)}
                    onClick={() => setFilter("statuses", toggleIn(statuses.length === 0 ? ["approved", "pending", "rejected"] : statuses, st) as ScheduleFilters["statuses"])}>
                    {labelize(st)}
                  </ChipToggle>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Rejected claims are always shown separately and never added to the total.</p>
            </Field>
          </div>

          {/* Advanced filters */}
          <div className="rounded-2xl ring-1 ring-slate-200">
            <button type="button" onClick={() => setShowFilters((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FiFilter className="h-4 w-4 text-indigo-600" /> Only include some employees or categories
              </span>
              <FiChevronDown className={`h-4 w-4 text-slate-500 transition ${showFilters ? "rotate-180" : ""}`} />
            </button>
            {showFilters && (
              <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                {["expense", "combined"].includes(form.reportType) && (
                  <Field label="Expense types" hint="None selected = all">
                    <div className="flex flex-wrap gap-1.5">
                      {(["office", "travel", "toPay"] as const).map((src) => (
                        <ChipToggle key={src} active={!!form.filters?.expenseSources?.includes(src)}
                          onClick={() => setFilter("expenseSources", toggleIn(form.filters?.expenseSources, src))}>
                          {labelize(src)}
                        </ChipToggle>
                      ))}
                    </div>
                  </Field>
                )}
                <Field label={`Employees (${form.filters?.userIds?.length || 0} selected)`} hint="None selected = everyone">
                  {users.length > 8 && (
                    <input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search employees…"
                      className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  )}
                  <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                    {filteredUsers.map((u) => (
                      <ChipToggle key={u._id} active={!!form.filters?.userIds?.includes(u._id)}
                        onClick={() => setFilter("userIds", toggleIn(form.filters?.userIds, u._id))}>
                        {u.name}
                      </ChipToggle>
                    ))}
                    {users.length === 0 && <span className="text-xs text-slate-400">Employee list unavailable</span>}
                  </div>
                </Field>
                <Field label={`Categories (${form.filters?.categories?.length || 0} selected)`} hint="None selected = all categories">
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((c) => (
                      <ChipToggle key={c} active={!!form.filters?.categories?.includes(c)}
                        onClick={() => setFilter("categories", toggleIn(form.filters?.categories, c))}>
                        {labelize(c)}
                      </ChipToggle>
                    ))}
                  </div>
                </Field>
              </div>
            )}
          </div>

          {/* Delivery options */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Report link works for" hint="After this the emailed link and download buttons stop working">
              <select value={form.linkTtlHours} onChange={(e) => set("linkTtlHours", Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                {LINK_TTLS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>Attach PDF &amp; Excel files</span>
                <Switch checked={form.attachFiles !== false} onChange={() => set("attachFiles", !(form.attachFiles !== false))} label="Attach files" />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>Schedule is active</span>
                <Switch checked={form.enabled} onChange={() => set("enabled", !form.enabled)} label="Active" />
              </label>
            </div>
          </div>

          {/* Live preview */}
          {preview && (
            <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-indigo-700">
                <FiCalendar className="h-4 w-4" /> {form.enabled ? "Next email" : "Next email (when turned on)"}
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {preview.when} <span className="font-normal text-slate-500">({preview.rel})</span>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {preview.windows.map((w) => (
                  <li key={w.key} className="flex items-center gap-1.5">
                    <FiCheck className="h-3.5 w-3.5 text-indigo-600" />
                    <strong>{w.label}</strong> — {w.rangeLabel}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                Then {preview.describe.charAt(0).toLowerCase() + preview.describe.slice(1)} to {form.recipients.length || "no"} recipient{form.recipients.length === 1 ? "" : "s"}.
              </p>
            </div>
          )}

          {/* Test */}
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FiUsers className="h-4 w-4 text-slate-500" /> Try it first
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Send this report (as configured above) to one address, without saving.</p>
            <div className="mt-2 flex gap-2">
              <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@company.com"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
              <button type="button" onClick={sendTest} disabled={testing}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50 disabled:opacity-50">
                {testing ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiSend className="h-4 w-4" />}
                {testing ? "Sending…" : "Send test"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
          <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 sm:flex-none sm:px-6">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:ml-auto sm:flex-none sm:px-6">
            {saving ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiCheck className="h-4 w-4" />}
            {mode === "create" ? "Create schedule" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
