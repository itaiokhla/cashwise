"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@app/_components/Sidebar";
import Loader from "@app/_components/Loader";
import { toast } from "react-toastify";
import {
  FiSettings,
  FiMail,
  FiClock,
  FiCalendar,
  FiGlobe,
  FiSend,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiExternalLink,
  FiFileText,
  FiInfo,
  FiEdit2,
  FiFilter,
  FiUsers,
  FiLayers,
  FiX,
  FiTag,
} from "react-icons/fi";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface IScheduledReportFilters {
  userIds?: string[];
  expenseSources?: ("office" | "travel" | "toPay")[];
  categories?: string[];
  statuses?: ("pending" | "approved" | "rejected")[];
  includeCredit?: boolean;
  includeDebit?: boolean;
  visibleFields?: string[];
  search?: string;
}

export interface IScheduledReportData {
  _id?: string;
  name: string;
  reportType: "expense" | "credit" | "debit" | "combined" | "office" | "travel" | "toPay" | "all";
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  timezone: string;
  recipients: string[];
  reportPeriod: "daily" | "weekly" | "monthly" | "all";
  enabled: boolean;
  filters?: IScheduledReportFilters;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  lastFailedAt?: string | null;
  lastErrorMessage?: string | null;
  nextRunAt?: string | null;
  createdAt?: string;
}

interface IExecutionHistory {
  _id: string;
  scheduleId?: string;
  executionKey: string;
  reportType: string;
  period: string;
  fromDate: string;
  toDate: string;
  recipients: string[];
  recipientCount: number;
  recordCount: number;
  totalAmount: number;
  status: "success" | "failed";
  errorMessage?: string | null;
  pdfUrls: string[];
  shareUrl?: string | null;
  shareExpiresAt?: string | null;
  durationMs: number;
  executedAt: string;
  triggeredBy: "cron" | "manual_test" | "scheduler" | "manual_generate";
}

interface IUserItem {
  _id: string;
  name: string;
  email?: string;
  role?: string;
  type?: string;
}

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST - UTC+05:30)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST - UTC+04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT - UTC+08:00)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST - UTC+10:00)" },
];

const DEFAULT_SCHEDULE: IScheduledReportData = {
  name: "Daily Executive Expense Report",
  reportType: "expense",
  frequency: "daily",
  time: "19:00",
  timezone: "Asia/Kolkata",
  recipients: ["itofficepulse@gmail.com"],
  reportPeriod: "all",
  enabled: true,
  filters: {
    userIds: [],
    expenseSources: ["office", "travel", "toPay"],
    categories: [],
    statuses: ["approved", "pending"],
    includeCredit: true,
    includeDebit: true,
  },
};

const EXPENSE_CATEGORIES = [
  "conveyance",
  "purchase",
  "food",
  "tea",
  "hotel",
  "labour",
  "courier",
  "loading",
  "porter",
  "rider",
  "maintenance",
  "other",
  "transport",
  "cartage",
  "dailyWages",
];

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<IScheduledReportData[]>([]);
  const [usersList, setUsersList] = useState<IUserItem[]>([]);
  const [history, setHistory] = useState<IExecutionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<IScheduledReportData>(DEFAULT_SCHEDULE);
  const [modalSaving, setModalSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [runningTestId, setRunningTestId] = useState<string | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/scheduled-reports");
      const json = await res.json();
      if (json.type === "SUCCESS" && Array.isArray(json.data)) {
        setSchedules(json.data);
      }
    } catch (err) {
      console.error("Failed to load scheduled reports:", err);
      toast.error("Failed to load report schedules");
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (Array.isArray(json)) {
        setUsersList(json);
      } else if (json?.data && Array.isArray(json.data)) {
        setUsersList(json.data);
      }
    } catch (err) {
      console.error("Failed to load users for filter:", err);
    }
  }, []);

  const fetchHistory = useCallback(async (page = 1) => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`/api/settings/scheduled-reports/history?page=${page}&limit=10`);
      const json = await res.json();
      if (json.type === "SUCCESS" && json.data) {
        setHistory(json.data.executions || []);
        setHistoryTotal(json.data.total || 0);
        setHistoryPage(json.data.page || 1);
      }
    } catch (err) {
      console.error("Failed to load history:", err);
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

  // ─── Actions ────────────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setModalMode("create");
    setFormData({
      ...DEFAULT_SCHEDULE,
      filters: {
        userIds: [],
        expenseSources: ["office", "travel", "toPay"],
        categories: [],
        statuses: ["approved", "pending"],
        includeCredit: true,
        includeDebit: true,
      },
    });
    setNewEmail("");
    setIsModalOpen(true);
  };

  const openEditModal = (sch: IScheduledReportData) => {
    setModalMode("edit");
    setFormData({
      ...sch,
      name: sch.name || "Automated Report",
      filters: {
        userIds: sch.filters?.userIds || [],
        expenseSources: sch.filters?.expenseSources || ["office", "travel", "toPay"],
        categories: sch.filters?.categories || [],
        statuses: sch.filters?.statuses || ["approved", "pending"],
        includeCredit: sch.filters?.includeCredit !== false,
        includeDebit: sch.filters?.includeDebit !== false,
      },
    });
    setNewEmail("");
    setIsModalOpen(true);
  };

  const handleToggleSchedule = async (sch: IScheduledReportData) => {
    if (!sch._id) return;
    const newEnabled = !sch.enabled;
    try {
      const res = await fetch("/api/settings/scheduled-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sch, enabled: newEnabled }),
      });
      const json = await res.json();
      if (json.type === "SUCCESS") {
        setSchedules((prev) =>
          prev.map((s) => (s._id === sch._id ? { ...s, enabled: newEnabled } : s))
        );
        toast.success(`Schedule ${newEnabled ? "activated" : "paused"}`);
      } else {
        toast.error(json.message || "Failed to update schedule status");
      }
    } catch {
      toast.error("Network error updating schedule");
    }
  };

  const handleDeleteSchedule = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/settings/scheduled-reports?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.type === "SUCCESS") {
        setSchedules((prev) => prev.filter((s) => s._id !== id));
        toast.success("Schedule deleted successfully");
      } else {
        toast.error(json.message || "Failed to delete schedule");
      }
    } catch {
      toast.error("Network error deleting schedule");
    }
  };

  const handleRunNow = async (sch: IScheduledReportData) => {
    if (!sch._id) return;
    try {
      setRunningTestId(sch._id);
      const res = await fetch("/api/settings/scheduled-reports/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: sch._id,
          reportType: sch.reportType,
          period: sch.reportPeriod,
          timezone: sch.timezone,
          recipients: sch.recipients,
          filters: sch.filters,
        }),
      });
      const json = await res.json();
      if (json.type === "SUCCESS") {
        toast.success(
          `Report generated & sent! ${json.data?.recordCount ?? 0} records dispatched to ${sch.recipients.length} recipients.`
        );
        fetchHistory(1);
        fetchSchedules();
      } else {
        toast.error(json.message || "Failed to generate test report");
      }
    } catch {
      toast.error("Network error running test report");
    } finally {
      setRunningTestId(null);
    }
  };

  const handleSaveModal = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a schedule name");
      return;
    }
    if (formData.recipients.length === 0) {
      toast.error("Please add at least one recipient email");
      return;
    }

    try {
      setModalSaving(true);
      const method = modalMode === "create" ? "POST" : "PUT";
      const res = await fetch("/api/settings/scheduled-reports", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (json.type === "SUCCESS") {
        toast.success(
          modalMode === "create"
            ? "Automated report schedule created!"
            : "Schedule updated successfully!"
        );
        setIsModalOpen(false);
        fetchSchedules();
      } else {
        toast.error(json.message || "Failed to save schedule");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while saving schedule");
    } finally {
      setModalSaving(false);
    }
  };

  // Recipient Tag Handlers
  const handleAddEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed) return;
    if (!emailRegex.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (formData.recipients.includes(trimmed)) {
      toast.warning("Email already added");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      recipients: [...prev.recipients, trimmed],
    }));
    setNewEmail("");
  };

  const handleRemoveEmail = (email: string) => {
    setFormData((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((e) => e !== email),
    }));
  };

  // Filter Toggle Handlers
  const toggleSourceFilter = (source: "office" | "travel" | "toPay") => {
    setFormData((prev) => {
      const current = prev.filters?.expenseSources || [];
      const updated = current.includes(source)
        ? current.filter((s) => s !== source)
        : [...current, source];
      return {
        ...prev,
        filters: { ...prev.filters, expenseSources: updated },
      };
    });
  };

  const toggleStatusFilter = (status: "pending" | "approved" | "rejected") => {
    setFormData((prev) => {
      const current = prev.filters?.statuses || [];
      const updated = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status];
      return {
        ...prev,
        filters: { ...prev.filters, statuses: updated },
      };
    });
  };

  const toggleUserFilter = (userId: string) => {
    setFormData((prev) => {
      const current = prev.filters?.userIds || [];
      const updated = current.includes(userId)
        ? current.filter((u) => u !== userId)
        : [...current, userId];
      return {
        ...prev,
        filters: { ...prev.filters, userIds: updated },
      };
    });
  };

  const toggleCategoryFilter = (cat: string) => {
    setFormData((prev) => {
      const current = prev.filters?.categories || [];
      const updated = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      return {
        ...prev,
        filters: { ...prev.filters, categories: updated },
      };
    });
  };

  const copyCronUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/api/cron/expense-reports`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.info("Cron webhook URL copied to clipboard");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <section className="flex flex-col bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row flex-grow min-h-0">
        <Sidebar />

        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {loading && <Loader />}

          {/* Top Page Header */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                  <FiSettings className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 leading-tight">
                    Automated Reporting System
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure automated scheduled reports, email dispatches, and 24-hour secure shareable links.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={openCreateModal}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-200 transition-all"
                >
                  <FiPlus className="w-4 h-4" />
                  Create New Schedule
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
            {/* Executive Status Banner */}
            <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      {schedules.filter((s) => s.enabled).length} Active Schedule(s)
                    </span>
                    <span className="text-xs text-slate-300">
                      Total Configured: <strong className="text-white">{schedules.length}</strong>
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold tracking-tight">
                    Scheduled Expense Reporting Engine
                  </h2>
                  <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
                    Automatically compiles travel, office, and vendor payments, generates executive PDF summaries,
                    uploads snapshots, and sends emails with 24-hour secure read-only web report links.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-xs shrink-0">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                    <div className="text-slate-400 text-[10px] uppercase font-semibold">Cron Endpoint</div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-purple-300 font-mono text-[11px]">/api/cron/expense-reports</code>
                      <button
                        onClick={copyCronUrl}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Copy Cron URL"
                      >
                        {copiedUrl ? <FiCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FiCopy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Configured Schedules Section */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FiCalendar className="w-4 h-4 text-purple-600" />
                    Configured Report Schedules
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manage automated schedules, recipient lists, and target expense categories
                  </p>
                </div>
                <button
                  onClick={openCreateModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                >
                  <FiPlus className="w-3.5 h-3.5" /> Add Schedule
                </button>
              </div>

              {schedules.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3 text-xl">
                    ⏱️
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No Scheduled Reports Configured</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Create your first automated report schedule to deliver daily or weekly executive summaries automatically.
                  </p>
                  <button
                    onClick={openCreateModal}
                    className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                  >
                    + Create First Schedule
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {schedules.map((sch) => {
                    const isRunning = runningTestId === sch._id;
                    return (
                      <div
                        key={sch._id}
                        className={`rounded-xl border p-5 transition-all flex flex-col justify-between ${
                          sch.enabled
                            ? "bg-white border-slate-200 hover:border-purple-300 shadow-sm"
                            : "bg-slate-50/70 border-slate-200 opacity-75"
                        }`}
                      >
                        <div>
                          {/* Schedule Card Header */}
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                {sch.name || "Automated Report"}
                              </h3>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
                                  {sch.frequency} · {sch.time}
                                </span>
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                                  {sch.reportType}
                                </span>
                              </div>
                            </div>

                            {/* Active switch */}
                            <button
                              type="button"
                              onClick={() => handleToggleSchedule(sch)}
                              title={sch.enabled ? "Disable schedule" : "Enable schedule"}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                sch.enabled ? "bg-purple-600" : "bg-slate-300"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  sch.enabled ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>

                          {/* Details */}
                          <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <FiGlobe className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{sch.timezone}</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[11px]">
                              <FiMail className="w-3 h-3 text-slate-400" />
                              <span className="truncate">
                                {sch.recipients.length} Recipient{sch.recipients.length !== 1 ? "s" : ""} (
                                {sch.recipients[0]}
                                {sch.recipients.length > 1 ? `, +${sch.recipients.length - 1}` : ""})
                              </span>
                            </div>

                            {/* Filters summary */}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <FiFilter className="w-3 h-3 text-slate-400" />
                              <span>
                                {sch.filters?.userIds && sch.filters.userIds.length > 0
                                  ? `${sch.filters.userIds.length} users`
                                  : "All users"}
                                {" · "}
                                {sch.filters?.expenseSources && sch.filters.expenseSources.length > 0
                                  ? sch.filters.expenseSources.join(", ")
                                  : "All sources"}
                              </span>
                            </div>

                            {/* Run info */}
                            <div className="text-[10px] text-slate-400 pt-1">
                              {sch.nextRunAt && sch.enabled ? (
                                <span>
                                  Next run:{" "}
                                  <strong className="text-slate-700">
                                    {new Date(sch.nextRunAt).toLocaleString("en-IN", {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })}
                                  </strong>
                                </span>
                              ) : (
                                <span>Status: {sch.enabled ? "Active" : "Paused"}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => handleRunNow(sch)}
                            disabled={isRunning}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 transition-colors disabled:opacity-50"
                            title="Generate and send report immediately"
                          >
                            <FiSend className={`w-3 h-3 ${isRunning ? "animate-spin" : ""}`} />
                            {isRunning ? "Sending..." : "Send Now"}
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(sch)}
                              className="p-1.5 text-slate-500 hover:text-purple-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Edit schedule configuration"
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => sch._id && handleDeleteSchedule(sch._id, sch.name || "this schedule")}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete schedule"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Execution History Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Recent Report Execution History</h3>
                  <p className="text-xs text-slate-500">
                    Audit log of cron triggers, manual dispatches, PDF uploads, and 24-hour shareable links
                  </p>
                </div>
                <button
                  onClick={() => fetchHistory(historyPage)}
                  disabled={historyLoading}
                  className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 hover:text-purple-600 transition-all"
                  title="Refresh History"
                >
                  <FiRefreshCw className={`w-4 h-4 ${historyLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Timestamp</th>
                      <th className="px-6 py-3">Trigger</th>
                      <th className="px-6 py-3">Scope / Period</th>
                      <th className="px-6 py-3">Recipients</th>
                      <th className="px-6 py-3">Records & Total</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Share Link & PDFs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                          {historyLoading ? "Loading execution logs..." : "No execution history recorded yet."}
                        </td>
                      </tr>
                    ) : (
                      history.map((row) => {
                        const isExpired =
                          row.shareExpiresAt && new Date(row.shareExpiresAt) < new Date();

                        return (
                          <tr key={row._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-900 whitespace-nowrap">
                              {new Date(row.executedAt).toLocaleString("en-IN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  row.triggeredBy === "cron"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : row.triggeredBy === "manual_test"
                                    ? "bg-purple-50 text-purple-700 border border-purple-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {row.triggeredBy}
                              </span>
                            </td>
                            <td className="px-6 py-3 capitalize whitespace-nowrap">
                              <span className="font-semibold">{row.reportType}</span> ({row.period})
                            </td>
                            <td className="px-6 py-3">
                              <div className="max-w-[180px] truncate" title={row.recipients?.join(", ")}>
                                {row.recipients?.join(", ") || "—"}
                              </div>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap font-medium">
                              {row.recordCount} records (₹{row.totalAmount?.toLocaleString("en-IN")})
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              {row.status === "success" ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                                  <FiCheckCircle className="w-3.5 h-3.5" /> Success
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-red-600 font-semibold cursor-help"
                                  title={row.errorMessage || "Failed"}
                                >
                                  <FiXCircle className="w-3.5 h-3.5" /> Failed
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {/* Shared Report Link */}
                                {row.shareUrl ? (
                                  <a
                                    href={row.shareUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium text-[11px] border transition-colors ${
                                      isExpired
                                        ? "bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-600"
                                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                                    }`}
                                    title={isExpired ? "Share link expired (24h limit)" : "Open public 24-hour shared dashboard"}
                                  >
                                    <FiExternalLink className="w-3 h-3" />
                                    {isExpired ? "Report (Expired)" : "View Web Report"}
                                  </a>
                                ) : null}

                                {/* PDF Download */}
                                {row.pdfUrls && row.pdfUrls.length > 0 && (
                                  <a
                                    href={row.pdfUrls[0]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-medium text-[11px]"
                                    title="Download PDF"
                                  >
                                    <FiFileText className="w-3 h-3" /> PDF
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* History Pagination */}
              {historyTotal > 10 && (
                <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing {history.length} of {historyTotal} runs
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={historyPage <= 1}
                      onClick={() => fetchHistory(historyPage - 1)}
                      className="px-2.5 py-1 border rounded hover:bg-slate-50 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      disabled={historyPage * 10 >= historyTotal}
                      onClick={() => fetchHistory(historyPage + 1)}
                      className="px-2.5 py-1 border rounded hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ─── Schedule Builder Modal ─────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {modalMode === "create" ? "Create Automated Report Schedule" : "Edit Report Schedule"}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure dispatch timing, target recipients, and specific data filters
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Schedule Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Schedule Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Daily Operations Expense Summary"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              {/* Timing Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Frequency */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e: any) => setFormData((p) => ({ ...p, frequency: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly (Monday)</option>
                    <option value="monthly">Monthly (1st)</option>
                  </select>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Time (24h)
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData((p) => ({ ...p, time: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
                  />
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Timezone
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData((p) => ({ ...p, timezone: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scope & Period */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Report Scope
                  </label>
                  <select
                    value={formData.reportType}
                    onChange={(e: any) => setFormData((p) => ({ ...p, reportType: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="expense">All Expense Types (Consolidated)</option>
                    <option value="combined">Combined (Expense + Credit + Debit)</option>
                    <option value="office">Office Expenses Only</option>
                    <option value="travel">Travel Expenses Only</option>
                    <option value="toPay">Vendor Payments (To Pay) Only</option>
                    <option value="credit">Credits Only</option>
                    <option value="debit">Debits Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Period Bundling
                  </label>
                  <select
                    value={formData.reportPeriod}
                    onChange={(e: any) => setFormData((p) => ({ ...p, reportPeriod: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="all">Consolidated (Daily + Weekly + Monthly)</option>
                    <option value="daily">Daily Period Only</option>
                    <option value="weekly">Weekly Period Only</option>
                    <option value="monthly">Monthly Period Only</option>
                  </select>
                </div>
              </div>

              {/* Recipient Emails */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Recipients *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    placeholder="e.g. director@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddEmail();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>

                {/* Email tags */}
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200 min-h-[36px]">
                  {formData.recipients.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No recipients added yet</span>
                  ) : (
                    formData.recipients.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <FiX className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Advanced Filters Accordion / Box */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FiFilter className="w-3.5 h-3.5 text-purple-600" />
                    Advanced Report Filters (Optional)
                  </h4>
                  <span className="text-[11px] text-slate-400">Leave unselected to include all</span>
                </div>

                {/* Expense Sources Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                    Expense Sources
                  </label>
                  <div className="flex gap-2">
                    {(["office", "travel", "toPay"] as const).map((source) => {
                      const selected = formData.filters?.expenseSources?.includes(source);
                      return (
                        <button
                          key={source}
                          type="button"
                          onClick={() => toggleSourceFilter(source)}
                          className={`px-3 py-1 text-xs rounded-lg font-medium border capitalize transition-all ${
                            selected
                              ? "bg-purple-100 text-purple-800 border-purple-300"
                              : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          {source === "toPay" ? "To Pay (Vendors)" : source}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Statuses Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                    Approval Statuses
                  </label>
                  <div className="flex gap-2">
                    {(["approved", "pending", "rejected"] as const).map((status) => {
                      const selected = formData.filters?.statuses?.includes(status);
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => toggleStatusFilter(status)}
                          className={`px-3 py-1 text-xs rounded-lg font-medium border capitalize transition-all ${
                            selected
                              ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                              : "bg-white text-slate-600 border-slate-200"
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Users Filter */}
                {usersList.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                      Specific Users ({formData.filters?.userIds?.length || 0} selected)
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                      {usersList.map((u) => {
                        const selected = formData.filters?.userIds?.includes(u._id);
                        return (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => toggleUserFilter(u._id)}
                            className={`px-2.5 py-0.5 rounded text-[11px] font-medium border transition-all ${
                              selected
                                ? "bg-purple-600 text-white border-purple-600"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {u.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Specific Categories Filter */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                    Categories ({formData.filters?.categories?.length || 0} selected)
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                    {EXPENSE_CATEGORIES.map((cat) => {
                      const selected = formData.filters?.categories?.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategoryFilter(cat)}
                          className={`px-2 py-0.5 rounded text-[10px] capitalize font-medium border transition-all ${
                            selected
                              ? "bg-purple-100 text-purple-700 border-purple-300"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-slate-700">Activate schedule immediately</span>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, enabled: !p.enabled }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.enabled ? "bg-purple-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={modalSaving}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-200 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {modalSaving ? (
                  <>
                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Saving Schedule...
                  </>
                ) : (
                  <>
                    <FiCheck className="w-3.5 h-3.5" />
                    {modalMode === "create" ? "Create Schedule" : "Save Changes"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
