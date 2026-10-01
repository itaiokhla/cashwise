/**
 * GET /api/reports/share/[token]
 *
 * Public endpoint — no normal CashWise auth required.
 * Validates the share token, checks expiry server-side, returns the report snapshot.
 *
 * Security:
 *  - Raw token is hashed (SHA-256) before DB lookup
 *  - Expiry is checked server-side (not just in the URL)
 *  - Returns only the associated report snapshot — nothing else
 *  - Expired / revoked links return 410 Gone with a safe message
 */

import { NextRequest, NextResponse } from "next/server";
import DB from "@app/_database/db";
import ReportShareLink, { hashToken } from "@app/_model/reportShareLink.model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

(async () => await DB())();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await DB();

    const { token } = await params;

    // Validate token format — 64 hex chars
    if (!token || !/^[0-9a-f]{64}$/i.test(token)) {
      return NextResponse.json(
        { type: "INVALID_TOKEN", message: "Invalid or malformed report link." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    const shareLink = await ReportShareLink.findOne({ tokenHash }).lean();

    if (!shareLink) {
      return NextResponse.json(
        { type: "NOT_FOUND", message: "This report link does not exist or has already been removed." },
        { status: 404 }
      );
    }

    // Check revocation
    if (shareLink.revokedAt) {
      return NextResponse.json(
        {
          type: "REVOKED",
          message: "This report link has been revoked by the administrator.",
        },
        { status: 410 }
      );
    }

    // Server-side expiry check
    if (new Date() > new Date(shareLink.expiresAt)) {
      return NextResponse.json(
        {
          type: "EXPIRED",
          message: "This report link has expired.",
          detail: "Report links are valid for 24 hours from generation. Please request a new report from the CashWise administrator.",
          expiresAt: shareLink.expiresAt,
        },
        { status: 410 }
      );
    }

    // Return the snapshot — only the data associated with this report
    return NextResponse.json({
      type: "SUCCESS",
      message: "Report retrieved successfully",
      data: {
        reportExecutionId: shareLink.reportExecutionId,
        scheduleId: shareLink.scheduleId,
        expiresAt: shareLink.expiresAt,
        createdAt: shareLink.createdAt,
        snapshot: shareLink.snapshotData,
      },
    });
  } catch (error: any) {
    console.error("[api/reports/share] Error:", error);
    return NextResponse.json(
      { type: "ERROR", message: "Unable to retrieve report. Please try again later." },
      { status: 500 }
    );
  }
}
