/**
 * scripts/scheduler.js
 *
 * Local development stand-in for Vercel Cron.
 * Calls /api/cron/expense-reports every 60 seconds so scheduled reports are
 * delivered while `npm run dev` / `npm start` is running on your machine.
 *
 * In production Vercel Cron calls the same endpoint (see vercel.json); an
 * external pinger can be added for minute-accurate delivery on the Hobby plan.
 * Every call is idempotent — running this alongside Vercel Cron never sends
 * a report twice.
 *
 * Usage:
 *   npm run scheduler
 *
 * Environment variables (read from .env):
 *   CRON_URL     - full URL to the cron endpoint (default: http://localhost:3000/api/cron/expense-reports)
 *   CRON_SECRET  - must match the server's CRON_SECRET (optional in development)
 */

require("dotenv").config();

const INTERVAL_MS = 60 * 1000;
const CRON_URL = process.env.CRON_URL || `http://localhost:${process.env.PORT || 3000}/api/cron/expense-reports`;
const CRON_SECRET = process.env.CRON_SECRET || "";

console.log("==================================================");
console.log("⏰ CASHWISE LOCAL REPORT SCHEDULER");
console.log(`Target:   ${CRON_URL}`);
console.log(`Interval: every 60 seconds`);
console.log(`Secret:   ${CRON_SECRET ? "configured" : "not configured (accepted in development only)"}`);
console.log("Press Ctrl+C to stop.");
console.log("==================================================");

async function triggerCron() {
  const timestamp = new Date().toLocaleTimeString("en-IN", { hour12: false });
  try {
    const headers = { "x-cashwise-scheduler": "local" };
    if (CRON_SECRET) headers.Authorization = `Bearer ${CRON_SECRET}`;

    const res = await fetch(CRON_URL, { headers });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      console.error(`[${timestamp}] ❌ Rejected — CRON_SECRET here does not match the server`);
      return;
    }
    if (!res.ok) {
      console.error(`[${timestamp}] ❌ ${res.status}: ${data.message || "scheduler error"}`);
      return;
    }

    const s = data.summary || {};
    console.log(
      `[${timestamp}] ✅ ${s.totalSchedules ?? 0} checked · ${s.processedCount ?? 0} sent · ${s.failedCount ?? 0} failed · ${s.skippedCount ?? 0} skipped`
    );
    for (const r of data.results || []) {
      if (r.status === "sent") console.log(`  ✔ ${r.name}: ${r.recordCount} records → ${r.shareUrl}`);
      else if (r.status === "failed") console.error(`  ✖ ${r.name}: ${r.reason} (retry at ${r.nextRunAt})`);
    }
  } catch (err) {
    console.log(`[${timestamp}] Server not reachable at ${CRON_URL} (${err.message}). Retrying in 60s…`);
  }
}

setTimeout(triggerCron, 3000);
setInterval(triggerCron, INTERVAL_MS);
