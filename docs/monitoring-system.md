# Monitoring System

Autonomous daily monitoring for Google Ads campaigns across all tenants. Collects performance metrics, evaluates thresholds, surfaces actionable alerts in the UI, and logs every run for auditability.

## Architecture Overview

```
Google Ads API
     │
     ▼
scripts/collect-daily-metrics.ts   ← runs daily (cron or Claude Code scheduler)
     │
     ├── lib/db/monitoring.ts      → daily_metrics table (all campaigns, all levels)
     ├── lib/db/alerts.ts          → alert_events table (WARN + CRITICAL only)
     └── lib/db/agent-runs.ts      → agent_runs table (execution log)
               │
               ▼
         db/marketing.db           ← central SQLite database (gitignored)
               │
               ▼
     ui/src/routes/[tenant]/alerts    ← Alerts Inbox (SvelteKit)
     ui/src/routes/api/alerts/[id]    ← REST API for resolve/ignore
```

**Design principle:** flat-file JSON for editorial content (posts, campaigns), SQLite for operational/time-series data (metrics, alerts, run history).

---

## Database

**Location:** `db/marketing.db` (gitignored — never committed)  
**Engine:** SQLite via `better-sqlite3` (synchronous, works in both Node.js and Bun)  
**Migration:** `db/migrations/001_schema.sql` — runs automatically on first connection via `lib/db/index.ts`

### Tables

#### `daily_metrics`

One row per `(tenant, campaign_id, date)`. Upserted on every run — safe to re-run the same date.

| Column | Type | Description |
|---|---|---|
| `tenant` | TEXT | Client directory name (e.g. `portico`) |
| `campaign_id` | TEXT | Google Ads campaign ID |
| `date` | TEXT | `YYYY-MM-DD` — always yesterday by default |
| `impressions` | INTEGER | |
| `clicks` | INTEGER | |
| `cost_micros` | INTEGER | Cost in micros (divide by 1,000,000 for BRL) |
| `conversions` | REAL | |
| `budget_micros` | INTEGER | Daily budget in micros |
| `campaign_status` | TEXT | `ENABLED`, `PAUSED`, `REMOVED` |
| `serving_status` | TEXT | Google's serving status |
| `ad_groups` | TEXT | JSON array of `AdGroupMetrics` |
| `alerts` | TEXT | JSON array of all alerts (INFO + WARN + CRITICAL) |

#### `alert_events`

One row per alert occurrence. Only WARN and CRITICAL are written here — INFO stays in `daily_metrics.alerts` only.

| Column | Type | Description |
|---|---|---|
| `tenant` | TEXT | |
| `campaign_id` | TEXT | |
| `date` | TEXT | Date the alert applies to |
| `level` | TEXT | `WARN` or `CRITICAL` |
| `type` | TEXT | Alert type key (see Alert Types below) |
| `message` | TEXT | Human-readable description |
| `action_suggested` | TEXT | Suggested next step (nullable) |
| `resolved` | INTEGER | `0` = open, `1` = resolved, `2` = ignored |
| `resolved_at` | TEXT | ISO timestamp when dismissed |

#### `monthly_summary`

Aggregated by `(tenant, campaign_id, month)`. Populated by `scripts/consolidate-monthly.ts`.

| Column | Type | Description |
|---|---|---|
| `month` | TEXT | `YYYY-MM` |
| `total_cost_micros` | INTEGER | |
| `total_conversions` | REAL | |
| `days_active` | INTEGER | Days with impressions > 0 |
| `avg_cpa_micros` | INTEGER | |
| `weekly_breakdown` | TEXT | JSON array of weekly aggregations |

#### `agent_runs`

Execution log for every script invocation.

| Column | Type | Description |
|---|---|---|
| `agent` | TEXT | Script name (e.g. `collect-daily-metrics`) |
| `tenant` | TEXT | |
| `date` | TEXT | Date the run was for |
| `status` | TEXT | `success` or `error` |
| `output` | TEXT | Stdout summary (nullable) |
| `error` | TEXT | Error message if failed (nullable) |

---

## Collection Script

**File:** `scripts/collect-daily-metrics.ts`  
**Usage:**
```bash
bun run scripts/collect-daily-metrics.ts <tenant> [YYYY-MM-DD]
```

If the date argument is omitted, it defaults to **yesterday**.

### Step-by-step execution

**1. Load tenant config**

Reads `clients/<tenant>/brand.json`. Requires `google_ads_id` to be present. Merges `ads_monitoring` thresholds with defaults (see Configuration below).

**2. Query: all campaigns (structural)**

```sql
SELECT campaign.id, campaign.name, campaign.status,
       campaign.serving_status, campaign_budget.amount_micros
FROM campaign
WHERE campaign.status != 'REMOVED'
```

No date filter — always returns all active campaigns regardless of activity that day.

**3. Query: day metrics**

```sql
SELECT campaign.id, metrics.impressions, metrics.clicks,
       metrics.cost_micros, metrics.conversions
FROM campaign
WHERE campaign.status != 'REMOVED'
  AND segments.date = '<date>'
```

Date-filtered — campaigns with zero activity on that day are simply absent from this result. The script fills them with zeros by merging with the structural query.

**4. Query: ad group breakdown (per campaign)**

```sql
SELECT ad_group.id, ad_group.name, ad_group.status,
       metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
FROM ad_group
WHERE campaign.id = <id>
  AND segments.date = '<date>'
```

**5. Query: 7-day history (per campaign)**

```sql
SELECT segments.date, campaign.status, campaign.serving_status,
       metrics.impressions, metrics.conversions
FROM campaign
WHERE campaign.id = <id>
  AND segments.date DURING LAST_7_DAYS
ORDER BY segments.date DESC
```

Used exclusively for streak detection and trend context.

**6. Alert calculation** (ENABLED campaigns only)

See Alert Types below.

**7. Persist**

- `upsertDailyMetrics()` — writes all data to `daily_metrics` (all alert levels)
- `insertAlert()` — writes WARN and CRITICAL to `alert_events`
- `logAgentRun()` — records success/error in `agent_runs`

---

## Alert Types

Alerts are only calculated for campaigns with `status = ENABLED`.

### `no_conversions_streak`

Counts consecutive active days (days where the campaign was enabled AND had impressions > 0) with zero conversions.

| Streak | Level |
|---|---|
| ≥ `no_conversion_alert_days` | `WARN` |
| ≥ `no_conversion_alert_days × 2` | `CRITICAL` |

**Action suggested:** "Revisar keywords, landing page e bid strategy"

### `high_cpa`

Only fires when there are conversions on the target day (avoids false positives on zero-conversion days).

```
CPA = day_cost_brl / day_conversions
fires when: CPA > target_cpa_brl × max_cpa_multiplier
```

Level: always `WARN`.

**Action suggested:** "Pausar ad groups com menor desempenho, revisar lances"

### `budget_underpace`

Only fires when the campaign had impressions (i.e. was actually serving).

```
pace = cost_micros / budget_micros
fires when: pace < budget_underpace_threshold
```

Level: `INFO` only — stored in `daily_metrics.alerts` but not surfaced in the UI inbox.

### `low_impressions`

```
fires when: 0 < impressions < min_daily_impressions
```

Level: `INFO` only.

---

## Configuration

Thresholds live in `clients/<tenant>/brand.json` under the `ads_monitoring` key. All fields are optional — missing ones fall back to defaults.

```json
{
  "ads_monitoring": {
    "target_cpa_brl": 200,
    "no_conversion_alert_days": 3,
    "max_cpa_multiplier": 1.5,
    "min_daily_impressions": 50,
    "budget_underpace_threshold": 0.5
  }
}
```

| Field | Default | Description |
|---|---|---|
| `target_cpa_brl` | `100` | Target cost-per-conversion in BRL |
| `no_conversion_alert_days` | `3` | Days without conversion before WARN fires |
| `max_cpa_multiplier` | `1.5` | CPA threshold = target × multiplier |
| `min_daily_impressions` | `50` | Below this triggers INFO low_impressions |
| `budget_underpace_threshold` | `0.5` | Below 50% budget usage triggers INFO |

---

## Scheduling

### Option A — System crontab (recommended for production)

Runs independently of any Claude Code session. No AI tokens consumed.

```bash
crontab -e
```

```
3 7 * * * cd /home/rafhael/www/html/marketing && bun run scripts/collect-daily-metrics.ts portico >> /tmp/ads-monitor.log 2>&1
```

Add one line per tenant with an active `google_ads_id`.

### Option B — Claude Code CronCreate (convenience)

Fires a Claude Code prompt at 7:03am when a Claude session is open and idle. Consumes tokens. Session-only by default (does not survive restarts).

```
Job ID: 9738cc09 — Every day at 7:03 AM
Prompt: runs collect-daily-metrics.ts and reports a brief summary
```

---

## UI — Alerts Inbox

**Route:** `/[tenant]/alerts`  
**Nav:** Bell icon in the tenant layout header

### Page behavior

- Loads open alerts on server (`+page.server.ts` calls `getOpenAlerts(tenant)` synchronously)
- Sections: **CRITICAL** (red) → **WARN** (amber) → **History** (last 30 entries)
- Each card shows: alert type label, date, campaign ID, message, action suggested
- **Resolve** and **Ignore** buttons call the API and optimistically remove the card from the list

### API

`/api/alerts/[client_id]`

```
GET  /api/alerts/portico              → open alerts
GET  /api/alerts/portico?history=true → last 30 alerts (all statuses)
POST /api/alerts/portico              → { id: number, action: "resolved" | "ignored" }
```

---

## DB Module

**Location:** `lib/db/`  
**Runtime compatibility:** `better-sqlite3` (works in both Bun scripts and Node.js/SvelteKit SSR)

```typescript
import { getDb } from '../lib/db/index';         // singleton connection + auto-migrate
import { getOpenAlerts, insertAlert } from '../lib/db/alerts';
import { upsertDailyMetrics, getLastNDays } from '../lib/db/monitoring';
import { logAgentRun, getLastRun } from '../lib/db/agent-runs';
```

The singleton in `lib/db/index.ts` opens the database once, applies WAL mode and foreign keys, runs the migration file, and returns the same instance on every subsequent call.

The SvelteKit UI imports these modules via the `$db` Vite alias (configured in `ui/vite.config.ts`):

```typescript
import { getOpenAlerts } from '$db/alerts';
```

---

## Adding a New Tenant

1. Ensure `clients/<tenant>/brand.json` has `google_ads_id` set
2. Add `ads_monitoring` thresholds if the defaults don't fit the client
3. Add a crontab line for the tenant
4. The UI `/[tenant]/alerts` page works automatically — no code changes needed

---

## Monthly Consolidation

```bash
bun run scripts/consolidate-monthly.ts <tenant> [YYYY-MM]
```

Aggregates `daily_metrics` rows for the given month into `monthly_summary`. If no month is provided, defaults to the current month. Run at end of month or as needed before generating monthly reports.
