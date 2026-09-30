// @app/_components/reports/PdfDownload.tsx
"use client";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { downloadReport, type DownloadFilters } from "./downloadReport";
import type { ReportType, ExpenseType, ExpenseStatus, ExpenseCategory } from "@app/_api_query/report.api";

export interface PdfDownloadProps {
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

export default function PdfDownload({
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
  label = "PDF",
}: PdfDownloadProps) {
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
      await downloadReport(filters, "pdf");
      toast.success("PDF downloaded successfully");
    } catch (err: any) {
      console.error("[PdfDownload]", err);
      toast.error(err?.message || "PDF download failed");
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
        bg-slate-800 text-white rounded-lg font-bold
        hover:bg-slate-700 active:scale-95
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
          <span className="hidden sm:inline">Generating…</span>
          <span className="absolute bottom-0 left-0 h-0.5 bg-white/50 w-full animate-pulse" />
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14a2 2 0 002 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
          </svg>
          <span className="hidden sm:inline">↓ {label}</span>
          <span className="sm:hidden">↓</span>
        </>
      )}
    </button>
  );
}