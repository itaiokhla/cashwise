/**
 * GET /api/reports/share/[token]
 *
 * Public endpoint — no normal CashWise auth required.
 * Validates the share token, checks expiry server-side, returns the report snapshot.
 *
 * Security:
 *  - Raw token is hashed (SHA-256) before DB lookup
 *  - Expiry is checked server-side (not just in the URL)
 *  - Returns only the associated report snapshot — recipient addresses are
 *    stripped so a forwarded link does not leak who else received it
 *  - Expired / revoked links return 410 Gone with a safe message
 */

import { NextRequest, NextResponse } from "next/server";
import { findShareLink } from "@app/_lib/reportShare";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const found = await findShareLink(token);

    if (!found.ok) {
      return NextResponse.json(
        {
          type: found.type,
          message: found.message,
          ...(found.type === "EXPIRED"
            ? {
                detail: "Please ask your CashWise administrator to send a new report.",
                expiresAt: found.expiresAt,
              }
            : {}),
        },
        { status: found.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { link } = found;
    const { recipients: _recipients, ...snapshot } = link.snapshotData;

    return NextResponse.json(
      {
        type: "SUCCESS",
        message: "Report retrieved successfully",
        data: {
          reportExecutionId: link.reportExecutionId,
          scheduleId: link.scheduleId,
          expiresAt: link.expiresAt,
          createdAt: link.createdAt,
          snapshot,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error("[api/reports/share] Error:", error);
    return NextResponse.json(
      { type: "ERROR", message: "Unable to retrieve report. Please try again later." },
      { status: 500 }
    );
  }
}
