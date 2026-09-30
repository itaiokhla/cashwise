// @app/_components/reports/ExcelDownload.tsx
"use client";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { downloadReport, type DownloadFilters } from "./downloadReport";
import type { ReportType, ExpenseType, ExpenseStatus, ExpenseCategory } from "@app/_api_query/report.api";

export interface ExcelDownloadProps {
  reportType: ReportType;
  expenseTypes: ExpenseType[];
  fromDate: Date | undefined;
  toDate: Date | undefined;
  selectedUsers: string[];
  status: ExpenseStatus[];
  selectedCategories: ExpenseCategory[];
  searchTerm?: string;
  disabled?: boolean;
  /** Keys of columns currently visible in the table */
  visibleFields?: string[];
  label?: string;
}

const isoD = (d: Date | undefined) =>
  d ? d.toISOString().split("T")[0] : undefined;

export default function ExcelDownload({
  reportType,
  expenseTypes,
  fromDate,
  toDate,
  selectedUsers,
  status,
  selectedCategories,
  searchTerm,
  disabled,
  visibleFields,
  label = "Excel",
}: ExcelDownloadProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (disabled || loading) return;
    setLoading(true);

    const filters: DownloadFilters = {
      reportType,
      expenseType: expenseTypes.includes("all") ? "all" : (expenseTypes[0] ?? "all"),
      fromDate:    isoD(fromDate),
      toDate:      isoD(toDate),
      users:       selectedUsers.includes("all") ? undefined : selectedUsers,
      status:      status.length ? status : undefined,
      categories:  selectedCategories.length ? selectedCategories : undefined,
      search:      searchTerm || undefined,
      fields:      visibleFields?.length ? visibleFields : undefined,
      sortBy:      "date",
      sortOrder:   "desc",
    };

    try {
      await downloadReport(filters, "excel");
      toast.success("Excel downloaded successfully");
    } catch (err: any) {
      console.error("[ExcelDownload]", err);
      toast.error(err?.message || "Excel download failed");
    } finally {
      setLoading(false);
    }
  }, [disabled, loading, reportType, expenseTypes, fromDate, toDate, selectedUsers, status, selectedCategories, searchTerm, visibleFields]);

  const isDisabled = disabled || loading;

  return (
    <button
      onClick={handleDownload}
      disabled={isDisabled}
      title={`Download ${label}`}
      className={`
        relative inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 
        bg-teal-600 text-white rounded-lg font-bold 
        hover:bg-teal-700 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-150 select-none overflow-hidden
      `}
    >
      {loading ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="hidden sm:inline">Preparing…</span>
          <span className="absolute bottom-0 left-0 h-0.5 bg-white/50 w-full animate-pulse" />
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 7V3.5L18.5 9H13zM8 13h2.5l1.5 2.5 1.5-2.5H16l-2.5 4 2.5 4h-2.5L12 18.5 10.5 21H8l2.5-4L8 13z" />
          </svg>
          <span className="hidden sm:inline">↓ {label}</span>
          <span className="sm:hidden">↓</span>
        </>
      )}
    </button>
  );
}