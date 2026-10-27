// @app/_services/reportApi.ts
import { CookiesHandler } from "@/utils/storage";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import type { RootState } from "@/redux/store";
import * as React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportType = "expense" | "credit" | "debit" | "combined";
export type ExportFormat = "json" | "csv" | "excel" | "pdf";
export type GroupBy = "user" | "date" | "category" | "none";
export type ExpenseType = "all" | "office" | "travel" | "toPay";
export type ExpenseStatus = "pending" | "approved" | "rejected";
export type ExpenseCategory =
  | "conveyance"
  | "purchase"
  | "food"
  | "tea"
  | "hotel"
  | "labour"
  | "contractor"
  | "courier"
  | "loading"
  | "porter"
  | "rider"
  | "maintenance"
  | "other"
  | "transport"
  | "cartage"
  | "dailyWages";

export interface ExpenseItem {
  _id: string;
  siteName: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  description?: string;
  userName: string;
  userId: string;
  status: ExpenseStatus;
  createdAt: string;
  [key: string]: unknown;
}

export interface TransactionItem {
  _id: string;
  name: string;
  phone: string;
  money: number;
  reason: string;
  remarks?: string;
  date: string;
  userName: string;
  userId: string;
  type: "credit" | "debit";
  createdAt: string;
}

export type ReportItem = ExpenseItem | TransactionItem;

export interface GroupSummary {
  total: number;
  count: number;
}

export interface ReportSummary {
  grandTotal: number;
  totalRecords: number;
  averagePerEntry: number;
  byUser: Record<string, GroupSummary>;
  byDate: Record<string, GroupSummary>;
  byCategory: Record<string, GroupSummary>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ReportFilters {
  reportType: ReportType;
  expenseType?: ExpenseType;
  fromDate?: string;
  toDate?: string;
  users?: string[];
  status?: ExpenseStatus[];
  categories?: ExpenseCategory[];
  search?: string;
  groupBy?: GroupBy;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
  format?: ExportFormat;
  includeSummary?: boolean;
}

export interface ReportResponse {
  type: "SUCCESS" | "ERROR";
  message: string;
  data: ReportItem[];
  summary: ReportSummary;
  pagination: PaginationMeta;
  filters: ReportFilters;
}

export interface DownloadRequest {
  filters: Omit<ReportFilters, "format">;
  format: ExportFormat;
}

export interface EmailReportRequest {
  reportIds: string[];
  email: string;
  format?: ExportFormat;
}

export interface EmailReportResponse {
  type: "SUCCESS" | "ERROR";
  message: string;
  reportIds?: string[];
}

export interface ReportQueryCache {
  data: ReportItem[];
  summary: ReportSummary;
  pagination: PaginationMeta;
  filters: ReportFilters;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

const buildReportQuery = (params: Partial<ReportFilters>): string => {
  const searchParams = new URLSearchParams();

  // Core filters
  if (params.reportType) searchParams.append("reportType", params.reportType);
  if (params.expenseType) searchParams.append("expenseType", params.expenseType);
  if (params.fromDate) searchParams.append("fromDate", params.fromDate);
  if (params.toDate) searchParams.append("toDate", params.toDate);
  if (params.search) searchParams.append("search", params.search);
  if (params.groupBy) searchParams.append("groupBy", params.groupBy);
  if (params.sortBy) searchParams.append("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.append("sortOrder", params.sortOrder);
  if (params.format) searchParams.append("format", params.format);
  if (params.includeSummary !== undefined)
    searchParams.append("includeSummary", String(params.includeSummary));

  // Array params
  if (params.users?.length) {
    params.users.forEach((u) => searchParams.append("user", u));
  }
  if (params.status?.length) {
    searchParams.append("status", params.status.join(","));
  }
  if (params.categories?.length) {
    searchParams.append("categories", params.categories.join(","));
  }

  // Pagination
  if (params.page && params.page > 0) searchParams.append("page", String(params.page));
  if (params.limit && params.limit > 0)
    searchParams.append("limit", String(Math.min(params.limit, 1000)));

  return `/api/reports/download?${searchParams.toString()}`;
};

// ─── RTK Query API ───────────────────────────────────────────────────────────

export const reportApi = createApi({
  reducerPath: "reportApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/",
    prepareHeaders: (headers) => {
      const token = CookiesHandler.getCookieValue("accessToken");
      const user = CookiesHandler.getCookieValue("user");
      
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
      if (user) {
        headers.set("user", user);
      }
      return headers;
    },
  }),
  tagTypes: ["Report", "ReportSummary", "UserReport"],
  
  endpoints: (builder) => ({
    
    // ─── QUERY: Fetch Report Data (JSON) ─────────────────────────────────────
    getReport: builder.query<ReportResponse, ReportFilters>({
      query: (filters) => ({
        url: buildReportQuery({ ...filters, format: "json" }),
        method: "GET",
      }),
      providesTags: (result, _error, arg) => {
        const tags: Array<{ type: "Report" | "ReportSummary" | "UserReport"; id?: string }> = [
          { type: "Report", id: "LIST" },
          { type: "ReportSummary", id: arg.reportType },
        ];
        
        // Add user-specific tags if filtering by users
        if (arg.users?.length) {
          arg.users.forEach((userId) => {
            tags.push({ type: "UserReport", id: userId });
          });
        }
        
        return tags;
      },
      transformResponse: (response: {
        type: string;
        message: string;
        data: ReportItem[];
        summary: ReportSummary;
        pagination: PaginationMeta;
        filters: ReportFilters;
      }): ReportResponse => ({
        ...response,
        type: response.type as "SUCCESS" | "ERROR",
      }),
    }),

    // ─── QUERY: Prefetch Report Summary (lightweight) ────────────────────────
    getReportSummary: builder.query<ReportSummary, Partial<ReportFilters>>({
      query: (filters) => ({
        url: buildReportQuery({ 
          ...filters, 
          format: "json", 
          limit: 1, // Minimal data fetch
          includeSummary: true 
        }),
        method: "GET",
      }),
      providesTags: (_result, _error, arg) => [
        { type: "ReportSummary", id: arg.reportType || "all" },
      ],
      transformResponse: (response: { summary: ReportSummary }): ReportSummary => response.summary,
    }),

    // ─── QUERY: Get Available Users for Filter ───────────────────────────────
    getReportUsers: builder.query<Array<{ _id: string; name: string; type: string }>, void>({
      query: () => "/api/users?fields=_id,name,type&limit=1000",
      providesTags: ["Report"],
      transformResponse: (response: Array<{ _id: string; name: string; type: string }>) => response,
    }),

    // ─── QUERY: Get Available Categories for Filter ──────────────────────────
    getReportCategories: builder.query<ExpenseCategory[], { reportType: ReportType }>({
      query: ({ reportType }) => {
        if (reportType === "expense") {
          return "/api/reports/categories?type=expense";
        }
        return "/api/reports/categories?type=transaction";
      },
      providesTags: ["Report"],
      transformResponse: (response: { categories: ExpenseCategory[] } | ExpenseCategory[]): ExpenseCategory[] => {
        if (Array.isArray(response)) {
          return response;
        }
        return response.categories || [];
      },
    }),

    // ─── MUTATION: Download Report File ──────────────────────────────────────
    downloadReport: builder.mutation<Blob, DownloadRequest>({
      queryFn: async ({ filters, format }, _api, _extra, baseQuery) => {
        try {
          const response = await baseQuery({
            url: buildReportQuery({ ...filters, format }),
            method: "GET",
            responseHandler: (response: Response) => response.blob(),
          });

          if ("error" in response && response.error) {
            return { error: response.error as FetchBaseQueryError };
          }

          return { data: response.data as Blob };
        } catch (error) {
          return { error: { status: "FETCH_ERROR", error: "Download failed" } as FetchBaseQueryError };
        }
      },
      invalidatesTags: (_result, _error, arg) => [
        { type: "Report", id: "LIST" },
        { type: "ReportSummary", id: arg.filters.reportType },
      ],
    }),

    // ─── MUTATION: Email Report ──────────────────────────────────────────────
    emailReport: builder.mutation<EmailReportResponse, EmailReportRequest>({
      query: (body) => ({
        url: "/api/reports/download",
        method: "POST",
        body: { action: "email", ...body },
      }),
      invalidatesTags: [{ type: "Report", id: "LIST" }],
    }),

    // ─── MUTATION: Refresh/Invalidate Report Cache ───────────────────────────
    refreshReport: builder.mutation<void, { reportType: ReportType; userIds?: string[] }>({
      queryFn: async (): Promise<{ data: undefined }> => {
        // This is a cache invalidation mutation - no actual API call needed
        // The invalidatesTags below will handle cache clearing
        return { data: undefined };
      },
      invalidatesTags: (_result, _error, arg) => {
        const tags: Array<{ type: "Report" | "ReportSummary" | "UserReport"; id?: string }> = [
          { type: "Report", id: "LIST" },
          { type: "ReportSummary", id: arg.reportType },
        ];
        
        if (arg.userIds?.length) {
          arg.userIds.forEach((id) => tags.push({ type: "UserReport", id }));
        }
        
        return tags;
      },
    }),

    // ─── QUERY: Get Report Statistics (for dashboard) ────────────────────────
    getReportStats: builder.query<
      {
        totalExpenses: number;
        totalCredits: number;
        totalDebits: number;
        pendingCount: number;
        approvedCount: number;
        dateRange: { from: string; to: string };
      },
      { fromDate?: string; toDate?: string }
    >({
      query: ({ fromDate, toDate }) => {
        const params = new URLSearchParams();
        if (fromDate) params.append("fromDate", fromDate);
        if (toDate) params.append("toDate", toDate);
        return `/api/reports/stats?${params.toString()}`;
      },
      providesTags: ["ReportSummary"],
      transformResponse: (response: {
        totalExpenses: number;
        totalCredits: number;
        totalDebits: number;
        pendingCount: number;
        approvedCount: number;
        dateRange: { from: string; to: string };
      }) => response,
    }),
getDayBalance: builder.query<
  any,
  { fromDate: string; toDate: string; usersId: string[] }
>({
  query: ({ fromDate, toDate, usersId }) => ({
    url: `/api/admin/daybalance?fromDate=${fromDate}&toDate=${toDate}&usersId=${encodeURIComponent(
      JSON.stringify(usersId)
    )}`,
    method: "GET",
  }),
  providesTags: ["UserReport"],
}),
  }),
});

// ─── Export Hooks ────────────────────────────────────────────────────────────

export const {
  useGetReportQuery,
  useGetReportSummaryQuery,
  useGetReportUsersQuery,
  useGetReportCategoriesQuery,
  useDownloadReportMutation,
  useEmailReportMutation,
  useRefreshReportMutation,
  useGetReportStatsQuery,
  usePrefetch,
  useGetDayBalanceQuery
} = reportApi;

// ─── Utility Hooks ───────────────────────────────────────────────────────────

/**
 * Hook for infinite scroll / load more pagination
 */
export const useInfiniteReport = (initialFilters: ReportFilters) => {
  const [page, setPage] = React.useState(initialFilters.page || 1);

  const filters = React.useMemo(() => ({
    ...initialFilters,
    page,
  }), [initialFilters, page]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetReportQuery(filters, {
    skip: !filters.reportType,
  });

  const loadMore = React.useCallback(() => {
    if (!data?.pagination.hasNext || isFetching) return;
    
    setPage((prevPage) => prevPage + 1);
  }, [data, isFetching]);

  return {
    data: data?.data || [],
    summary: data?.summary,
    pagination: data?.pagination,
    isLoading,
    isFetching,
    isError,
    error,
    loadMore,
    hasMore: data?.pagination.hasNext ?? false,
    refetch,
  };
};

/**
 * Hook for downloading reports with progress tracking
 */
export const useReportDownload = () => {
  const [downloadReport, { isLoading, isSuccess, isError, error }] = 
    useDownloadReportMutation();

  const download = React.useCallback(async (
    filters: Omit<ReportFilters, "format">, 
    format: ExportFormat
  ) => {
    try {
      const result = await downloadReport({ filters, format }).unwrap();
      
      if (!(result instanceof Blob)) {
        throw new Error("Invalid response type");
      }
      
      // Create download link
      const url = window.URL.createObjectURL(result);
      const link = document.createElement("a");
      link.href = url;
      
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `report_${filters.reportType}_${timestamp}.${format}`;
      link.setAttribute("download", filename);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, filename } as const;
    } catch (err) {
      console.error("Download error:", err);
      return { success: false, error: err } as const;
    }
  }, [downloadReport]);

  return {
    download,
    isDownloading: isLoading,
    downloadSuccess: isSuccess,
    downloadError: isError,
    error,
  };
};

/**
 * Hook for debounced search in reports
 */
export const useReportSearch = (
  baseFilters: ReportFilters,
  debounceMs = 300
) => {
  const [searchTerm, setSearchTerm] = React.useState<string>(baseFilters.search || "");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>(searchTerm);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [searchTerm, debounceMs]);

  const filters = React.useMemo((): ReportFilters => {
    return {
      ...baseFilters,
      search: debouncedSearch || undefined,
      page: 1, // Reset to first page on search
    };
  }, [baseFilters, debouncedSearch]);

  return {
    searchTerm,
    setSearchTerm,
    filters,
    debouncedSearch,
  };
};

// ─── Selectors (for use with useSelector) ────────────────────────────────────

// Helper to get query state safely
const getReportQueryState = (state: RootState, reportType: ReportType) => {
  // RTK Query stores queries under reducerPath
  const apiState = state[reportApi.reducerPath];
  if (!apiState?.queries) return null;
  
  // Find the query key that matches our report type
  const queryKey = Object.keys(apiState.queries).find((key) => 
    key.includes(`"reportType":"${reportType}"`)
  );
  
  if (!queryKey) return null;
  return apiState.queries[queryKey];
};

export const selectReportData = (state: RootState, reportType: ReportType): ReportItem[] => {
  const queryState:any = getReportQueryState(state, reportType);
  return (queryState?.data as ReportResponse | undefined)?.data || [];
};

export const selectReportSummary = (state: RootState, reportType: ReportType): ReportSummary | undefined => {
  const queryState = getReportQueryState(state, reportType);
  return (queryState?.data as ReportResponse | undefined)?.summary;
};

export const selectReportPagination = (state: RootState, reportType: ReportType): PaginationMeta | undefined => {
  const queryState = getReportQueryState(state, reportType);
  return (queryState?.data as ReportResponse | undefined)?.pagination;
};

export const selectIsReportLoading = (state: RootState, reportType: ReportType): boolean => {
  const queryState:any = getReportQueryState(state, reportType);
  return queryState?.isLoading === true;
};

export const selectIsReportFetching = (state: RootState, reportType: ReportType): boolean => {
  const queryState:any = getReportQueryState(state, reportType);
  return queryState?.isFetching === true;
};

export const selectReportError = (state: RootState, reportType: ReportType): FetchBaseQueryError | undefined => {
  const queryState = getReportQueryState(state, reportType);
  return queryState?.error as FetchBaseQueryError | undefined;
};

// Selector for all reports (useful for combined views)
export const selectAllReportData = (state: RootState): Record<ReportType, ReportItem[]> => {
  const types: ReportType[] = ["expense", "credit", "debit", "combined"];
  const result: Partial<Record<ReportType, ReportItem[]>> = {};
  
  types.forEach((type) => {
    result[type] = selectReportData(state, type);
  });
  
  return result as Record<ReportType, ReportItem[]>;
};

// Selector for report stats
export const selectReportStats = (state: RootState) => {
  const apiState = state[reportApi.reducerPath];
  if (!apiState?.queries) return null;
  
  const queryKey = Object.keys(apiState.queries).find((key) => 
    key.includes("getReportStats")
  );
  
  if (!queryKey) return null;
  return apiState.queries[queryKey]?.data;
};
