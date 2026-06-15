# Phase 06 — Public `/status` Page + Uptime Cron Aggregator

## Context Links
- `apps/sophia-ai-factory/src/app/api/cron/uptime-check/route.ts` — existing 5-min health pinger
- `apps/sophia-ai-factory/src/app/api/health/route.ts` — health endpoint
- `apps/sophia-ai-factory/src/components/dashboard/health-indicator.tsx` — internal pill
- Cloudflare Analytics binding — verify in `wrangler.toml`

## Overview
- **Priority:** P2
- **Status:** pending
- **Effort:** 45m

Build `/status` (no `[locale]` prefix — public, English-default with vi switch). Renders 90-day uptime grid (per-day green/yellow/red), current incident banner if active, last 5 resolved incidents. Data comes from new D1 table populated by extended `uptime-check` cron.

## Key Insights
- `uptime-check` already runs every 5 min and pings `/api/health` — extend to PERSIST result, not just alert
- 90 days × 288 checks/day = 25,920 rows max — small for D1, but daily rollup table makes status grid render fast
- Incident model: opened when 3 consecutive failures, closed on 3 consecutive successes
- Skip Cloudflare Analytics API integration for now (extra auth surface) — own data is sufficient

## Requirements
- Public `/status` route, no auth
- 90-day uptime grid (90 cells, color = uptime %)
- Current incident banner with severity + ETA (manually editable by admin)
- Last 5 resolved incidents with title + duration + post-mortem link
- JSON endpoint `/api/status.json` for badges/integrations
- Auto-refresh every 60s via `revalidate=60`

## Architecture
```
D1 tables:
  status_check (5-min granular, kept 30 days, auto-purged)
    id INTEGER PK, ts INTEGER, status TEXT, latency_ms INTEGER, error TEXT
  status_day_rollup (90 days)
    date TEXT PK, total_checks INTEGER, ok_checks INTEGER, p99_ms INTEGER
  status_incident
    id TEXT PK, started_at INTEGER, ended_at INTEGER, severity TEXT,
    title TEXT, description TEXT, postmortem_url TEXT

Routes:
  /[locale-optional]/status     Server Component, ISR 60s
  /api/status.json              public JSON
  /api/cron/uptime-check        EXTEND — record result + open/close incidents
  /api/cron/status-rollup       NEW — daily, rolls 5-min checks into day rollup, purges old
  /api/admin/incidents          admin CRUD (optional v1.1)
```

## Related Files
**Create:**
- `migrations/0068-status-tables.sql`
- `src/app/status/page.tsx` — locale-agnostic public route (place outside `[locale]` group)
- `src/app/status/uptime-grid.tsx` — 90-cell SVG/CSS grid
- `src/app/status/incident-card.tsx`
- `src/app/api/status.json/route.ts`
- `src/app/api/cron/status-rollup/route.ts`
- `src/lib/status/status-store.ts` — read/write helpers
- `src/lib/status/incident-state-machine.ts` — open/close logic

**Modify:**
- `src/app/api/cron/uptime-check/route.ts` — append `recordCheck()` + `evaluateIncidents()`
- `apps/sophia-ai-factory/wrangler.toml` — add daily rollup cron (one slot already at `"0 0 * * *"` daily — confirm allocation)

## Implementation Steps
1. Migration 0068 with the 3 tables + indexes on `(date)` and `(started_at)`
2. `status-store.ts` — `recordCheck`, `getDay(date)`, `getRollup(daysBack)`, `getActiveIncident`, `listResolvedIncidents(limit)`
3. `incident-state-machine.ts` — input: last N checks, current open incident; output: action (`open`, `close`, `noop`); criteria: 3 fails opens, 3 successes closes
4. Extend `uptime-check`: after current alert, call `recordCheck` + `evaluateIncidents`
5. Daily rollup cron at 00:05 UTC: aggregate previous day's `status_check` into `status_day_rollup`, then DELETE rows older than 30 days
6. `/status/page.tsx`: fetch `getRollup(90)` + active/resolved incidents; render grid + incident cards
7. `/api/status.json`: return `{status: 'operational'|'degraded'|'down', uptime90d: 99.97, incident: {...}|null}`
8. UI: 90 cells in 13×7 grid (90 days ≈ 13 weeks), color: green ≥99.5%, yellow 95-99.5%, red <95%, gray no-data
9. Style: minimal, brand color stripe, Tailwind

## Todo
- [ ] Migration 0068
- [ ] status-store + incident-state-machine + unit tests
- [ ] uptime-check extended (record + evaluate)
- [ ] Daily rollup cron + wrangler entry
- [ ] /status page + components
- [ ] /api/status.json
- [ ] No auth required on /status (verify middleware skip)
- [ ] Active incident banner renders if open
- [ ] 90-day grid renders with color thresholds

## Success Criteria
- `/status` accessible logged-out
- After 24h of running: uptime grid shows yesterday's day cell with correct color
- Trigger fake outage (set `HEALTH_FORCE_FAIL=1` env): incident opens after 3 checks (~15min), banner shown on /status
- Restore: incident auto-closes after 3 successes
- `/api/status.json` returns valid JSON consumable by external badges

## Risk Assessment
- **Public exposure**: ensure no internal hostnames, IPs, or stack traces leak in error column — sanitize before insert
- **Cron lag**: 5-min cadence means MTTD ~15min — acceptable for status page, real PagerDuty-style alerting handled by Telegram alert
- **Storage growth**: 30-day purge is enforced by rollup cron — verify DELETE runs

## Security Considerations
- Status page is read-only public data; no user inputs
- `error` column truncated to 200 chars + sanitized of secrets via regex (`/[a-z]{2,}_[A-Za-z0-9]{20,}/`)
- Admin incident editor (future) gated by Better Auth admin role + audit log

## Next
Phase 07 chains lifecycle emails on top of milestone events.
