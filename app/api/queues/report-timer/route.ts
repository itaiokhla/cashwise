/**
 * POST /api/queues/report-timer
 *
 * Vercel Queues push consumer (topic "report-timers", see vercel.json).
 * Each message is a timer armed for a schedule's next run time (see
 * @app/_lib/reportTimers); it becomes visible at that minute and this
 * handler sends whatever is due — the same idempotent dispatcher the cron
 * uses, so a timer and a cron tick firing together never send twice.
 *
 * Vercel only invokes this function from its queue infrastructure; it has
 * no public URL. If the handler throws, Queues retries the message.
 */

import { handleCallback } from "@vercel/queue";
import { dispatchDueReports, resolveAppBaseUrl } from "@app/_lib/autoExpenseReport";
import { armReportTimers, type ReportTimerMessage } from "@app/_lib/reportTimers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Longest we wait when a message arrives a little before its slot. */
const MAX_EARLY_WAIT_MS = 20_000;
const MAX_DELIVERIES = 5;

const consume = handleCallback<ReportTimerMessage>(
  async (message, metadata) => {
    const early = new Date(message?.fireAt).getTime() - Date.now();
    if (early > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(early, MAX_EARLY_WAIT_MS)));

    const summary = await dispatchDueReports({ appBaseUrl: resolveAppBaseUrl(), source: "queue-timer" });
    console.log(
      `[queues/report-timer] ${message?.scheduleId} @ ${message?.fireAt} (delivery ${metadata.deliveryCount}): ` +
        `sent ${summary.sent}, failed ${summary.failed}, skipped ${summary.skipped}, deferred ${summary.deferred}`
    );

    // Next day's slot, a failure retry or deferred work gets its own timer.
    await armReportTimers();
  },
  {
    retry: (error, metadata) => {
      console.error(`[queues/report-timer] delivery ${metadata.deliveryCount} failed:`, (error as Error)?.message);
      // The hourly cron still catches up anything a dropped timer missed.
      if (metadata.deliveryCount >= MAX_DELIVERIES) return { acknowledge: true };
      return { afterSeconds: 60 };
    },
  }
);

export async function POST(request: Request) {
  return consume(request);
}
