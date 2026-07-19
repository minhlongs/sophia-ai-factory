# Code Review — 4-backlog-item sweep (bd674ad8)

**Scope:** Apollo + Hunter clients, lead:find / lead:enrich handlers, video-render benchmark, ByokProvider extension (5 sites), command-registry, i18n copy.
**LOC delta:** +930 / -71. **Score:** 8.5/10.

## Focus checks

### 1. API key handling — PASS
Apollo: key only in `X-Api-Key` request header; never logged. `logger.warn` on failure emits `{code, message}` where `message = err.message.slice(0,500)` from response body (provider-controlled, no echo of key).
Hunter: key in query string `?api_key=...`. `buildUrl` uses URL API correctly. Error path likewise only logs `code + message`.
No `console.log`, no inadvertent `JSON.stringify(req)` of headers.

### 2. Provider isolation — PASS
Both handlers: `if (!apiKey) → return stub`. No throw. `resolveUserApiKey` already collapses all failure modes to `null` (user-api-key-store.ts:83). Stub path includes `STUB_DELAY_MS = 1000` — preserves UX feel without burning credits.

### 3. Rate-limit retry storm — PASS
Neither client retries internally. `lead:find` returns `{ok:false, error:'apollo_429'}` immediately on 429. `lead:enrich` likewise. Mission gateway upstream owns retry policy. **Good.**

### 4. Test endpoint URL leaks — HIGH-PRIORITY ISSUE
`hunter` spec uses `url: (k) => buildUrl(...&api_key=${encodeURIComponent(k)})`. CF Workers `wrangler tail` logs OUTBOUND fetch URLs by default — Hunter calls will surface the plaintext key in worker tail logs. Apollo (header auth) is safe. **Mitigation:** add comment + consider sanitised log wrapper. Not exploitable externally (key is the operator's own), but violates "never log key bytes" rule from `byok/route.ts:92`.

### 5. Type-extension safety — MOSTLY PASS, 1 GAP
Audited 5 sites + extras:
- `user-api-key-store.ts` ✅ extended union to 8
- `byok/route.ts` PROVIDERS + RX ✅
- `byok/test/route.ts` Body enum + TEST_ENDPOINT (TestableProvider = Exclude<_, 'heygen'>) ✅
- `byok-key-form.tsx` UserSettableProvider ✅
- `key-format-validators.ts` ValidatorProvider ✅ — falls through to length-check default for apollo/hunter (correct, no false-reject)
- D1: `user_api_keys.provider` is TEXT (no CHECK enum), accepts new values ✅
**Gap:** `src/app/api/setup/save/route.ts:PROVIDER_MAP` — only 5 entries; setup wizard cannot save apollo/hunter. Intentional (wizard scope = LLM/media only)? If yes, add comment. If no, missed site.

### 6. Render-benchmark accuracy — BLOCKER
`updated_at` is bumped at EVERY intermediate stage by inngest functions:
- `video-scripting.ts:` 2× `update({updated_at})` per pipeline
- `video-tts.ts:` 2× more
- `video-compose.ts:` 2× more

So for a row in terminal status `published`, `updated_at - created_at` = time from creation to LAST mutation. Usually that IS the publish moment, but ANY post-publish patch (e.g. backfill, audit, final_r2_key fix) re-bumps `updated_at` and inflates the duration arbitrarily — making the benchmark MISLEADING. The SQL filter `updated_at > created_at` does not prevent this.

**Fix:** add `published_at` / `completed_at` INTEGER column to video_jobs, set once on terminal transition, query `completed_at - created_at`. Or join `video_cost_log.recorded_at` for the publish stage. Either way, current p50/p95 is silently inaccurate. Keep `low_confidence: true` until fixed.

## Concrete blockers
1. **Benchmark uses unreliable timestamp** (focus #6) — fix before publishing numbers anywhere.
2. **Hunter test-endpoint URL leaks key into wrangler tail** (focus #4) — add comment; consider redact in logger.

## Nice-to-haves
- `apollo-client.ts:97`: `Object.assign(new Error(...), {message: text.slice(0,500)})` overwrites the original constructor message; works but `message` is set twice — slight code smell.
- `lead-enrich.ts:64`: stub fallback constructs `${firstName}.${lastName}@${domain}` even when names empty — yields `.@example.com`. Cosmetic.
- `video-render-benchmark.ts:49`: `percentile` uses `floor((p/100)*n)` — for p99 on small samples this clamps to `length-1`, fine but consider linear interpolation later.
- `setup/save/route.ts:PROVIDER_MAP`: add inline comment noting apollo/hunter intentionally excluded (or extend).
- Test coverage for clients themselves (apollo + hunter fetch wrappers) is 0; only handler-level mocks. Add 4 tests (200, non-2xx, network error, body shape).

## Positive observations
- Pure aggregator separated from D1 query — excellent testability (7 tests).
- `low_confidence` flag + 0-sample envelope honest.
- Stub fallback with `upgrade_path` string — clean BYOK conversion funnel.
- Per-handler error code namespacing (`apollo_403`, `hunter_429`) survives upstream.
- `TestableProvider = Exclude<ByokProvider, 'heygen'>` exhaustive at compile-time.

## Unresolved questions
- Is `setup/save` PROVIDER_MAP omission of apollo/hunter intentional?
- Should `wrangler tail` logging strategy be revisited project-wide (Hunter is not the only query-string-auth provider on roadmap)?
