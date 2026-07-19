# Scout Report — Round 11 (Perf/Cost/Observability)

**Date:** 260509-0421
**Branch:** main @ cfd2571a (Wave 8 LIVE)
**Scope:** perf/cost/observability pivot (operational corners deferred per Round-10)
**Working dir:** /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory

Verified live: prod URL probe confirmed 5 of 16 findings via curl + wrangler.toml read. Bundle inspected from .open-next/.

---

## TOP-6 RANKED (cost-bomb / cost-savings)

### F-PC-1 — Public marketing pages bypass CDN (P0)
**Location:** `next.config.ts:97-105` headers() rule vs runtime
**Evidence:** Live probe shows `/pricing`, `/guide`, `/blog`, `/privacy` returning `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`. Only `/status` (which has `export const revalidate = 60`) cached at edge (`s-maxage=60, stale-while-revalidate=31535940`). Homepage `/` cached `s-maxage=60` correctly. Headers rule pattern `/(|en|vi)(|/pricing|...)` not matching due to next-intl middleware re-emitting Cache-Control or pages being dynamic by default.
**Impact:** Every pricing/guide/blog/privacy hit = full Worker invocation. ~10K hits/mo at $0.50/M = ok now, but ramps with traffic. Worse: TTFB 290ms instead of <50ms edge.
**Fix:** Add `export const revalidate = 60` to each public page (`[locale]/pricing/page.tsx`, `[locale]/guide/...`, `[locale]/blog/...`, `[locale]/privacy/page.tsx`, `[locale]/terms/page.tsx`). Verify next.config redirect pattern doesn't match before next-intl rewrites.
**Effort:** S

### F-PC-2 — publishTokenRefreshCron 30min cycle wastes Inngest invocations (P1)
**Location:** `src/forest/inngest/functions/publish-execute.ts:325-334`
**Evidence:** `{ cron: '*/30 * * * *' }` = 48 invocations/day. Function only refreshes tokens expiring within ONE_HOUR_S (3600). With ~0-2 active publishing channels per user, most cron runs do zero work. Uses `getD1Raw` + SELECT FROM publishing_channels every 30min unconditionally.
**Impact:** 1,440 Inngest steps/mo doing no work. Each step = D1 SELECT + Worker compute. Switch to hourly = 50% reduction. Switch to event-driven on token-issue = 95%.
**Fix:** Change cron to `0 * * * *` (hourly) OR delete cron + schedule per-token via `inngest.send` with delayed event when channel created.
**Effort:** S (cron change) / M (event-driven)

### F-PC-3 — uptime-check cron probes D1+R2+KV every 5min (P1)
**Location:** `src/app/api/cron/uptime-check/route.ts:17-65` + `src/app/api/health/route.ts:36-77`
**Evidence:** wrangler.toml cron `*/5 * * * *` → /api/cron/uptime-check → fetches /api/health → probeD1 + probeR2 + probeKv = 3 binding ops × 288/day = 864 ops/day for self-monitor alone. Plus tracker.recordCheck writes status_checks row each run = 288 D1 writes/day.
**Impact:** ~26K self-monitor D1+R2+KV ops/mo + 8.6K status_checks rows/mo = D1 storage cost grows ~2.6MB/mo just from monitoring. Better Stack heartbeat already covers same thing.
**Fix:** Reduce to */15 (3x reduction) OR have uptime-check just curl `/` (HTML probe, no binding probe). Add TTL/retention on status_checks (delete >30d).
**Effort:** S

### F-PC-4 — Zero `next/dynamic()` usage = full client bundle on every page (P1)
**Location:** `src/app/**/*.tsx` — grep `dynamic\(.*import` returned 0 matches
**Evidence:** No code-splitting via dynamic imports. Heavy components (charts, video player, Telegram bot UI, setup wizard 503-LOC, onboarding-tour 243-LOC) all eagerly bundled. Homepage downloads 314KB raw HTML — but client JS chunks not measured here. Combined with no split, dashboard route likely ships entire app's component tree.
**Impact:** Cold-load LCP penalty. Mobile 3G users wait extra ~2-4s. Worker bundle larger = more memory per invocation.
**Fix:** Add `dynamic(() => import('./HeavyComponent'), { ssr: false })` for setup wizard, onboarding tour, charts, video preview. Target top-5 heaviest components first.
**Effort:** M

### F-PC-5 — 35 console.* calls in 12 production-path files (P2)
**Location:** `src/lib/telemetry/logger.ts:1`, `src/lib/feature-flags/index.test.ts:1`, `src/forest/worker/lib/enrichment-logger.ts:1`, `src/sdk/index.ts:1`, `src/seed/components/dashboard/dashboard-error-boundary.tsx:1`, `src/seed/utils/logger-internals.ts:3`, `src/tree/audit/crypto-utils-signing.ts:1`, `src/app/api/webhooks/telegram/route.ts:1`, +4 SDK example files
**Evidence:** Round-10 noted 26 console.log; current count is 35 across 12 files (per Grep). Some are SDK examples (acceptable) but `dashboard-error-boundary.tsx`, `crypto-utils-signing.ts`, and `webhooks/telegram/route.ts` log on every error in production. CF Worker stdout is captured by Workers Logs ($0.40/M logs after 200K/day free).
**Impact:** With telegram webhook traffic + error boundary fires, est 5-20K logs/day exceedable in growth. Logs cost + PII leak risk in error contexts.
**Fix:** Replace remaining production-path console.* with `logger.error()` (already exists). Keep SDK examples as-is. Add eslint `no-console` with `allow: ['warn']` and per-file overrides.
**Effort:** S

### F-PC-6 — Sentry tracesSampleRate=0.1 + Replay=0.1 on free tier ceiling (P1)
**Location:** `sentry.client.config.ts:16,19`, `sentry.server.config.ts:11`, `sentry.edge.config.ts:11` (0.05)
**Evidence:** Two Sentry config sources exist: top-level configs hard-code `tracesSampleRate: 0.1` while `src/lib/observability/sentry-options.ts:60,79,96` exports buildClientOptions with same 0.1 prod / 1.0 dev. Plus `replaysSessionSampleRate: 0.1` = 10% of all sessions recorded. Sentry free tier = 10K transactions + 50 replays/mo. At 5K MAU baseline, 10% sampling × ~20 page views = 10K txn/day → quota burned in <1 day.
**Impact:** Either silent quota throttling (lose error visibility) or surprise bill. Replay 0.1 is extremely high for paid plans too.
**Fix:** Drop client traces to 0.02, server to 0.05, replay session to 0.01 (1%). Keep replaysOnErrorSampleRate = 1.0 (cheap, valuable). Consolidate to single source: top-level configs should import from `lib/observability/sentry-options.ts`.
**Effort:** XS

---

## ADDITIONAL FINDINGS (P2/lower)

### F-PC-7 — OpenNext server-functions/ = 159MB pre-bundle (P2)
**Location:** `.open-next/server-functions/default/node_modules/`
**Evidence:** Raw deps before Worker bundle. Wrangler upload artifact (after bundling) is sub-10MB but build directory bloat slows local rebuilds + CI scratch space. styled-jsx, next/dist/experimental/testmode, next/dist/trace all present.
**Fix:** Audit `serverExternalPackages` config + add `next/experimental/testmode` to externals. Add `.open-next/.gitignore` already exists.
**Effort:** S

### F-PC-8 — Missing composite indexes on hot D1 tables (P1)
**Location:** `migrations/0073-email-outbox.sql`, `migrations/0078-webhooks.sql`, `migrations/0072-payos-events.sql`
**Evidence:** 205 indexes across 82 migrations BUT search shows no composite `(user_id, created_at DESC)` on usage_events / email_outbox / webhook_attempts / nowpayments_events. Hot dashboard queries (recent N events for user) likely full-scan or single-column index then filesort.
**Fix:** Audit query plans for /dashboard, /api/raas/usage, /api/v1/webhooks/[id]/attempts via `EXPLAIN QUERY PLAN`. Add composite indexes where SCAN appears.
**Effort:** M

### F-PC-9 — Cache-Control header missing on /api/health (P2)
**Location:** `src/app/api/health/route.ts:6` (returns NextResponse.json with no Cache-Control)
**Evidence:** Live probe shows no cache-control header on /api/health. With uptime-check cron + external monitors + load balancer probes hitting it every 30-60s, no `Cache-Control: public, max-age=10` means each probe pays full D1+R2+KV probe latency.
**Fix:** Add `Cache-Control: public, max-age=10, stale-while-revalidate=30` for unauthenticated path. Authenticated path keep no-cache (admin needs fresh status).
**Effort:** XS

### F-PC-10 — KV writes in middleware-path emitUsageEvent (P2)
**Location:** `src/middleware.ts:7` imports from `@/forest/usage-metering`, traced through to `src/forest/usage-metering/realtime-tracker-kv-ops.ts:33`
**Evidence:** Every authenticated request triggers `emitUsageEvent` → eventually `kv.set('usage:userId:nonce', ...)` via Upstash Redis (redisHelpers). 1 write per request × 10K requests/day = 10K Upstash writes/day. Free tier = 10K commands/day = at-or-over limit.
**Fix:** Already has `getKvClient() == null` guard — verify Upstash truly disabled in prod, OR batch via batch-buffer.ts (already exists but middleware bypasses). Move emit to non-blocking/sampled.
**Effort:** M

### F-PC-11 — Sentry double-init (P2)
**Location:** Top-level `sentry.{client,server,edge}.config.ts` + `src/lib/observability/sentry-options.ts`
**Evidence:** Two Sentry init paths exist. Top-level files call `Sentry.init` directly. lib/observability exports builders. Tests in `sentry-options.test.ts` exist but top-level configs don't use them. Risk: double-instrumentation or drift in sample rates.
**Fix:** Make top-level configs thin wrappers around `buildClientOptions()` etc.
**Effort:** XS

### F-PC-12 — status_checks unbounded retention (P2)
**Location:** `src/app/api/cron/uptime-check/route.ts` calls `recordCheck` every 5min, no purge cron
**Evidence:** 288 rows/day × 365 days = 105K rows/year/cron source. Multiple cron sources (uptime, heartbeat, status-rollup) compound. No DELETE WHERE ts < datetime('now','-30 days') job found.
**Fix:** Add daily purge to existing `cron/status-rollup` or new lightweight cron deleting >30d rows.
**Effort:** XS

---

## STATE-OF-DASHBOARD SUMMARY

Sophia AI Factory @ Wave 8 has solid functional ground but visible cost-leak surface. Primary risks: (1) public marketing pages are NOT actually CDN-cached despite next.config rule — every /pricing /guide /blog hit pays 290ms TTFB + Worker invocation cost; (2) self-monitoring cron-uptime hits D1+R2+KV every 5min producing ~26K binding-ops/mo for zero user value; (3) zero `next/dynamic()` usage across `src/app` means client bundles aren't split — likely 300-500KB initial JS on dashboard; (4) Sentry sampling at 0.1 client + 0.1 replay session is paid-plan-territory pricing on what reads as a free-tier project. Net: monthly Cloudflare/Sentry/Upstash burn is probably 2-4x what it needs to be at current ~5K MAU baseline. Quick wins: F-PC-1 page revalidate + F-PC-6 Sentry sample drop = ~1 hour of work, single-digit-USD/mo savings now but compounding 10x at 50K MAU.

## UNRESOLVED QUESTIONS

- F-PC-1: Why doesn't `next.config.ts` headers() rule for `/(|en|vi)(|/pricing|...)` apply to /pricing? Is next-intl middleware overriding? Need build-time investigation.
- F-PC-8: Need actual `EXPLAIN QUERY PLAN` from prod D1 to confirm missing composite indexes — not just absence-by-grep.
- F-PC-10: Is Upstash actually enabled in prod or is Redis null? Round-10 noted "no Upstash" but middleware imports it.
- Bundle analysis (`ANALYZE=true npm run build`) not run — F-PC-4 magnitude is estimate.
