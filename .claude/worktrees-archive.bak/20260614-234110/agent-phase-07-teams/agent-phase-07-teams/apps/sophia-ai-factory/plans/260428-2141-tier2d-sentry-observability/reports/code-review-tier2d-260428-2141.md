# Code Review — TIER-2D Sentry Observability
**Date:** 2026-04-28 21:55
**Reviewer:** code-reviewer
**Plan:** plans/260428-2141-tier2d-sentry-observability/
**Verdict:** **BLOCK** — 3 critical bugs prevent production deployment

## Score: 21/30 (7.0/10)
- Quality: 6/10 — sentry-options.ts has runtime crash; logger TS error
- Security: 9/10 — solid PII strip, 4xx drop, replay masking, secrets via env
- Maintainability: 6/10 — DRY violation in beforeSend (3x duplicate body); test typed casts brittle

## Critical (BLOCKING)

**C1. `sentry-options.ts:69-94` — Undefined identifiers crash at module load.**
`buildServerOptions()` and `buildEdgeOptions()` reference `DSN`, `RELEASE`, `ENVIRONMENT`, `IS_PROD` (uppercase constants) but only the lazy getters `getDSN/getRelease/getEnvironment/getIsProd` are declared (lines 11-14). Any `import './sentry-options'` from server/edge runtime will throw `ReferenceError`. Server tests pass only because they call `buildClientOptions` (line 48-65 uses correct getters) — server/edge paths are never exercised before transpile. Fix: replace `DSN` → `getDSN()`, `RELEASE` → `getRelease()`, `ENVIRONMENT` → `getEnvironment()`, `IS_PROD` → `getIsProd()` in lines 69-80 and 84-95. This is the SOLE entrypoint Sentry uses on Cloudflare Workers — the worker will crash at boot.

**C2. `next.config.ts:117-118` — Unknown SentryBuildOptions properties.**
TS error: `'disableClientWebpackPlugin' does not exist in type 'SentryBuildOptions'`. The @sentry/nextjs API renamed these to `disableLogger` / build telemetry flags. Will fail strict build. Replace with valid SentryBuildOptions or remove. Build only passes today because `typescript.ignoreBuildErrors: true` (line 26) masks it.

**C3. `logger-internals.ts:122-123` — Sentry dynamic import type mismatch.**
TS error: assigning `Module<@sentry/nextjs>` to `{ captureException: (...) }` fails because module has 230+ exports. Crash mode masked by `ignoreBuildErrors`, but type-incorrect. Fix:
```ts
const sentry = await import('@sentry/nextjs');
_sentryModule = { captureException: sentry.captureException };
```

## Non-Blocking

**N1. `probe-d1.test.ts:13` — Missing `afterEach` import.** Imports `vi, beforeEach` only; `afterEach` undefined → `TS2304: Cannot find name 'afterEach'`. Add to import line. (probe-r2.test.ts and probe-kv.test.ts are correct.)

**N2. `sentry-options.ts:48-97` — DRY: `beforeSend` body duplicated 3 times.** Extract to `function makeBeforeSend()` returning the closure; cuts file 105 → ~75 LOC.

**N3. `sentry-options.test.ts:75-79` — Type casts brittle.** Tests pass at runtime but TS errors emit during compile (`ErrorEvent has no extra` etc.). Use `as unknown as ErrorEvent` to silence.

**N4. `probe-d1.ts` / `probe-r2.ts` / `probe-kv.ts` — Module-level cache shared across requests.** `cachedResult` lives at module scope on Workers isolate. Within a single isolate, this saves D1 reads (good). But: a `down` result during transient D1 blip will be served as cached for 30s even after recovery — affects `/api/health` accuracy. Acceptable tradeoff vs free-tier exhaustion; document in comment. Also: `probe-d1.ts:17` declares `start = now` but `now` was set before cache check — latency includes the cache lookup µs (negligible).

**N5. `probe-*.ts` — Memory leak via `setTimeout` not cleared.** When happy path resolves first, the timeout `setTimeout` keeps a pending timer. CF Workers GC handles it, but cleaner: capture handle and `clearTimeout` in a `finally`. Low impact.

**N6. `sentry-upload-sourcemaps.sh:23,49` — `releases new` and `finalize` not guarded.** Unlike line 31/40 (`|| echo "warn"`), these will exit-fail and break the workflow if Sentry API is down. Recommend wrapping with `|| echo "warn: ... (non-fatal)"; exit 0` to honor the doc claim "never blocks deploy." Currently the workflow has `continue-on-error: true` (test.yml:72) — script exit isn't blocking — but the script's own header promise is misleading.

**N7. `health/route.ts:3` — Imports from BANNED `@/lib/clients/upstash-redis-client`.** `apps/sophia-ai-factory/CLAUDE.md` explicitly states `lib/clients/` was DELETED. Verify path still exists or update import. Pre-existing, not introduced by TIER-2D.

**N8. `build-metadata.ts:13` — `new Date().toISOString()` fallback drift.** When `DEPLOYED_AT` env is absent, every call generates a new timestamp. Behavior intended (local dev) but downstream tools comparing `/api/version` outputs may see drift. Cache it: `const RUNTIME_FALLBACK = new Date().toISOString();`.

**N9. `sentry-options.test.ts` — No coverage for `buildEdgeOptions` PII strip / 4xx drop.** Only tests release fallback. Add 2 tests mirroring server.

**N10. `probe-*.test.ts` — No timeout-path test.** All three test happy + error but the 1500ms `Promise.race` timeout branch is untested. Use `vi.advanceTimersByTime(1600)` to assert `status: 'down', error: '* probe timeout'`.

## Strengths

- Edge runtime safety: `sentry.edge.config.ts` and `instrumentation.ts` import only `@sentry/nextjs` + the options builder. No `fs`, `path`, `process` calls beyond `process.env.NEXT_RUNTIME` (Workers-supported). ✅
- Zero `:any` types found in new files (grep clean). ✅
- Zero new `console.log/warn/error` — only the legit fallback at logger-internals.ts:92 with explicit comment. ✅
- File-size discipline: largest new file is sentry-options.ts at 105 LOC, all others <50. Well under 200. ✅
- PII stripping regex `/token|secret|password|key|auth/i` covers the standard surface area.
- Replay sample only on errors with `maskAllText` + `blockAllMedia` is privacy-correct.
- Source-map upload is gracefully optional via `continue-on-error: true` in CI; `fetch-depth: 0` correctly set for `set-commits --auto`.
- Probes correctly treat `null`/404 as `up` (binding reachable, sentinel merely absent).
- `health/route.ts` properly redacts service detail from unauthenticated callers (lines 138-149).
- 15/15 new unit tests pass when run.
- Protected routes untouched (`/api/telegram/webhook`, `/api/payments/nowpayments/webhook`, `/setup`) — git diff confirms no touch.

## Recommendations

1. **MUST FIX** C1, C2, C3 before any deploy. C1 alone will brick the worker boot.
2. After C1 fix, run `npm test -- src/lib/observability` and confirm server+edge paths exercised.
3. Address N1 (missing import) — single-line fix unblocks tsc on test file.
4. Add timeout-path tests (N10) — 1500ms race is core to free-tier protection.
5. Refactor `beforeSend` duplication (N2) before next options change.
6. Verify Cloudflare Workers receives `process.env.COMMIT_SHA` from `wrangler-set-build-vars.sh` injection — `/api/version` already depends on this so should be wired, but confirm.
7. Add health probe staleness test: `down` cache should not survive recovery >30s.

## Verification Run
- `npm test --run sentry-options.test.ts probe-{d1,r2,kv}.test.ts` → 15/15 pass ✅
- `npx tsc --noEmit` (TIER-2D files only) → 4 errors (sentry-options.test L75-79, logger-internals L123, next.config L117). Pre-existing repo errors unrelated.
- `grep ': any' src/lib/observability src/lib/health sentry.*.config.ts` → 0 hits ✅
- `grep 'console\.' src/lib/observability src/lib/health` → 0 hits ✅
- File LOC: sentry-options 105, all health probes ≤48, logger-internals 161, route.ts 155 — all under 200 ✅
- Edge runtime: no fs/path/Node-only imports in any sentry config ✅

## Unresolved Questions

1. Is `disableClientWebpackPlugin` a typo in current @sentry/nextjs version, or should the project pin to an older Sentry SDK version where it existed? Phase-01 plan should specify SDK version.
2. Does `wrangler-set-build-vars.sh` actually inject `COMMIT_SHA` and `DEPLOYED_AT` as runtime-readable secrets (not just CI vars)? `build-metadata.ts:12-13` assumes yes.
3. Should `health/route.ts` import path `@/lib/clients/upstash-redis-client` be updated post-consolidation (per `apps/sophia-ai-factory/CLAUDE.md`)? Not introduced by TIER-2D but adjacent.
4. Is the 30s probe cache TTL acceptable during incident windows where ops want sub-30s health visibility?
