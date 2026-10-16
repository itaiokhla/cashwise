# Intertech CashWise

Expense, cash and voucher management (Next.js 15 + MongoDB).

## Local development

```bash
npm install
cp .env.example .env     # fill in MongoDB, JWT, ImageKit and Gmail values
npm run dev              # http://localhost:3000
npm run scheduler        # optional: sends due automated reports every minute
```

### Test data for reports

```bash
npm run seed:reports                                  # 8,000 expense claims + 2,000 credits over the last 120 days
npm run seed:reports -- --expenses=3000 --credits=500 --days=60
npm run seed:reports -- --clean                       # remove it again
```

Claims cover every expense type and category, a realistic approved/pending/rejected mix and several
employees; each claim also books the matching debit (as the app does), so cash-in-hand figures are real.
Re-running replaces the previous batch; existing data is never touched.

## Automated expense reports

Configured in **Settings → Automated Reports** (admin/manager). Each schedule has:

| Setting | Options |
|---|---|
| When | Daily, weekly (pick the weekday) or monthly (pick the day, or "last day"), at a time in a chosen time zone |
| Contents | One day, one week, one month, or **day + week-to-date + month-to-date** in one email |
| Period | *Up to send time* (today / this week / this month so far) or *last complete period* (yesterday / last week / last month) |
| Data | All expenses, cash & expenses (adds cash received/spent and cash-in-hand), office, travel, to-pay, credits or debits; optional employee/category filters |
| Delivery | Recipients, link validity (1–30 days), attach PDF + Excel |

Each email contains the totals for every section, a secure link to an interactive, mobile-friendly
report page (filters, category/employee breakdowns, WhatsApp/email sharing), and **Download PDF /
Download Excel** buttons. The same files are attached to the email.

Calculation rules, used identically by the email, PDF, Excel and web page (`app/_lib/reportDigest.ts`):

- **Total expenses = approved + pending.** Rejected claims are listed and totalled separately, never counted.
- **Cash received = credits, cash spent = debits, cash in hand = credit − debit** (same as the account screens).
  Every submitted expense also books a debit, so expense and debit totals are never added together.
- Dates are calendar days in the schedule's time zone (default Asia/Kolkata), never the server's UTC.

### How delivery works (and why the deploy used to fail)

Vercel's **Hobby** plan rejects any cron job that runs more than once a day, so the old
`"* * * * *"` entry in `vercel.json` made every deployment fail. Hobby also fires a daily job at
some point within its scheduled hour.

`vercel.json` now registers **24 daily jobs** (one per hour, all calling `/api/cron/expense-reports`),
which is within Hobby's limit of 100 once-a-day jobs and gives an hourly check. Every check sends each
schedule's most recent slot that has passed and was not delivered yet, exactly once:

- report dates always come from the scheduled slot, so a late check still reports the right day;
- missed checks are caught up (one email for the latest slot, never a burst);
- duplicate/overlapping checks are harmless (atomic lock + one-delivery-per-slot key);
- failures retry every ~10 minutes, up to 3 attempts per slot, and are shown in Settings.

**On-time delivery on Hobby (Vercel Queues timers).** Because Hobby runs each hourly job at a random
minute, the hourly check alone delivered a 7:00 PM report anywhere up to ~1.5 hours late. Each schedule's
next run is therefore also armed as a delayed [Vercel Queues](https://vercel.com/docs/queues) message
(`app/_lib/reportTimers.ts`) that becomes visible at the exact minute and is handled by the private
consumer `/api/queues/report-timer` (registered under `functions` in `vercel.json`). Timers are armed
when a schedule is saved, after every hourly check and after every timer run (next day's slot, retries),
so emails arrive within about a minute of the scheduled time. The hourly cron stays as the safety net.

- No setup needed: Queues is available on every plan (Hobby includes 1M operations/month; this uses a few
  thousand) and authenticates automatically on Vercel.
- Only active on Vercel; locally `npm run scheduler` checks every minute instead.
- Set `REPORT_PRECISE_TIMERS=off` to disable the timers and fall back to the hourly check only.
- Set `APP_URL` to your production domain so links in timer-sent emails use it.

### Deploying to Vercel

Three things previously stopped deployments; all are fixed in the repo:

1. **Cron frequency** — see above (`vercel.json`).
2. **Node.js version** — Vercel discontinued Node 20 on 1 Oct 2026. `package.json` → `engines.node`
   (`20.x || 22.x || 24.x`) makes Vercel build on Node 24 even if the project setting still says 20.x,
   while local Node 20 keeps working.
3. **Dependency install** — the app uses React 19 but some UI libraries still declare React 18 peers, so a
   clean `npm install` failed with `ERESOLVE`. `.npmrc` sets `legacy-peer-deps=true` (the lockfile was
   already resolved this way).

Set these **Environment Variables** in the Vercel project (Production):

| Variable | Notes |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (allow Vercel IPs / `0.0.0.0/0` in Atlas network access) |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `CRON_SECRET` | Random string, 16+ chars. Vercel sends it automatically to cron jobs; requests without it are rejected |
| `EMAIL_USER`, `EMAIL_PASS` | Gmail address + 16-character **App Password** |
| `SMTP_HOST`, `SMTP_PORT` | `smtp.gmail.com`, `587` |
| `APP_URL` | Public URL used in emailed links, e.g. `https://cashwise.example.com` (defaults to the request's domain) |
| `IMAGEKIT_*` | Uploads; also keeps a permanent copy of each emailed PDF for the Settings history |

After deploying, open **Settings → Automated Reports**: the status card shows when the scheduler last
ran ("via Vercel Cron"). Use **Send test** in the schedule editor to check email delivery immediately.
