/**
 * GET|POST /api/cron/expense-reports
 *
 * Report scheduler tick. Sends every automated report whose scheduled time
 * has passed and has not been delivered yet (see dispatchDueReports).
 *
 * Callers:
 *  - Vercel Cron (vercel.json): one daily job per hour → an hourly tick that
 *    fits the Hobby plan limit of "once per day per cron job". Vercel sends
 *    `Authorization: Bearer $CRON_SECRET` automatically.
 *  - Optional external pinger (cron-job.org, UptimeRobot, GitHub Actions …)
 *    every 1–5 minutes for minute-accurate delivery; send the same Bearer
 *    header or `x-cron-secret: $CRON_SECRET`.
 *  - scripts/scheduler.js during local development.
 *
 * Every tick is idempotent: a slot is delivered at most once no matter how
 * many callers fire, and missed ticks are caught up on the next one.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { dispatchDueReports, resolveAppBaseUrl } from "@app/_lib/autoExpenseReport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 60s is allowed on every Vercel plan (with or without Fluid compute).
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Local development convenience only — production always requires the secret.
    if (process.env.NODE_ENV !== "production") return true;
    console.error("[cron/expense-reports] CRON_SECRET is not configured — request denied");
    return false;
  }
  const bearer = request.headers.get("authorization") || "";
  const header = request.headers.get("x-cron-secret") || "";
  return safeEqual(bearer, `Bearer ${secret}`) || safeEqual(header, secret);
}

function tickSource(request: NextRequest): string {
  if (request.headers.get("x-vercel-cron-schedule") || /vercel-cron/i.test(request.headers.get("user-agent") || "")) {
    return "vercel-cron";
  }
  if (request.headers.get("x-cashwise-scheduler")) return "local-scheduler";
  return "external";
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ type: "UNAUTHORIZED", message: "Invalid or missing cron secret" }, { status: 401 });
  }

  try {
    const summary = await dispatchDueReports({
      appBaseUrl: resolveAppBaseUrl(new URL(request.url).origin),
      source: tickSource(request),
    });

    return NextResponse.json({
      type: "SUCCESS",
      message: `Sent ${summary.sent}, failed ${summary.failed}, skipped ${summary.skipped}, deferred ${summary.deferred}`,
      summary: {
        totalSchedules: summary.checked,
        due: summary.due,
        processedCount: summary.sent,
        failedCount: summary.failed,
        skippedCount: summary.skipped,
        deferredCount: summary.deferred,
        durationMs: summary.durationMs,
      },
      results: summary.results,
    });
  } catch (error) {
    console.error("[cron/expense-reports] Route error:", error);
    return NextResponse.json(
      { type: "ERROR", message: (error as Error)?.message || "Failed to process scheduled reports" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
