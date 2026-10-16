/**
 * @app/_lib/reportTimers.ts
 *
 * On-time delivery for automated reports on Vercel.
 *
 * Vercel Cron on the Hobby plan fires each daily job at a random minute of
 * its hour, so the hourly tick alone delivers a 7:00 PM report anywhere up
 * to ~90 minutes late. To deliver at the configured minute, every upcoming
 * slot (a schedule's nextRunAt) is "armed" as a delayed Vercel Queues
 * message that becomes visible exactly at that time. The private consumer
 * /api/queues/report-timer then runs the normal dispatcher.
 *
 * Arming happens when a schedule is saved, after every cron tick and after
 * every timer run (which arms the following day's slot or a failure retry),
 * so the chain keeps itself going; the hourly cron stays as the safety net.
 *
 * Every step is idempotent: messages use an idempotency key per slot, and
 * dispatchDueReports() delivers a slot at most once no matter how many
 * timers / ticks fire for it.
 *
 * Only active on Vercel (where Queues authenticates automatically through
 * OIDC). Locally `npm run scheduler` keeps doing the job. Arming never
 * throws — if Queues is unavailable the hourly cron still delivers.
 */

import { send } from "@vercel/queue";
import DB from "@app/_database/db";
import ScheduledReport from "@app/_model/scheduledReport.model";

/** Must match the consumer trigger topic in vercel.json. */
export const REPORT_TIMER_TOPIC = "report-timers";

/** Only slots this close are armed; later ones are armed by a later tick or timer. */
const ARM_HORIZON_MS = 24 * 60 * 60 * 1000;
/** Fire slightly after the slot so the dispatcher always sees it as due. */
const FIRE_AFTER_SLOT_S = 2;
/** How long an armed message stays deliverable after its slot. */
const RETENTION_AFTER_SLOT_S = 6 * 60 * 60;
const MAX_RETENTION_S = 7 * 24 * 60 * 60;

export interface ReportTimerMessage {
  scheduleId: string;
  /** ISO time of the slot (the schedule's nextRunAt when armed). */
  fireAt: string;
}

export function reportTimersEnabled(): boolean {
  return !!process.env.VERCEL && process.env.REPORT_PRECISE_TIMERS !== "off";
}

/**
 * Arm a delayed queue message for the next run of every enabled schedule due
 * within the horizon (or only the given schedules).
 */
export async function armReportTimers(params: { scheduleIds?: string[]; now?: Date } = {}): Promise<{
  armed: number;
  failed: number;
  enabled: boolean;
}> {
  if (!reportTimersEnabled()) return { armed: 0, failed: 0, enabled: false };

  try {
    await DB();
    const now = params.now || new Date();
    const schedules = await ScheduledReport.find({
      enabled: true,
      nextRunAt: { $ne: null, $lte: new Date(now.getTime() + ARM_HORIZON_MS) },
      ...(params.scheduleIds ? { _id: { $in: params.scheduleIds } } : {}),
    })
      .select("_id nextRunAt")
      .lean();

    const results = await Promise.allSettled(
      schedules.map((s) => {
        const fireAt = new Date(s.nextRunAt as Date);
        const delaySeconds = Math.max(0, Math.ceil((fireAt.getTime() - now.getTime()) / 1000)) + FIRE_AFTER_SLOT_S;
        const message: ReportTimerMessage = { scheduleId: String(s._id), fireAt: fireAt.toISOString() };
        return send(REPORT_TIMER_TOPIC, message, {
          delaySeconds,
          retentionSeconds: Math.min(MAX_RETENTION_S, delaySeconds + RETENTION_AFTER_SLOT_S),
          // Re-arming the same slot (every tick / save) is dropped by Queues.
          idempotencyKey: `report-timer:${message.scheduleId}:${message.fireAt}`,
        });
      })
    );

    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    if (failed.length > 0) {
      console.error(
        `[reportTimers] could not arm ${failed.length}/${results.length} timer(s) — the hourly cron will still deliver:`,
        (failed[0].reason as Error)?.message || failed[0].reason
      );
    }
    return { armed: results.length - failed.length, failed: failed.length, enabled: true };
  } catch (error) {
    console.error("[reportTimers] arming skipped — the hourly cron will still deliver:", (error as Error)?.message);
    return { armed: 0, failed: 0, enabled: true };
  }
}
