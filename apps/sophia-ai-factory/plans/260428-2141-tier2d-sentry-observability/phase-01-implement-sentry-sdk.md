# Phase 01 — Sentry SDK Install + Config

## Context Links
- Plan overview: [plan.md](./plan.md)
- Source: TIER-2D § "Observability Platform" — Sprint 2 backlog
- Sophia rules: `apps/sophia-ai-factory/CLAUDE.md` (zero `:any`, ≤200 LOC files)
- Next.js config: `apps/sophia-ai-factory/next.config.ts`
- OpenNext config: `apps/sophia-ai-factory/open-next.config.ts`
- Sentry docs (v8 Next.js): https://docs.sentry.io/platforms/javascript/guides/nextjs/

## Overview
- **Priority:** P2
- **Status:** ✅ Completed 2026-04-28
- **Description:** Install `@sentry/nextjs` v8+, create three runtime configs (client/server/edge), wire `instrumentation.ts` per Next.js 15+ standard, wrap `next.config.ts` with `withSentryConfig`. Ensure CF Workers edge runtime compatibility.

**Completion Summary (2026-04-28):**
- 6 files created: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `sentry-options.ts`, `sentry-options.test.ts`
- 3 files modified: `next.config.ts` (withSentryConfig wrapper), `package.json` (added @sentry/nextjs@^8), `.env.example` (documented DSN vars)
- Build: ✅ exit 0; Tests: ✅ all pass
- No `:any` types; bundle delta <100KB; no regressions (Setup Wizard, Telegram Bot, NOWPayments IPN all green)

## Key Insights
- Next.js 15+ uses `instrumentation.ts` at app root (NOT `_middleware`) for SDK init — Sentry v8 follows this.
- CF Workers edge runtime is strict: NO Node APIs. Sentry edge config MUST use `@sentry/nextjs` edge entry only.
- React Compiler (`reactCompiler: true` in next.config.ts) — verify Sentry compatible (v8 supports).
- `serverExternalPackages: ['redis', 'ioredis']` already set; add `@sentry/profiling-node` if profiling enabled (likely skip for edge).
- DSN goes in env, NOT hardcoded. Use `NEXT_PUBLIC_SENTRY_DSN` for client config, `SENTRY_DSN` for server/edge.

## Requirements
**Functional:**
- Capture unhandled exceptions on client, server (Workers), and edge (middleware) runtimes.
- Tag events with `release = $COMMIT_SHA`, `environment = production|preview|development`.
- Performance traces: 10% sampling prod, 100% dev.
- Filter: skip 4xx (client errors), skip network aborts, skip ResizeObserver noise.

**Non-functional:**
- Bundle delta ≤100KB gzip on client.
- Init must be non-blocking — no `await` in instrumentation hooks.
- Zero `:any` types; use `Sentry.NodeOptions` / `Sentry.BrowserOptions` / `Sentry.EdgeOptions`.

## Architecture
```
instrumentation.ts (root)
 ├─ runtime === 'nodejs'  → import sentry.server.config.ts
 └─ runtime === 'edge'    → import sentry.edge.config.ts

sentry.client.config.ts  ← auto-loaded by @sentry/nextjs in browser bundle
sentry.server.config.ts  ← server-side init (runs on CF Workers via OpenNext)
sentry.edge.config.ts    ← edge init (middleware + edge route handlers)

next.config.ts → withSentryConfig(...) wrapper outermost
```

## Related Code Files
**Create:**
- `apps/sophia-ai-factory/sentry.client.config.ts` (~40 LOC)
- `apps/sophia-ai-factory/sentry.server.config.ts` (~35 LOC)
- `apps/sophia-ai-factory/sentry.edge.config.ts` (~30 LOC)
- `apps/sophia-ai-factory/instrumentation.ts` (~20 LOC)
- `apps/sophia-ai-factory/src/lib/observability/sentry-options.ts` (shared options ~80 LOC)
- `apps/sophia-ai-factory/src/lib/observability/sentry-options.test.ts` (~60 LOC)

**Modify:**
- `apps/sophia-ai-factory/next.config.ts` — wrap export with `withSentryConfig` (innermost is `withPWA(withAnalyzer(withNextIntl(nextConfig)))`)
- `apps/sophia-ai-factory/package.json` — add deps
- `apps/sophia-ai-factory/.env.example` (if exists) — document `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

## Implementation Steps
1. **Add deps:** `npm install --legacy-peer-deps @sentry/nextjs@^8` (root install in app dir).
2. **Create `sentry-options.ts`** — exports `buildClientOptions()`, `buildServerOptions()`, `buildEdgeOptions()`. Centralizes DSN, sampling, ignoreErrors, tracesSampleRate. Each function returns typed options.
3. **Create `sentry.client.config.ts`** — call `Sentry.init(buildClientOptions())`. Include `Sentry.replayIntegration({ maskAllText: true })` (privacy default).
4. **Create `sentry.server.config.ts`** — call `Sentry.init(buildServerOptions())`. NO profiling integration (CF Workers).
5. **Create `sentry.edge.config.ts`** — call `Sentry.init(buildEdgeOptions())`. Minimal integrations (no fs/path).
6. **Create `instrumentation.ts`** — export `register()` that conditionally imports `./sentry.server.config` or `./sentry.edge.config` based on `process.env.NEXT_RUNTIME`.
7. **Wrap `next.config.ts`:** wrap final export with `withSentryConfig(finalConfig, { silent: true, hideSourceMaps: true, widenClientFileUpload: true, org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, authToken: process.env.SENTRY_AUTH_TOKEN })`. Source-map upload args wired here but actual upload runs in CI (Phase 02).
8. **Write unit test** `sentry-options.test.ts` — assert sampling, ignoreErrors, environment tagging logic.
9. **Smoke test locally:** `npm run dev` → trigger throw in a test route → confirm Sentry captures event in dashboard (or stub).
10. **Verify build:** `npm run build` → 0 errors. Check no source maps in `.open-next/`.

## Todo List
- [x] Add `@sentry/nextjs` to package.json
- [x] Create `sentry-options.ts` with typed builders
- [x] Create `sentry.client.config.ts`
- [x] Create `sentry.server.config.ts`
- [x] Create `sentry.edge.config.ts`
- [x] Create `instrumentation.ts`
- [x] Wrap `next.config.ts` with `withSentryConfig`
- [x] Write `sentry-options.test.ts`
- [x] Run `npm run build` → 0 errors
- [x] Run `npm test` → all pass (1604/1604 + 31 skipped)
- [x] Document env vars in `.env.example`

## Success Criteria
- All 4 config files ≤80 LOC each, 1 shared options file ≤80 LOC
- Build: 0 TS errors; bundle delta <100KB
- Test: `sentry-options.test.ts` 100% pass
- Local dev: triggered error visible in Sentry (or DSN-not-set warning when DSN absent — graceful)
- No `:any` types

## Risk Assessment
- **Edge runtime fail:** if `@sentry/nextjs` edge bundle uses Node API → revert to manual `try/catch` + `Sentry.captureException` calls. Document in plan if hit.
- **React 19 + Sentry replay:** verify replay integration compatible; disable if SSR hydration breaks.
- **OpenNext worker bundle size limit (1MB CF):** measure post-build; if exceeded, drop replay integration.

## Security Considerations
- DSN in client config is PUBLIC by design (rate-limited by Sentry).
- `SENTRY_AUTH_TOKEN` is server-only; never expose client side.
- `maskAllText: true` on session replay — protect user PII.
- Sanitize error messages — strip secrets from stack traces via `beforeSend` hook in `sentry-options.ts`.

## Next Steps
- Phase 02 wires source-map upload to CI (`test.yml` deploy job) using `SENTRY_AUTH_TOKEN`.
- Phase 03 replaces residual `console.error` with logger that integrates Sentry breadcrumbs.
