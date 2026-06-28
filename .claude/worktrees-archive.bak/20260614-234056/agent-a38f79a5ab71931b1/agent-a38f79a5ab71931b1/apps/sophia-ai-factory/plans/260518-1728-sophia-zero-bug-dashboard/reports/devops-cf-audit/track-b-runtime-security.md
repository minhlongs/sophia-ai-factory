# Track B — Worker Runtime + Security + Observability + Edge Caching + R2/KV
**Date:** 2026-05-18 | **Auditor:** debugger agent | **Stack:** Next.js 16 / OpenNext / CF Workers

---

## §1 Middleware Security Checklist

| Control | Status | Notes |
|---|---|---|
| CSRF double-submit cookie | ✅ | `verifyCsrfToken()` timing-safe compare; cookie `SameSite=Strict; Secure`; seed on GET |
| CSRF bypass paths | ✅ | `/api/auth/`, `/api/webhooks/`, `/api/cron/`, `/api/csp-report` |
| CSP nonce per-request | ✅ | `generateNonce()` via Web Crypto; passed to Server Components via `x-csp-nonce` header |
| CSP `unsafe-inline` in script-src | ✅ absent in prod | Only injected when `nonce` param is missing (static fallback path, never hot) |
| CSP `unsafe-eval` | ⚠️ dev-only | Conditional `process.env.NODE_ENV !== 'production'` — correct, but baked at build time |
| CSP `unsafe-inline` in style-src | ⚠️ persistent | Required by Tailwind; cannot nonce-protect styles. Accepted risk, documented. |
| HSTS | ✅ | `max-age=63072000; includeSubDomains; preload` (2 years) via `next.config.ts` headers |
| X-Frame-Options | ✅ | `DENY` |
| X-Content-Type-Options | ✅ | `nosniff` |
| Referrer-Policy | ✅ | `origin-when-cross-origin` |
| Permissions-Policy | ✅ | `camera=(), microphone=(), geolocation=()` |
| X-XSS-Protection | ✅ | `0` (correct — disables legacy IE scanner) |
| CORS explicit allow-list | ✅ | `ALLOWED_ORIGINS` = 2 domains + localhost in dev; NOT `*` |
| CORS `Access-Control-Allow-Credentials` | ✅ | `true` on allowed origins only |
| Rate limiting | ✅ | `checkRateLimit()` in `middleware-api-handler`; 4 tiers: api/auth/webhook/discovery |
| MFA challenge enforcement | ✅ | Lines 119-130: redirects `/dashboard` to `/auth/mfa-challenge` if session pending; non-fatal on DB error |
| Admin basic-auth `/admin/*` | ✅ | `isAdminAuthorized()` guard at lines 93-103; rewrites to `/api/auth` if fails |
| `frame-ancestors: 'none'` | ✅ | In CSP config (clickjacking) |
| IS_CONFIGURED platform gate | ✅ | `IS_CONFIGURED=true` now set in `wrangler.toml [vars]`; redirects to `/setup-wizard` if unset |
| CSP report-uri | ✅ | `/api/csp-report` wired |

**Gap:** HSTS / X-Frame / X-Content-Type set via `next.config.ts` static headers (applied by OpenNext at edge). These are NOT set in middleware responses directly — middleware returns bare `NextResponse.next()` for non-HTML paths without re-attaching those headers. Cloudflare edge should forward them, but gap exists if a request bypasses OpenNext header rules.

---

## §2 Worker Bundle / Cold-Start

| Metric | Value | Notes |
|---|---|---|
| `worker.js` | **5.0 KB** | Tiny — just the CF Worker entrypoint |
| `middleware/handler.mjs` | **2.7 MB** | This is the real middleware bundle — all middleware code + deps live here |
| `.open-next/` total | **164 MB** | Includes static assets, server functions, cloudflare-templates |
| `compatibility_date` | `2026-03-17` | Recent — good |
| `nodejs_compat` flag | ✅ | Present in `wrangler.toml` |
| `global_fetch_strictly_public` flag | ✅ | Present — prevents fetching private IPs from Worker |
| `streams_enable_constructors` | not set | Not needed with `nodejs_compat` on CF compat date ≥ 2023 |

**Cold-start concern:** `middleware/handler.mjs` at 2.7 MB is **large** for a CF Worker. CF Workers free tier limits are 1 MB compressed; paid Workers Unbound limit is higher but large bundles increase cold-start latency. Heavy transitive deps in middleware include: Inngest client (lazy via route handlers, not in middleware itself — confirmed not imported in `middleware.ts` or `middleware-api-handler.ts`), Sentry (only in `sentry.client.config.ts` / `sentry.server.config.ts` — not in middleware hot path). Middleware deps appear lean.

**Static imports at module top:** `next-intl/middleware`, `better-auth` session check, D1 client, Sentry options — all pulled synchronously. `getAuth()` called inside guard, not at module init.

---

## §3 R2 Usage Findings

| Bucket | Binding | Access pattern | Notes |
|---|---|---|---|
| `sophia-ai-factory-opennext-cache` | `NEXT_INC_CACHE_R2_BUCKET` | OpenNext ISR cache read/write | Internal; no public URL |
| `sophia-videos` | `VIDEO_BUCKET` | Worker-proxy reads; write from video pipeline | `R2_PUBLIC_BASE_URL` configures public base; fallback = HeyGen CDN URL if unset |
| `sophia-backups` | `BACKUPS_BUCKET` | Write-only from `/api/cron/d1-backup` | No public read; key=timestamp |

**Public access:** `VIDEO_BUCKET` read exposed via `R2_PUBLIC_BASE_URL` env var. If var unset, falls back to HeyGen CDN volatile URL (logged as warn). No `r2-public.cloudflare.com` public bucket — all reads go through Worker proxy. Good.

**Large file handling:** Video paths (`path-a-template.ts`, `path-b-cinematic.ts`, `ffmpeg-muxer.ts`) write to `VIDEO_BUCKET` with warn-and-skip if binding unavailable — graceful degradation. No evidence of buffered large-file reads in middleware hot path.

**R2 lifecycle rules:** Per no-tech doctrine, `BACKUPS_BUCKET` has documented 30-day lifecycle. Rule must be set via `wrangler r2 bucket lifecycle add` or Cloudflare dashboard — not codified in `wrangler.toml` (CF doesn't support lifecycle in TOML). Verify it is actually set.

**Issue:** `storage-tracker-cron.ts` line 28 falls back to `NEXT_INC_CACHE_R2_BUCKET` when `VIDEO_R2_BUCKET` is absent — binding name mismatch (`VIDEO_BUCKET` in wrangler.toml vs `VIDEO_R2_BUCKET` referenced in tracker). Likely dead fallback.

---

## §4 D1 Usage Findings

| Pattern | Status | Notes |
|---|---|---|
| Prepared statements | ✅ | `db.prepare(...).bind(...)` used consistently across `d1-client-rpc.ts`, `get-user-tier.ts`, `workflow-repository.ts` |
| Parameterized queries | ✅ | `?` placeholders throughout; no string interpolation in SQL |
| `createServerClient()` sync | ✅ | Sync accessor; `getD1Async()` only for async edge paths |
| Onboarding lookup in middleware | ⚠️ | `middleware.ts:140-145`: `db.prepare(...).bind(...).first()` called on **every `/dashboard` GET** — hot path D1 query per request. No cache. |
| N+1 patterns | not found in seed/db | spot check clean; forest layer not audited |
| Index coverage on `user_profiles.user_id` | unverified | Query `SELECT onboarding_completed_at FROM user_profiles WHERE user_id = ? LIMIT 1` — needs index on `user_id`; likely present (FK) but not confirmed |

**Hot-path risk:** The middleware D1 query (onboarding check) fires on every authenticated `/dashboard` visit. With D1's ~1–5 ms typical latency this adds measurable P99 overhead, especially under load. Cookie fallback exists but only activates on DB error, not on success.

---

## §5 KV Findings

| Aspect | Status | Notes |
|---|---|---|
| Binding | ✅ | `EXPERIMENT_KV` in `wrangler.toml` + `preview_id` |
| Usage purpose | PostHog feature flags + A/B variant cache | 60-second TTL |
| Read-after-write semantics | ⚠️ | KV is eventually consistent (strong on same colo). Feature flag reads after write may get stale value within 60s window. Acceptable for flag caching; not acceptable for session-critical state. |
| Scope creep risk | KV accessed via `globalThis['EXPERIMENT_KV']` in `feature-flags.ts` | Global binding access is correct CF pattern but bypasses type safety |
| Health probe | ✅ | `probe-kv.ts` used in `/api/health` with 30s cache |

---

## §6 Observability State

| Component | Status | Notes |
|---|---|---|
| Sentry client SDK | ✅ | `sentry.client.config.ts` — `replayIntegration()`, production-only, `debug:false` |
| Sentry server SDK | ✅ | `sentry.server.config.ts` — thin wrapper around `buildServerOptions()` |
| Sentry DSN | runtime env | `NEXT_PUBLIC_SENTRY_DSN` — must be set as CF secret; if unset, errors swallowed silently |
| Source map upload | optional | `withSentryConfig()` in `next.config.ts`; warns + skips on missing `SENTRY_AUTH_TOKEN` per no-tech doctrine |
| Sentry release tag | ✅ | Uses `COMMIT_SHA` env (injected by `deploy-with-sha.sh`) → enables commit-linked traces |
| Structured JSON logger | ✅ | `logger-utility.ts` dispatches to `logger-internals.ts`; JSON in prod, pretty in dev |
| Per-request trace ID | ✅ | `logger.withRequestId(requestId)` API exists; usage in middleware via `X-Response-Time-Ms` |
| `wrangler tail` stream | ✅ canonical | Documented as real-time log stream in deploy rules |
| Breadcrumb PII filter | ✅ | `ALLOWED_BREADCRUMB_CATEGORIES` allowlist + PII key stripping in `sentry-options.ts` |
| Sampling | unverified | `buildClientOptions()` / `buildServerOptions()` sample rates not read in this audit; defaults may be 100% in prod |

---

## §7 Edge Caching State

| Aspect | Status | Notes |
|---|---|---|
| Static assets `/_next/static/*` | ✅ | `Cache-Control: public, max-age=31536000, immutable` |
| Static `/static/*` | ✅ | same immutable rule |
| Public marketing pages | ✅ | `s-maxage=60, stale-while-revalidate=600` on pricing/guide/blog/privacy/terms/status |
| Dashboard / auth routes | ✅ | No cache headers → CF default `no-store` (correct for auth-gated) |
| OpenNext ISR / tag cache | ✅ | `NEXT_TAG_CACHE_D1` binding wired (separate `sophia-tag-cache` D1 instance) |
| `revalidatePath` usage | ✅ | Used in server actions: sops, campaigns, settings, onboarding |
| `revalidateTag` | not found | `revalidatePath` only — no tag-based cache invalidation. Tags would allow finer-grained purge. |

---

## §8 Security Headers Summary Table

| Header | Value | Source |
|---|---|---|
| `Content-Security-Policy` | nonce-based per-request | middleware (runtime) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | `next.config.ts` |
| `X-Frame-Options` | `DENY` | `next.config.ts` |
| `X-Content-Type-Options` | `nosniff` | `next.config.ts` |
| `Referrer-Policy` | `origin-when-cross-origin` | `next.config.ts` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | `next.config.ts` |
| `X-XSS-Protection` | `0` | `next.config.ts` |
| `X-DNS-Prefetch-Control` | `on` | `next.config.ts` |
| `Access-Control-Allow-Origin` | origin-specific (no wildcard) | middleware CORS |
| `frame-ancestors` | `'none'` | CSP directive (middleware) |
| `Vary` | `Origin` | middleware CORS |

**Missing:** `Cross-Origin-Opener-Policy` (COOP), `Cross-Origin-Resource-Policy` (CORP), `Cross-Origin-Embedder-Policy` (COEP). Not critical for this stack but recommended for Spectre mitigation.

---

## §9 Ranked Top 5 Issues

| # | Issue | Severity | Fix LOC |
|---|---|---|---|
| 1 | **Middleware hot-path D1 query per `/dashboard` GET** — `onboarding_completed_at` fetched from D1 on every authenticated request; no TTL cache. Under load this adds latency + D1 read quota burn. | HIGH | ~15 LOC — cache result in a short-TTL KV key (`onboard:<uid12>`) or extend the cookie lifetime on completion |
| 2 | **`storage-tracker-cron.ts` binding name mismatch** — references `VIDEO_R2_BUCKET` but wrangler.toml declares `VIDEO_BUCKET`. Tracker silently falls back to `NEXT_INC_CACHE_R2_BUCKET` and measures wrong bucket. | MEDIUM | 2 LOC — fix env key to `VIDEO_BUCKET` |
| 3 | **HSTS / security headers from `next.config.ts` may not reach all middleware responses** — middleware returns `NextResponse.next()` for `/admin` and `/dashboard` paths without re-setting static headers; relies on OpenNext to merge. If OpenNext header injection is skipped on edge-cached responses, headers gap. | MEDIUM | ~10 LOC — set HSTS + X-Frame-Options explicitly in `attachCspHeaders()` or a dedicated helper called on every final response |
| 4 | **Sentry DSN silent failure** — if `NEXT_PUBLIC_SENTRY_DSN` is unset (not a CF secret), `getDSN()` returns `''` and Sentry init completes without error but drops all events. No startup warning. | MEDIUM | 5 LOC — add guard: `if (!dsn) logger.warn('[Sentry] DSN not set — error capture disabled')` in `buildClientOptions()` |
| 5 | **KV read-after-write eventual consistency for feature flags** — `EXPERIMENT_KV` used for A/B variant stickiness. KV consistency window (~1s globally) could serve stale variant to user immediately after assignment write on different colo. Low probability but would cause flicker. | LOW | ~20 LOC — use a cookie as canonical variant store; use KV only as warm read cache |

---

## §10 Refactor Proposals

**P1 — Cache onboarding state in EXPERIMENT_KV (eliminates hot-path D1 query)**
On `complete-onboarding-action.ts` success, write `kv.put('onboard:' + uid12, '1', { expirationTtl: 86400 })`. In middleware, read KV first; fall back to D1 only on cache miss. Eliminates D1 round-trip on 99%+ of `/dashboard` requests.

**P2 — Consolidate security header injection into a single `applySecurityHeaders(response)` helper**
Currently headers split across `next.config.ts` (static, applied by OpenNext) and middleware (`attachCspHeaders`). Create `src/seed/security/apply-security-headers.ts` that sets HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP/CORP on every response object. Call from middleware final return paths. `next.config.ts` retains static headers as fallback for edge-cached assets. Eliminates the gap described in issue #3.

**P3 — Add `revalidateTag` to server actions + leverage ISR tagCache D1**
Currently only `revalidatePath` used. Switch mutation server actions to tag-based invalidation (`revalidateTag('campaign-list')` etc.). With `NEXT_TAG_CACHE_D1` already wired, this enables fine-grained cache purge without full-path revalidation, reducing unnecessary RSC re-renders on unrelated data.

---

## §11 Unresolved Questions

1. **R2 lifecycle rule for `sophia-backups` bucket** — documented as "30-day retention" in no-tech doctrine but TOML can't declare lifecycle. Was `wrangler r2 bucket lifecycle add` actually run? No confirmation in audit artifacts.
2. **Sentry sample rates in `buildClientOptions()`/`buildServerOptions()`** — not read; if defaulting to `tracesSampleRate: 1.0` in production, Sentry will receive 100% of traces and billing will escalate quickly.
3. **`NEXT_PUBLIC_SENTRY_DSN` secret status** — is this set as a CF secret (`wrangler secret put`)? Not visible in `wrangler.toml [vars]`. Silent failure if absent.
4. **D1 index on `user_profiles.user_id`** — the hot-path query assumes indexed lookup; unconfirmed without `wrangler d1 execute --command "PRAGMA table_info(user_profiles)"`.
5. **middleware `handler.mjs` 2.7 MB** — is this within CF Workers paid plan limits after gzip? Typical compression ratio ~3–5x suggests ~600–900 KB gzipped — within limit but worth confirming with `wrangler deploy --dry-run` size output.
