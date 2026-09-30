// @app/_components/reports/downloadReport.ts
/**
 * downloadReport — bypasses RTK Query's JSON parser and fetches the file
 * as a raw binary blob, then triggers a browser download.
 *
 * Why not use useDownloadReportMutation?
 *   RTK Query's fetchBaseQuery parses responses as JSON by default.
 *   Binary responses (xlsx/pdf) get corrupted unless responseHandler:"blob"
 *   is set on the specific endpoint. Rather than patching the generated API
 *   file, we do a direct fetch here with full control over the response.
 *
 * Auth: reads the JWT from localStorage key "token" (adjust KEY if different).
 * Base URL: reads NEXT_PUBLIC_API_URL env var, falls back to "/api".
 */

export type DownloadFormat = "excel" | "pdf" | "csv";

export interface DownloadFilters {
  reportType: string;
  expenseType?: string;
  fromDate?: string;
  toDate?: string;
  users?: string[];
  status?: string[];
  categories?: string[];
  search?: string;
  fields?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

const BASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL) ||
  "/api";

/** Read auth token — adjust storage key / method to match your app */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // Try common keys in order
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("token") ||
    null
  );
}

/**
 * Serialise filters into URLSearchParams so the backend receives them
 * exactly as it does from the RTK Query GET requests.
 * Arrays are sent as repeated keys: status=pending&status=approved
 */
function buildParams(filters: DownloadFilters, format: DownloadFormat): URLSearchParams {
  const p = new URLSearchParams();

  p.set("format", format);

  if (filters.reportType)  p.set("reportType",  filters.reportType);
  if (filters.expenseType) p.set("expenseType", filters.expenseType);
  if (filters.fromDate)    p.set("fromDate",    filters.fromDate);
  if (filters.toDate)      p.set("toDate",      filters.toDate);
  if (filters.search)      p.set("search",      filters.search);
  if (filters.sortBy)      p.set("sortBy",      filters.sortBy);
  if (filters.sortOrder)   p.set("sortOrder",   filters.sortOrder);
  if (filters.page)        p.set("page",        String(filters.page));
  // No limit for downloads — send all matching records
  // if (filters.limit)       p.set("limit",       String(filters.limit));

  filters.users?.forEach(u => p.append("users", u));
  filters.status?.forEach(s => p.append("status", s));
  filters.categories?.forEach(c => p.append("categories", c));
  filters.fields?.forEach(f => p.append("fields", f));

  return p;
}

const MIME: Record<DownloadFormat, string> = {
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf:   "application/pdf",
  csv:   "text/csv",
};

const EXT: Record<DownloadFormat, string> = {
  excel: "xlsx",
  pdf:   "pdf",
  csv:   "csv",
};

export async function downloadReport(
  filters: DownloadFilters,
  format: DownloadFormat
): Promise<void> {
  const params  = buildParams(filters, format);
  const token   = getAuthToken();

  const headers: HeadersInit = {
    Accept: MIME[format],
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Most backends expose a single download endpoint; adjust path as needed.
  const url = `${BASE_URL}/reports/download?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include", // send cookies too if your API uses them
  });

  if (!response.ok) {
    // Try to read a JSON error message from the body
    let msg = `Download failed (${response.status})`;
    try {
      const ct = response.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const json = await response.json();
        msg = json?.message || json?.error || msg;
      } else {
        const text = await response.text();
        if (text) msg = text;
      }
    } catch { /* ignore parse errors */ }
    throw new Error(msg);
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error("Server returned an empty file. Check server logs.");
  }

  // Force correct MIME type in case server sent application/octet-stream
  const typedBlob = blob.type === MIME[format]
    ? blob
    : new Blob([blob], { type: MIME[format] });

  const objectUrl = URL.createObjectURL(typedBlob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `report_${filters.reportType}_${filters.fromDate ?? "all"}_to_${filters.toDate ?? "all"}.${EXT[format]}`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Small delay so the browser has time to start the download before we revoke
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  }, 500);
}