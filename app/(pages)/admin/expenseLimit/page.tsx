"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@app/_components/Sidebar";
import Loader from "@app/_components/Loader";
import ExpenseLimitForm from "@app/_components/expenseLimit/ExpenseLimitForm";
import { toast } from "react-toastify";
import {
  ExpenseLimitRecord,
  useGetExpenseLimitsQuery,
  useUpdateExpenseLimitMutation,
} from "@app/_api_query/expenselimit.api";
import { useAppSelector } from "@redux/redux.hooks";
import { selectUser } from "@redux/users/userSlice";
import {
  FiEdit2, FiCheck, FiX, FiChevronUp, FiChevronDown,
  FiSearch, FiFilter, FiRefreshCw, FiChevronLeft, FiChevronRight,
  FiUsers, FiChevronDown as FiExpand,
} from "react-icons/fi";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const ALL_FIELDS: { key: keyof ExpenseLimitRecord; label: string; icon: string }[] = [
  { key: "conveyance",  label: "Conveyance",  icon: "🚗" },
  { key: "purchase",    label: "Purchase",    icon: "🛍️" },
  { key: "food",        label: "Food",        icon: "🍽️" },
  { key: "tea",         label: "Tea",         icon: "☕" },
  { key: "hotel",       label: "Hotel",       icon: "🏨" },
  { key: "labour",      label: "Labour",      icon: "👷" },
  { key: "courier",     label: "Courier",     icon: "📦" },
  { key: "loading",     label: "Loading",     icon: "📤" },
  { key: "porter",      label: "Porter",      icon: "🧳" },
  { key: "cartage",     label: "Cartage",     icon: "🚚" },
  { key: "rider",       label: "Rider",       icon: "🏍️" },
  { key: "daily_wages", label: "Daily Wages", icon: "💼" },
  { key: "transport",   label: "Transport",   icon: "🚌" },
  { key: "maintenance", label: "Maintenance", icon: "🔧" },
  { key: "contractor",  label: "Contractor",  icon: "🏗️" },
  { key: "other",       label: "Other",       icon: "📋" },
];

const STATUS_OPTIONS = ["Active", "In-Active", "Blocked"] as const;

const statusStyle: Record<string, string> = {
  Active:      "text-emerald-700 bg-emerald-50 border-emerald-200",
  "In-Active": "text-amber-700  bg-amber-50  border-amber-200",
  Blocked:     "text-red-600    bg-red-50    border-red-200",
};

const fmt = (v: number) => `₹${Number(v ?? 0).toLocaleString("en-IN")}`;

type SortKey = keyof ExpenseLimitRecord | "";
type SortDir = "asc" | "desc";
type EditValues = Record<string, number | string>;

// ─── Mobile Card Component ────────────────────────────────────────────────────

function MobileCard({
  item,
  isSelected,
  isEditing,
  isSaving,
  editValues,
  onSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
}: {
  item:         ExpenseLimitRecord;
  isSelected:   boolean;
  isEditing:    boolean;
  isSaving:     boolean;
  editValues:   EditValues;
  onSelect:     () => void;
  onStartEdit:  () => void;
  onCancelEdit: () => void;
  onSaveEdit:   () => void;
  onEditChange: (key: string, val: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Preview fields shown collapsed
  const PREVIEW: (keyof ExpenseLimitRecord)[] = ["conveyance", "food", "hotel", "transport"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border transition-all duration-150 overflow-hidden shadow-sm ${
        isEditing   ? "border-purple-400 bg-purple-50/40" :
        isSelected  ? "border-purple-300 bg-purple-50/30" :
                      "border-slate-200 bg-white"
      }`}
    >
      {/* ── Card header ── */}
      <div className="flex items-start justify-between px-4 pt-4 pb-2 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <input
            type="checkbox"
            className="accent-purple-500 w-4 h-4 mt-0.5 shrink-0"
            checked={isSelected}
            onChange={onSelect}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="min-w-0">
            <p className="font-bold text-purple-700 text-sm leading-tight truncate">
              {item.name}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Updated by: {item.createdBy?.name ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge / edit select */}
          {isEditing ? (
            <select
              value={editValues.status as string}
              onChange={(e) => onEditChange("status", e.target.value)}
              className="text-xs border border-purple-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle[item.status] ?? "text-slate-500 bg-slate-100 border-slate-200"}`}>
              {item.status}
            </span>
          )}

          {/* Edit / Save / Cancel */}
          {isEditing ? (
            <div className="flex gap-1.5">
              <button
                disabled={isSaving}
                onClick={onSaveEdit}
                className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors"
              >
                <FiCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onCancelEdit}
                className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onStartEdit}
              className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-all"
            >
              <FiEdit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Max limit banner ── */}
      <div className="mx-4 mb-3 px-3 py-2 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between">
        <span className="text-xs text-purple-500 font-medium">🎯 Max Limit</span>
        {isEditing ? (
          <input
            type="number"
            min={0}
            step={100}
            value={editValues.max_limit as number}
            onChange={(e) => onEditChange("max_limit", e.target.value)}
            className="w-28 px-2 py-0.5 text-xs border border-purple-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 text-right tabular-nums font-bold"
          />
        ) : (
          <span className="font-bold text-purple-700 text-sm tabular-nums">{fmt(item.max_limit)}</span>
        )}
      </div>

      {/* ── Preview fields (always visible) ── */}
      <div className="px-4 pb-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {PREVIEW.map((key) => {
          const f = ALL_FIELDS.find((f) => f.key === key)!;
          const raw = (item as any)[key] ?? 0;
          return (
            <div key={key as string}>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                {f.icon} {f.label}
              </p>
              {isEditing ? (
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={editValues[key as string] as number}
                  onChange={(e) => onEditChange(key as string, e.target.value)}
                  className="w-full px-2 py-0.5 text-xs border border-purple-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 text-right tabular-nums mt-0.5"
                />
              ) : (
                <p className="text-sm font-semibold text-slate-700 tabular-nums">{fmt(raw)}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Expand toggle ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-slate-400 hover:text-purple-500 transition-colors border-t border-slate-100 mt-1"
      >
        {expanded ? "Show less" : `Show all ${ALL_FIELDS.length} fields`}
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <FiExpand className="w-3 h-3" />
        </motion.span>
      </button>

      {/* ── Expanded fields ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100">
              {ALL_FIELDS.filter((f) => !PREVIEW.includes(f.key as any)).map(({ key, label, icon }) => {
                const raw = (item as any)[key] ?? 0;
                return (
                  <div key={key as string}>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      {icon} {label}
                    </p>
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={editValues[key as string] as number}
                        onChange={(e) => onEditChange(key as string, e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-purple-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 text-right tabular-nums mt-0.5"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-700 tabular-nums">{fmt(raw)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExpenseLimitPage() {
  const currentUser = useAppSelector(selectUser);

  const [search, setSearch]             = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [pageSize, setPageSize]         = useState(10);
  const [page, setPage]                 = useState(1);
  const [sortKey, setSortKey]           = useState<SortKey>("");
  const [sortDir, setSortDir]           = useState<SortDir>("asc");
  const [showFilters, setShowFilters]   = useState(false);

  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [selectAllChecked, setSelectAll] = useState(false);

  const [bulkModal, setBulkModal]     = useState(false);
  const [bulkTargets, setBulkTargets] = useState<ExpenseLimitRecord[]>([]);

  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({});

  const [updateLimit, { isLoading: isSaving }] = useUpdateExpenseLimitMutation();

  // ── Debounce ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [statusFilter, pageSize]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, isFetching, isError, refetch } = useGetExpenseLimitsQuery({
    name: debouncedSearch, page, limit: pageSize,
  }) as any;

  useEffect(() => { if (isError) toast.error("Failed to load expense limits"); }, [isError]);

  const baseRows: ExpenseLimitRecord[] = data?.result ?? [];
  const filtered = statusFilter ? baseRows.filter((r) => r.status === statusFilter) : baseRows;
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = (a as any)[sortKey], bv = (b as any)[sortKey];
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  const totalRecords = data?.total ?? 0;
  const totalPages   = Math.max(1, Math.ceil(totalRecords / pageSize));

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      setSelectAll(next.size === sorted.length && sorted.length > 0);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectAllChecked) { setSelectedIds(new Set()); setSelectAll(false); }
    else { setSelectedIds(new Set(sorted.map((d) => d._id))); setSelectAll(true); }
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortDir === "asc" ? <FiChevronUp className="w-3 h-3 text-purple-500 shrink-0" /> : <FiChevronDown className="w-3 h-3 text-purple-500 shrink-0" />
      : <FiChevronUp className="w-3 h-3 text-slate-300 group-hover:text-slate-400 shrink-0" />;

  // ── Bulk modal ────────────────────────────────────────────────────────────
  const openBulkModal = () => {
    if (selectedIds.size === 0) { toast.error("Select at least one row"); return; }
    setBulkTargets(sorted.filter((d) => selectedIds.has(d._id)));
    setBulkModal(true);
  };
  const closeBulkModal = () => { setBulkModal(false); setBulkTargets([]); };

  // ── Inline edit ───────────────────────────────────────────────────────────
  const startEdit = (item: ExpenseLimitRecord) => {
    const vals: EditValues = { status: item.status, max_limit: item.max_limit };
    ALL_FIELDS.forEach(({ key }) => { vals[key as string] = (item as any)[key] ?? 0; });
    setEditValues(vals);
    setEditingId(item._id);
  };

  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const saveEdit = async (item: ExpenseLimitRecord) => {
    try {
      const payload: Record<string, any> = {};
      ALL_FIELDS.forEach(({ key }) => { payload[key as string] = Number(editValues[key as string]) || 0; });
      payload.max_limit = Number(editValues.max_limit) || 0;
      payload.status    = editValues.status;

      const res = await updateLimit({
        data: payload, usersToChange: [item.userId],
        selectAllChecked: false, actionSave: "permanent",
        createdBy: currentUser?._id?.toString() ?? "",
      }).unwrap();

      if (res.type === "SUCCESS") { toast.success("Limit saved"); cancelEdit(); refetch(); }
      else toast.error(res.message || "Save failed");
    } catch { toast.error("Save failed"); }
  };

  const handleEditChange = (key: string, val: string) =>
    setEditValues((p) => ({ ...p, [key]: val }));

  // ── Pagination numbers ─────────────────────────────────────────────────────
  const pageNumbers = (() => {
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const show = new Set([1, totalPages, page, page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages));
    return pages.filter((p) => show.has(p)).reduce<(number | "…")[]>((acc, cur, idx, arr) => {
      if (idx > 0 && cur - (arr[idx - 1]) > 1) acc.push("…");
      acc.push(cur);
      return acc;
    }, []);
  })();

  // ── Shared toolbar ────────────────────────────────────────────────────────
  const Toolbar = (
    <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3 shrink-0">
      {/* Row 1: title + refresh + bulk btn */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <FiUsers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 leading-tight truncate">
              Expense Limits
            </h1>
            {totalRecords > 0 && (
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {totalRecords.toLocaleString()} records
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-purple-600 hover:border-purple-300 transition-all"
          >
            <FiRefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>

          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                whileTap={{ scale: 0.95 }}
                onClick={openBulkModal}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-sm shadow-purple-200 transition-all"
              >
                <FiEdit2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Edit </span>
                {selectedIds.size}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Row 2: search + filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-slate-50"
          />
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border shrink-0 transition-all ${
            showFilters || statusFilter
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
          }`}
        >
          <FiFilter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {statusFilter && (
            <span className="w-4 h-4 rounded-full bg-white/25 text-[10px] flex items-center justify-center font-bold">1</span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-slate-100 space-y-3">
              {/* Status pills */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {["", ...STATUS_OPTIONS].map((s) => (
                    <button
                      key={s || "all"}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        statusFilter === s
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
                      }`}
                    >
                      {s || "All"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rows per page */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 shrink-0">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ── Pagination component ──────────────────────────────────────────────────
  const Pagination = totalPages > 1 ? (
    <div className="flex flex-col xs:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white border-t border-slate-100">
      <p className="text-xs text-slate-400 order-2 xs:order-1">
        <span className="font-semibold text-slate-600">
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRecords)}
        </span>
        {" of "}
        <span className="font-semibold text-slate-600">{totalRecords.toLocaleString()}</span>
      </p>

      <div className="flex items-center gap-1 order-1 xs:order-2">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-purple-600 hover:border-purple-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <FiChevronLeft className="w-4 h-4" />
        </button>

        {pageNumbers.map((p, i) =>
          p === "…" ? (
            <span key={`ell-${i}`} className="px-1.5 text-slate-400 text-sm select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => setPage(p as number)}
              className={`w-8 h-8 rounded-lg text-xs font-medium border transition-all ${
                page === p
                  ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-purple-300 hover:text-purple-600"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-purple-600 hover:border-purple-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <FiChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="flex flex-col bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row flex-grow min-h-0">
        <Sidebar />

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {isFetching && <Loader />}

          {Toolbar}

          {/* ── Mobile select-all bar ── */}
          <div className="md:hidden flex items-center justify-between px-4 py-2 bg-slate-100/70 border-b border-slate-200 shrink-0">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-purple-500 w-4 h-4"
                checked={selectAllChecked}
                onChange={toggleAll}
              />
              Select all ({sorted.length})
            </label>
            {selectedIds.size > 0 && (
              <span className="text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-0.5 font-semibold">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          {/* ─────────────────── MOBILE: card list ─────────────────── */}
          <div className="md:hidden flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {sorted.length === 0 && !isFetching && (
              <div className="text-center py-20">
                <p className="text-slate-400 text-sm">
                  No records found{debouncedSearch ? ` for "${debouncedSearch}"` : ""}{statusFilter ? ` · ${statusFilter}` : ""}.
                </p>
                <button
                  onClick={() => { setSearch(""); setStatusFilter(""); }}
                  className="mt-2 text-xs text-purple-500 hover:text-purple-700 underline"
                >
                  Clear filters
                </button>
              </div>
            )}

            {sorted.map((item) => (
              <MobileCard
                key={item._id}
                item={item}
                isSelected={selectedIds.has(item._id)}
                isEditing={editingId === item._id}
                isSaving={isSaving}
                editValues={editValues}
                onSelect={() => toggleSelect(item._id)}
                onStartEdit={() => startEdit(item)}
                onCancelEdit={cancelEdit}
                onSaveEdit={() => saveEdit(item)}
                onEditChange={handleEditChange}
              />
            ))}

            {isFetching && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 h-40" />
                ))}
              </div>
            )}
          </div>

          {/* ─────────────────── TABLET + DESKTOP: table ─────────────────── */}
          <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden px-4 lg:px-6 py-4 gap-3">
            <div className="rounded-xl border border-slate-200 shadow-sm bg-white overflow-auto flex-1">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-20">
                  <tr className="border-b border-slate-200">

                    {/* Checkbox sticky */}
                    <th className="px-4 py-3 w-10 sticky left-0 bg-slate-50 z-30 border-r border-slate-100">
                      <input
                        type="checkbox"
                        className="accent-purple-500 w-4 h-4"
                        checked={selectAllChecked}
                        onChange={toggleAll}
                      />
                    </th>

                    {/* Name sticky */}
                    <th
                      onClick={() => handleSort("name")}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky left-10 bg-slate-50 z-20 border-r border-slate-100 cursor-pointer group whitespace-nowrap min-w-[140px]"
                    >
                      <div className="flex items-center gap-1">Name <SortIcon col="name" /></div>
                    </th>

                    {ALL_FIELDS.map(({ key, label, icon }) => (
                      <th
                        key={key as string}
                        onClick={() => handleSort(key)}
                        className="px-3 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer group whitespace-nowrap min-w-[110px]"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>{icon}</span>{label}<SortIcon col={key} />
                        </div>
                      </th>
                    ))}

                    <th
                      onClick={() => handleSort("max_limit")}
                      className="px-3 py-3 text-right text-xs font-semibold text-purple-600 uppercase tracking-wider cursor-pointer group whitespace-nowrap min-w-[120px] bg-purple-50/50"
                    >
                      <div className="flex items-center justify-end gap-1">🎯 Max Limit <SortIcon col="max_limit" /></div>
                    </th>

                    <th
                      onClick={() => handleSort("status")}
                      className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer group whitespace-nowrap min-w-[110px]"
                    >
                      <div className="flex items-center gap-1">Status <SortIcon col="status" /></div>
                    </th>

                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                      Updated By
                    </th>

                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider sticky right-0 bg-slate-50 z-20 border-l border-slate-100 min-w-[80px]">
                      Edit
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sorted.map((item, idx) => {
                    const isSelected = selectedIds.has(item._id);
                    const isEditing  = editingId === item._id;

                    return (
                      <motion.tr
                        key={item._id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                        className={`group transition-colors duration-100 ${
                          isEditing ? "bg-purple-50/60" : isSelected ? "bg-purple-50/30" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="px-4 py-2.5 sticky left-0 bg-gray-50 z-10 border-r border-slate-100">
                          <input type="checkbox" className="accent-purple-500 w-4 h-4" checked={isSelected}
                            onChange={() => toggleSelect(item._id)} onClick={(e) => e.stopPropagation()} />
                        </td>

                        <td className="px-4 py-2.5 sticky left-10  bg-gray-50/80 z-10 border-r border-slate-100 whitespace-nowrap">
                          <span className="font-semibold text-purple-700 text-sm">{item.name}</span>
                        </td>

                        {ALL_FIELDS.map(({ key }) => {
                          const raw = (item as any)[key as string] ?? 0;
                          const fk  = key as string;
                          return isEditing ? (
                            <td key={fk} className="px-1 py-1.5">
                              <input type="number" min={0} step={50}
                                value={editValues[fk] as number}
                                onChange={(e) => handleEditChange(fk, e.target.value)}
                                className="w-24 px-2 py-1 text-xs border border-purple-300 rounded-lg bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-400 text-right tabular-nums"
                              />
                            </td>
                          ) : (
                            <td key={fk} className="px-3 py-2.5 text-slate-600 tabular-nums text-right whitespace-nowrap text-xs">
                              {fmt(raw)}
                            </td>
                          );
                        })}

                        <td className="px-3 py-2.5 bg-purple-50/20 border-l border-purple-100/60">
                          {isEditing ? (
                            <input type="number" min={0} step={100}
                              value={editValues.max_limit as number}
                              onChange={(e) => handleEditChange("max_limit", e.target.value)}
                              className="w-28 px-2 py-1 text-xs border border-purple-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-right tabular-nums font-semibold"
                            />
                          ) : (
                            <span className="font-bold text-purple-700 tabular-nums text-right block whitespace-nowrap text-xs">{fmt(item.max_limit)}</span>
                          )}
                        </td>

                        <td className="px-3 py-2.5">
                          {isEditing ? (
                            <select value={editValues.status as string}
                              onChange={(e) => handleEditChange("status", e.target.value)}
                              className="text-xs border border-purple-300 rounded-lg px-2 py-1.5 bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            >
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${statusStyle[item.status] ?? "text-slate-500 bg-slate-100 border-slate-200"}`}>
                              {item.status}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-xs">
                          {item.createdBy?.name ?? "—"}
                        </td>

                        <td className="px-3 py-2.5 sticky right-0 bg-inherit z-10 border-l border-slate-100">
                          <div className="flex items-center justify-center gap-1.5">
                            {isEditing ? (
                              <>
                                <motion.button whileTap={{ scale: 0.88 }} disabled={isSaving} onClick={() => saveEdit(item)}
                                  className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors shrink-0">
                                  <FiCheck className="w-3.5 h-3.5" />
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.88 }} onClick={cancelEdit}
                                  className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors shrink-0">
                                  <FiX className="w-3.5 h-3.5" />
                                </motion.button>
                              </>
                            ) : (
                              <motion.button whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.12 }} onClick={() => startEdit(item)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-purple-600 hover:bg-purple-50 transition-all opacity-0 group-hover:opacity-100 shrink-0">
                                <FiEdit2 className="w-3.5 h-3.5" />
                              </motion.button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}

                  {isFetching && Array.from({ length: 4 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="animate-pulse">
                      {Array.from({ length: 22 }).map((__, j) => (
                        <td key={j} className="px-3 py-3"><div className="h-3.5 bg-slate-100 rounded w-full" /></td>
                      ))}
                    </tr>
                  ))}

                  {!isFetching && sorted.length === 0 && (
                    <tr>
                      <td colSpan={22} className="py-20 text-center">
                        <p className="text-slate-400 text-sm">
                          No records found{debouncedSearch ? ` for "${debouncedSearch}"` : ""}{statusFilter ? ` · ${statusFilter}` : ""}.
                        </p>
                        <button onClick={() => { setSearch(""); setStatusFilter(""); }}
                          className="mt-2 text-xs text-purple-500 hover:text-purple-700 underline">
                          Clear filters
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination — shared, shows below both views */}
          <div className="shrink-0">
            {Pagination}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {bulkModal && (
          <ExpenseLimitForm
            closeModal={closeBulkModal}
            selectedUsersExpenseLimit={bulkTargets}
            selectAllChecked={selectAllChecked && selectedIds.size === sorted.length}
            onSuccess={() => { refetch(); setSelectedIds(new Set()); setSelectAll(false); }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}