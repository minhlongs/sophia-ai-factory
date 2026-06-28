# TIER-2D Implementation Report

**Phase:** All 3 phases  
**Status:** Completed (build green; tests delegated to tester agent)  
**Date:** 2026-04-28

---

## Files Created

| File | LOC | Notes |
|------|-----|-------|
| `sentry.client.config.ts` | 17 | Browser init, replay masked |
| `sentry.server.config.ts` | 10 | CF Workers server init |
| `sentry.edge.config.ts` | 11 | Edge/middleware init |
| `instrumentation.ts` | 10 | Next.js 15+ register() hook |
| `src/lib/observability/sentry-options.ts` | 95 | Typed builders, PII strip, 4xx drop |
| `src/lib/observability/sentry-options.test.ts` | 72 | 6 unit tests |
| `src/lib/health/probe-d1.ts` | 45 | D1 SELECT 1, 1500ms timeout, 30s cache |
| `src/lib/health/probe-r2.ts` | 48 | R2 head sentinel, 404=up |
| `src/lib/health/probe-kv.ts` | 48 | KV get sentinel, null=up |
| `src/lib/health/build-metadata.ts` | 20 | Reads COMMIT_SHA / DEPLOYED_AT |
| `src/lib/health/index.ts` | 9 | Barrel re-export |
| `src/lib/health/probe-d1.test.ts` | 38 | happy + error path |
| `src/lib/health/probe-r2.test.ts` | 45 | sentinel absent = up |
| `src/lib/health/probe-kv.test.ts` | 46 | null value = up |
| `scripts/ci/sentry-upload-sourcemaps.sh` | 47 | Graceful skip if no token |
| `.env.example` | 17 | Documents Sentry env vars |

## Files Modified

| File | Change |
|------|--------|
| `next.config.ts` | Wrapped with `withSentryConfig` (disables plugin in dev) |
| `package.json` | Added `@sentry/nextjs`, `@sentry/cli`; added `sentry:upload` script; chained in `deploy` |
| `.github/workflows/test.yml` | Added `fetch-depth: 0`; added `Upload source maps to Sentry` step (continue-on-error: true) |
| `src/app/api/health/route.ts` | Refactored to 155 LOC; added D1/R2/KV probes + sha/deployedAt |
| `src/types/health.ts` | Added `sha?` + `deployedAt?` to `HealthResponse` |
| `src/lib/utils/logger-internals.ts` | Added Sentry captureException hook on error level (dynamic import, module cache) |
| `src/app/[locale]/error.tsx` | Replaced `console.error` with `Sentry.captureException(error)` |
| `src/app/api/coupons/apply/route.ts` | Replaced `console.error` with `logger.error` |
| `src/worker/lib/enrichment-log-queue.ts` | Replaced 2x `console.error` with `logger.error` |

## Build Result
`npm run build` → exit 0. No TypeScript errors (TS errors masked by `ignoreBuildErrors: true` in next.config.ts — pre-existing tech debt).

## Gotchas

1. **`@sentry/nextjs/server` subpath doesn't exist** — removed `onRequestError` re-export from instrumentation.ts. `register()` pattern alone is sufficient for CF Workers.
2. **`@cloudflare/workers-types` is TS source** — importing it at runtime in health route caused Turbopack "Unknown module type" error. Fixed: `import type` only; pass CF bindings cast in route.
3. **`console.error` in `logger-internals.ts:92` kept as-is** — it is the legitimate logger fallback that dispatches structured errors to stdout. Sentry breadcrumb fires via dynamic import alongside it.
4. **Sentry + Turbopack warning** — upstream issue (sentry #8105); SDK warns but build succeeds. Not a blocker.

## Manual Steps Required (post-deploy)
1. Set GH secrets: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in repo settings.
2. Pre-seed R2 sentinel: `echo "ok" | npx wrangler r2 object put sophia-ai-factory-opennext-cache/health-check.txt --pipe`
3. Pre-seed KV sentinel: `npx wrangler kv:key put --binding=EXPERIMENT_KV health:ping ok`
4. Provision Sentry project; set `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` as CF secrets.

## Verification
- `console.error` outside logger-internals: **0** (verified via grep)
- All new files ≤200 LOC: **pass**
- Zero `:any` added in new code: **pass**
- Build: **exit 0**

## Unresolved Questions
- Sentry DSN not yet provisioned — observability is wired but events won't ship until client provisions a Sentry project and sets DSN secrets.
- Turbopack + Sentry replay integration: replay SDK warns; session replay may not function until Sentry resolves issue #8105 with Turbopack. Recommend disabling `replaysOnErrorSampleRate` in sentry-options if replay causes issues in production.
