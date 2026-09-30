/**
 * scripts/scheduler.js
 *
 * Local development cron scheduler.
 * Calls /api/cron/expense-reports every 60 seconds.
 *
 * In production use Vercel Cron, AWS EventBridge, or a system cron
 * that hits this endpoint with the CRON_SECRET in the header.
 *
 * Usage:
 *   npm run scheduler
 *
 * Environment variables required:
 *   CRON_URL     - full URL to the cron endpoint (default: http://localhost:3000/api/cron/expense-reports)
 *   CRON_SECRET  - secret key to authenticate cron requests (must match server CRON_SECRET)
 */

const INTERVAL_MS = 60 * 1000; // 60 seconds
const CRON_URL = process.env.CRON_URL || "http://localhost:3000/api/cron/expense-reports";
const CRON_SECRET = process.env.CRON_SECRET || "";

if (!CRON_SECRET) {
  console.warn("⚠️  CRON_SECRET not set — requests will be accepted in dev mode only");
}

console.log("==================================================");
console.log("⏰ CASHWISE LOCAL REPORT SCHEDULER ACTIVE");
console.log(`Target:   ${CRON_URL}`);
console.log(`Interval: Every 60 seconds`);
console.log(`Secret:   ${CRON_SECRET ? "✅ configured" : "⚠️  not configured (dev only)"}`);
console.log("Press Ctrl+C to stop.");
console.log("==================================================");

async function triggerCron() {
  const timestamp = new Date().toLocaleTimeString("en-IN", { hour12: false });
  try {
    const headers = { "Content-Type": "application/json" };
    if (CRON_SECRET) {
      headers["x-cron-secret"] = CRON_SECRET;
    }

    const res = await fetch(CRON_URL, { headers });
    const data = await res.json();

    if (data.type === "UNAUTHORIZED") {
      console.error(`[${timestamp}] ❌ CRON_SECRET rejected — check environment variables`);
      return;
    }

    const { processedCount = 0, skippedCount = 0, totalSchedules = 0 } = data.summary || {};
    console.log(`[${timestamp}] ✅ Schedules: ${totalSchedules} total, ${processedCount} executed, ${skippedCount} skipped`);

    if (data.results && data.results.length > 0) {
      for (const r of data.results) {
        if (r.status === "success") {
          console.log(`  ✔ ${r.scheduleName || r.scheduleId}: ${r.recordCount} records, share: ${r.shareUrl || "n/a"}`);
        } else if (r.status === "failed") {
          console.error(`  ✖ ${r.scheduleName || r.scheduleId}: ${r.error}`);
        }
      }
    }
  } catch (err) {
    console.log(`[${timestamp}] Note: Dev server not reachable at ${CRON_URL} (${err.message}). Retrying in 60s...`);
  }
}

// Initial trigger after 3 seconds
setTimeout(triggerCron, 3000);

// Recurring interval
setInterval(triggerCron, INTERVAL_MS);
