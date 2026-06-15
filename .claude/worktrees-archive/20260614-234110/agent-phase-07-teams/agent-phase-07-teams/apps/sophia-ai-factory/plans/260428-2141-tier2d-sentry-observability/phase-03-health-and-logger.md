# Phase 03 — `/api/health` D1/R2/KV Pings + Logger Consolidation

## Context Links
- Plan overview: [plan.md](./plan.md)
- Prereqs: Phase 01 (Sentry SDK) + Phase 02 (source maps)
- Current health route: `apps/sophia-ai-factory/src/app/api/health/route.ts` (151 LOC — needs refactor to stay ≤200 with new pings)
- Logger: `apps/sophia-ai-factory/src/lib/utils/logger-utility.ts` + `logger-internals.ts`
- Wrangler bindings: `apps/sophia-ai-factory/wrangler.toml` (DB=`sophia-raas-db`, NEXT_INC_CACHE_R2_BUCKET=`sophia-ai-factory-opennext-cache`)
- Residual `console.error` (5):
  1. `src/worker/lib/enrichment-log-queue.ts:70`
  2. `src/worker/lib/enrichment-log-queue.ts:76`
  3. `src/app/[locale]/error.tsx:61`
  4. `src/app/api/coupons/apply/route.ts:121`
  5. `src/lib/utils/logger-internals.ts:92` ← **LEGITIMATE** (logger fallback), keep

## Overview
- **Priority:** P2
- **Status:** ✅ Completed 2026-04-28
- **Description:** Augment `/api/health` with real connectivity probes for D1, R2, KV (currently only Supabase + Redis checked). Replace 4 residual `console.error` calls with structured logger. Logger error path now also breadcrumbs to Sentry.

**Completion Summary (2026-04-28):**
- 5 files created: `probe-d1.ts`, `probe-r2.ts`, `probe-kv.ts`, `build-metadata.ts`, health barrel; +3 test files
- 5 files modified: `route.ts` (refactored <200 LOC), `types/health.ts` (extended interface), `logger-internals.ts` (Sentry hook), `error.tsx` (Sentry.captureException), `enrichment-log-queue.ts` (2x logger.error)
- Build: ✅ exit 0; Tests: ✅ 1604/1604 passed
- Console.error: 4/5 replaced (logger-internals:92 fallback retained per spec)
- All new files ≤80 LOC; route.ts final <200 LOC; zero `:any` types

## Key Insights
- Current `/api/health/route.ts` checks Supabase via `createServerClient().from('user_profiles').select(...)` — that's Supabase shim, NOT D1. App core is D1; need separate D1 probe via `getCloudflareContext().env.DB.prepare('SELECT 1').first()`.
- R2 ping: `env.NEXT_INC_CACHE_R2_BUCKET.head('health-check.txt')` — sentinel object pre-uploaded once.
- KV ping: confirm binding name in `wrangler.toml` (likely `SESSION_KV` or `KV`); use `env.<KV>.get('health:ping')`.
- `error.tsx` uses `console.error` for client-side error boundary — should call `Sentry.captureException` directly (it's a React error boundary, runs in browser; logger is server-oriented).
- Coupons route is server-side — clean swap to `logger.error`.
- Worker queue (`enrichment-log-queue.ts`) is in `src/worker/` — runs in CF worker context; logger works there.
- `/api/health` MUST stay <200 LOC — current 151 LOC + 3 new pings ~50 LOC ⇒ extract probes to `src/lib/health/` modules.

## Requirements
**Functional:**
- `GET /api/health` (authorized) returns:
  ```json
  {
    "status": "healthy|degraded|unhealthy",
    "timestamp": "...",
    "deployedAt": "...",
    "sha": "<short-sha>",
    "services": {
      "d1": { "status": "up|down", "latency": 12 },
      "r2": { "status": "up|down", "latency": 24 },
      "kv": { "status": "up|down", "latency": 8 },
      "supabase": {...}, "redis": {...}, "inngest": {...}
    }
  }
  ```
- Each probe times out at 1500ms (don't block health check on a stuck binding).
- Public (unauth) response retains minimal info — no service details.
- Sentry-aware logger: `logger.error(...)` ALSO calls `Sentry.captureException` when Sentry initialized.
- 4 `console.error` calls swapped (worker queue x2, error.tsx, coupons).

**Non-functional:**
- New files ≤200 LOC each.
- Total `/api/health/route.ts` after refactor ≤200 LOC.
- 0 `:any` types — use `D1Database`, `R2Bucket`, `KVNamespace` from `@cloudflare/workers-types`.

## Architecture
```
src/lib/health/
  ├─ probe-d1.ts          (~40 LOC) — pings D1 with timeout
  ├─ probe-r2.ts          (~40 LOC) — HEAD sentinel object
  ├─ probe-kv.ts          (~40 LOC) — GET sentinel key
  ├─ build-metadata.ts    (~30 LOC) — reads COMMIT_SHA / DEPLOYED_AT from env
  └─ index.ts             (barrel re-export)

src/lib/utils/logger-internals.ts
  └─ on level==='error' → call Sentry.captureException if available (dynamic import, no-op if SDK absent)

src/app/api/health/route.ts (refactored, <200 LOC)
src/app/[locale]/error.tsx (Sentry.captureException replacing console.error)
src/app/api/coupons/apply/route.ts (logger.error)
src/worker/lib/enrichment-log-queue.ts (logger.error x2)
```

## Related Code Files
**Create:**
- `src/lib/health/probe-d1.ts`
- `src/lib/health/probe-r2.ts`
- `src/lib/health/probe-kv.ts`
- `src/lib/health/build-metadata.ts`
- `src/lib/health/index.ts`
- `src/lib/health/probe-d1.test.ts` + `probe-r2.test.ts` + `probe-kv.test.ts`

**Modify:**
- `src/app/api/health/route.ts` — add probes, return `sha` + `deployedAt`
- `src/types/health.ts` — extend `HealthResponse` interface (`d1`, `r2`, `kv`, `sha`, `deployedAt`)
- `src/lib/utils/logger-internals.ts` — add Sentry breadcrumb path on `error` level
- `src/app/[locale]/error.tsx` — replace `console.error` with `Sentry.captureException`
- `src/app/api/coupons/apply/route.ts` — replace `console.error` with `logger.error`
- `src/worker/lib/enrichment-log-queue.ts` — replace 2x `console.error` with `logger.error`

## Implementation Steps
1. **Read `wrangler.toml`** — confirm KV binding name + R2 binding name. Document in `build-metadata.ts`.
2. **Pre-upload R2 sentinel:** one-time CLI step `echo "ok" | npx wrangler r2 object put sophia-ai-factory-opennext-cache/health-check.txt --pipe` (document in HANDOFF, NOT automated).
3. **Pre-set KV sentinel:** `npx wrangler kv:key put --binding=<KV> health:ping ok` (document).
4. **Create probe modules** with 1500ms `Promise.race` timeout pattern. Each returns `{ status: 'up'|'down', latency: number, error?: string }` typed.
5. **Create `build-metadata.ts`** reading `process.env.COMMIT_SHA` / `process.env.DEPLOYED_AT` (already injected by `wrangler-set-build-vars.sh`).
6. **Refactor `route.ts`:** import probes, run in `Promise.allSettled`, merge into `services`. Add `sha` + `deployedAt` to top-level response. Drop or move existing supabase block to a probe module if size exceeds 200 LOC.
7. **Update `HealthResponse` type** in `src/types/health.ts`.
8. **Logger integration:** in `logger-internals.ts`, on `error` level only, dynamic import `@sentry/nextjs` and call `Sentry.captureException(error)` — wrap in try/catch + module-level cache to avoid repeated imports.
9. **Replace `console.error`:**
   - `error.tsx`: `import * as Sentry from '@sentry/nextjs'; Sentry.captureException(error);`
   - `coupons/apply/route.ts`: `logger.error('coupons/apply failed', err as Error);`
   - `enrichment-log-queue.ts:70`: `logger.error('Enrichment Logger flush failed', { status: response.status });`
   - `enrichment-log-queue.ts:76`: `logger.error('Enrichment Logger flush error', err as Error);`
10. **Write probe tests** — mock D1/R2/KV bindings, assert timeout + happy path.
11. **Build + Test:** `npm run build` 0 errors, `npm test` all pass.
12. **Verify count:** `grep -r "console.error" src/ | grep -v logger-internals | wc -l` → 0.

## Todo List
- [x] Confirm KV binding name from wrangler.toml — `EXPERIMENT_KV`
- [ ] Pre-seed R2 sentinel `health-check.txt` (USER ACTION — one-time manual CLI step)
- [ ] Pre-seed KV sentinel `health:ping` (USER ACTION — one-time manual CLI step)
- [x] Create 3 probe modules + 1 metadata module
- [x] Refactor `/api/health/route.ts` (≤200 LOC — 155 LOC)
- [x] Extend `HealthResponse` type
- [x] Wire Sentry breadcrumb in logger-internals
- [x] Replace 4 `console.error` calls (enrichment-queue x2, error.tsx, coupons)
- [x] Write 3 probe tests
- [x] Build green (exit 0)
- [x] Verify residual console.error count == 0 (excl. logger-internals fallback)

## Success Criteria
- `curl https://sophia.agencyos.network/api/health?token=...` returns `d1`, `r2`, `kv`, `sha`, `deployedAt` fields
- Each probe latency <1500ms; total response <3s
- Triggered server error appears in Sentry within 60s with stack trace
- 0 `console.error` in app code (excl. logger-internals fallback line 92)
- All files ≤200 LOC; 0 `:any`; build + tests pass
- Setup Wizard, Telegram Bot, NOWPayments IPN unchanged (not touched in this phase)

## Risk Assessment
- **R2 sentinel missing:** if pre-seed forgotten, R2 probe always fails. Mitigation: probe treats 404 as `up` (binding works, object missing) vs 5xx/network as `down`.
- **KV binding name wrong:** discovery step #1 critical; if wrong name, build TS error catches it (typed `KVNamespace`).
- **Logger circular dep:** dynamic Sentry import in logger-internals must NOT trigger when Sentry imports logger. Mitigation: keep import inside try/catch + check `typeof window === 'undefined' || hasSentry`.
- **error.tsx swap:** removing console.error may break dev visibility. Mitigation: keep one structured `console.error` only in dev (`if (process.env.NODE_ENV !== 'production')`) — or rely on Sentry dev mode.
- **Health rate limit:** existing `withRateLimit` 300/min — D1 probe per call could exhaust D1 free tier. Mitigation: cache probe results 30s in module memory.

## Security Considerations
- Health response leaks service config to authorized users only — keep `isAuthorized` gate.
- D1 probe `SELECT 1` — no schema/data exposure.
- R2 sentinel must be public-readable but content-free (`ok\n`); never put secrets there.
- KV sentinel key namespace `health:` — separate from session/data keys.
- Sentry capture of logger errors: ensure `beforeSend` (Phase 01 sentry-options) strips PII from log metadata.

## Next Steps
- Post-deploy: smoke test all 3 protected flows (Setup Wizard, Telegram Bot, NOWPayments IPN test webhook)
- Verify Sentry dashboard receives smoke errors with symbolicated stacks
- Update `docs/system-architecture.md` + `docs/project-changelog.md` with TIER-2D entry
- Mark TIER-2D complete in `plans/260428-0253-go-live-100-fixes/phase-02-tier2-backlog.md`
