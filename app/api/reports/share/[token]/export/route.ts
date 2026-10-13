/**
 * GET /api/reports/share/[token]/export?format=pdf|xlsx
 *
 * Public, token-protected download of a shared report — used by the
 * "Download PDF / Excel" buttons in the email and on the shared-report page.
 *
 * Query:
 *   format   pdf | xlsx (default pdf)
 *   section  daily | weekly | monthly — limit to one period (default: all)
 *   q, type, source, status, users, categories — same filters as the page
 */

import { NextRequest, NextResponse } from "next/server";
import { findShareLink, sectionsFromSnapshot } from "@app/_lib/reportShare";
import { buildReportExcel, buildReportPdf, filteredSection, safeFileName } from "@app/_lib/reportExports";
import { filterRows, hasActiveFilters, parseRowFilters } from "@app/_lib/reportDigest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const found = await findShareLink(token);
    if (!found.ok) {
      return new NextResponse(`${found.message}${found.type === "EXPIRED" ? " Please ask your CashWise administrator for a new report." : ""}`, {
        status: found.status,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    const url = new URL(req.url);
    const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
    const sectionKey = url.searchParams.get("section");
    const filters = parseRowFilters(url.searchParams);
    const filtered = hasActiveFilters(filters);

    const snapshot = found.link.snapshotData;
    let sections = sectionsFromSnapshot(snapshot);
    if (sectionKey && sectionKey !== "all") {
      const match = sections.filter((s) => s.key === sectionKey);
      if (match.length) sections = match;
    }
    if (filtered) {
      // Cash position covers every transaction of the users in scope, so it
      // would not reconcile with a filtered row set — leave it out.
      sections = sections.map((s) => ({ ...filteredSection(s, filterRows(s.rows, filters)), cashPosition: null }));
    }

    const exportSnapshot = {
      scheduleName: snapshot.scheduleName,
      reportType: snapshot.reportType,
      generatedAt: snapshot.generatedAt || new Date(found.link.createdAt).toLocaleString("en-IN"),
      timezone: snapshot.timezone,
      sections,
    };

    const fileBase = safeFileName(
      "cashwise",
      snapshot.scheduleName || "report",
      sections.length === 1 ? sections[0].key : "",
      sections[0]?.to || snapshot.toDate || ""
    );

    if (format === "xlsx") {
      const buffer = await buildReportExcel(exportSnapshot);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const filterNote = filtered
      ? [
          filters.search && `search "${filters.search}"`,
          filters.type && filters.type !== "all" && `type ${filters.type}`,
          filters.source && filters.source !== "all" && `source ${filters.source}`,
          filters.statuses?.length && `status ${filters.statuses.join("/")}`,
          filters.users?.length && `${filters.users.length} employee(s)`,
          filters.categories?.length && `${filters.categories.length} categor${filters.categories.length === 1 ? "y" : "ies"}`,
        ]
          .filter(Boolean)
          .join(", ")
      : undefined;

    const buffer = buildReportPdf(exportSnapshot, {
      detailSectionKeys: sections.length === 1 ? [sections[0].key] : [sections[0]?.key].filter(Boolean) as string[],
      filterNote,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${url.searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="${fileBase}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: any) {
    console.error("[api/reports/share/export] Error:", error);
    return new NextResponse("Unable to build the file right now. Please try again.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
