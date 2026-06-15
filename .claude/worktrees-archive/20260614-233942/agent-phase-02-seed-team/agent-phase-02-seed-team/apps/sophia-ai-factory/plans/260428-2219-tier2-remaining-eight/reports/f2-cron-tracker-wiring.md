# F2 — Cron Run-Tracker Wiring Report

**Status:** Complete  
**Build:** pass (0 errors)  
**Tests:** 1673/1673 pass

## Routes Wired (15 total)

| cron_name | schedule | idempotency_window | notes |
|---|---|---|---|
| clearance-promote | `0 0 * * *` daily midnight | 12h (43_200_000) | mutating — strict window; D1 direct via getD1Binding() |
| daily-rollup | `0 1 * * *` daily 01:05 | 12h (43_200_000) | D1 via getD1() helper (rollup uses own service) |
| dunning-advance | `0 1 * * *` daily | 12h (43_200_000) | uses createServerClient() + getD1() for tracker |
| email-drip | `0 4 * * *` daily | 12h (43_200_000) | uses createServerClient() + getD1() for tracker |
| error-digest | `0 5 * * *` daily | 12h (43_200_000) | uses globalThis.DB (D1Binding interface); cast to D1Database |
| hourly-rollup | `5 * * * *` hourly | 30m (1_800_000) | D1 via getD1() helper |
| llm-cache-purge | `0 7 * * *` daily | 12h (43_200_000) | uses globalThis.DB (D1Binding interface); cast to D1Database |
| local-mode-health | `*/15 * * * *` every 15m | 5m (300_000) | D1 direct via getDb(); tracker inside handler() |
| scheduled-campaigns | `0 3 * * *` daily | 12h (43_200_000) | uses createServerClient() + getD1() for tracker |
| subscription-reminders | `0 2 * * *` daily | 12h (43_200_000) | uses createServerClient() + getD1() for tracker |
| uptime-check | `*/5 * * * *` every 5m | 2m (120_000) | getD1() helper; records failure on unhealthy/unreachable |
| usage-export | `5 * * * *` hourly | 30m (1_800_000) | records failure if any license failed |
| wallet-rebuild | `10 * * * *` hourly | 30m (1_800_000) | mutating — strict window; getD1Binding() nullable |
| weekly-signals-digest | `0 6 * * 1` weekly Monday | 3d (259_200_000) | uses existing getD1() from weekly-digest-delivery |
| workflow-stepper | `*/1 * * * *` every 1m | 30s (30_000) | D1 direct via getDb(); tracker after batch completes |

## D1 Binding Strategy

Routes split into two groups based on existing patterns:

- **globalThis.DB direct** (error-digest, llm-cache-purge, heartbeat): Use existing `D1Binding` interface, cast via `as unknown as D1Database` for tracker
- **getD1() helper** (all others): New nullable helper reads `globalThis.__env.DB` then `__D1_DB` fallback; tracker skipped if DB unavailable (fail-open)

## Special Handling

- `error-digest` / `llm-cache-purge`: Existing `D1Binding` interface differs from `D1Database` — safe cast applied; run-tracker uses `.prepare().bind().first()` which both interfaces support
- `local-mode-health`: Kept `runHealthCheck()` as pure function (exported for tests); tracker only in `handler()` so tests aren't affected
- `uptime-check`: Records `'failure'` status when health check detects degraded/unreachable, not just on exceptions
- `usage-export`: Records `'failure'` if any license export failed (partial failure)
- `weekly-signals-digest`: Reuses existing `getD1()` from `weekly-digest-delivery.ts` module (no duplication)
- `workflow-stepper`: Tracker called after full batch completes; individual workflow errors don't trigger failure status
