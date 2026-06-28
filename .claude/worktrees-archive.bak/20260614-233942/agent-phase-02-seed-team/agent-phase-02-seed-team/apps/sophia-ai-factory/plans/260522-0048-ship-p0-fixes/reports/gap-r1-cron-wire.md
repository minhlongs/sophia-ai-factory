# GAP-R1 Fix Report — Wire d1-backup into CRON_ROUTES

**Date:** 2026-05-22
**File modified:** `scripts/inject-scheduled-handler.mjs`

## Root Cause

`CRON_ROUTES` in `inject-scheduled-handler.mjs` omitted `'0 5 * * *'` → `/api/cron/d1-backup`.
`wrangler.toml:64` includes `"0 5 * * *"` in the `crons` array, so CF Workers fires the event
daily at 05:00 UTC, but `__cronRouteMap[event.cron]` returned `[]` — no dispatch, no log entry.

## CRON_ROUTES Diff

```diff
  // Hourly — recompute handover status (active/at_risk/churned)
  '7 * * * *': [
    '/api/cron/handover-status-sync',
  ],
+  // Daily 05:00 UTC — D1 database backup to R2 `sophia-backups` bucket (GAP-R1 fix 2026-05-22)
+  '0 5 * * *': [
+    '/api/cron/d1-backup',
+  ],
 };
```

## Route Existence Verified

`routeExists('/api/cron/d1-backup')` resolves to:
`src/app/api/cron/d1-backup/route.ts` — file confirmed present.

## Inject Script Dry-Run Output

```
[inject-scheduled] Injected scheduled() handler into default export: 14 patterns, 18 routes.
[inject-scheduled] Done.
```

- Before fix: 13 patterns, 17 routes
- After fix: 14 patterns, 18 routes (+1 pattern `0 5 * * *`, +1 route `d1-backup`)

## Grep Proof — worker.js After Injection

```
Line 26:  "0 5 * * *": ["/api/cron/d1-backup"]
Line 7:   async scheduled(event, env, ctx) { return __cronScheduledHandler(event, env, ctx); }
Line 12:  const __cronRouteMap = {
Line 32:  const routes = __cronRouteMap[event.cron] ?? [];
```

## Auth

The route uses `verifyCronAuth(request)` from `@/seed/security/cron-auth` which accepts:
- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>` header
- `?token=<CRON_SECRET>` query param

The inject handler sends `Authorization: Bearer ${env.CRON_SECRET}` — matches what `verifyCronAuth` accepts.

## Build Status

`npm run build` (next build) fails with pre-existing ENOENT on stale `.next` cache artifact —
unrelated to this fix (confirmed by running without the change: same exit code 1).
Inject script itself exits 0 cleanly.

## Pattern Assignment Rationale

`0 5 * * *` (05:00 UTC daily) is in `wrangler.toml` crons but was unmapped in CRON_ROUTES.
The comment block lists it as P2/error-digest placeholder; `d1-backup` needs a daily trigger and
this slot is the natural assignment (distinct from `0 3 * * *` used by scheduled-campaigns).
Cron pattern `0 3 * * *` in `scripts/dr/configure-upstash-qstash.sh` was the OLD external-cron
approach (pre-no-tech-doctrine). Now that CF cron trigger owns `0 5 * * *`, QStash setup is
optional/superseded.

## No Unresolved Questions
