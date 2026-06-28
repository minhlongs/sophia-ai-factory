# TIER-2B — API Auth Audit (JWT + Session)

**Scope:** All `src/app/api/**/route.ts` (153 routes)
**Mode:** Audit-only — no code changes
**Date:** 2026-04-28

## Stats

| Metric | Value |
|---|---|
| Total route files | 153 |
| Properly auth'd (session/JWT/admin/api-key) | 119 (78%) |
| Webhook (HMAC/signature) | 4 |
| Cron (CRON_SECRET / cf-cron) | 19 |
| Public (intentional) | 14 |
| **Gaps (unauth'd, should be auth'd)** | **15 (10%)** |

## Global Auth Architecture

- **Session:** `getCurrentUser()` / `getCurrentUserFromHeaders()` from `@/lib/better-auth-session` (Better Auth)
- **JWT bearer:** `validateJwt()` from `@/lib/security/jwt-validator`
- **API key:** `validateApiKey()` from `@/lib/security/api-key-validator` (or per-route SHA-256 hash check)
- **Cron:** `verifyCronAuth()` (`/lib/security/cron-auth.ts`) checks `x-cf-cron`, `Bearer ${CRON_SECRET}`, or `x-cron-secret`. **Dev-mode bypass exists.**
- **Webhook:** Per-provider HMAC verifier (`verifyClickBankSignature`, `verifyIpnSignature`, `verifySignature`, telegram secret-token header)
- **CSRF:** `requiresCsrfCheck()` in `proxy()` middleware. Bypasses: `/api/auth/`, `/api/webhooks/`, `/api/cron/`. ALL other mutations (POST/PUT/PATCH/DELETE) get CSRF-checked at the edge.
- **Admin gate:** `is-user-admin.ts` + `require-admin.ts`; admin routes consistently call admin helpers.

## Section A — Properly auth'd (✅ 119)

(Showing categories; not enumerating all)

- `/api/admin/**` (31 routes) — admin helper enforced
- `/api/agents/**` (6) — `getCurrentUser`
- `/api/alerts/**` (4) — `getCurrentUser`
- `/api/analytics/**` (10) — `getCurrentUser` + `getUserTier` on tier-gated
- `/api/auth/mfa/**` (3) — `getCurrentUser`
- `/api/auth/session, /api/auth/tiktok/callback, /api/auth/youtube/callback` — `getCurrentUser`
- `/api/billing/usage-summary, /api/check-access` — session
- `/api/checkout, /api/coupons/**` — session via `getUserId(request)` (Better Auth headers)
- `/api/discovery/score, /api/errors/report` — session
- `/api/heygen/**` (4) — session
- `/api/quota/**, /api/raas/**` — session
- `/api/referral/**` (2), `/api/scripts/generate`, `/api/setup/local-mode/**`, `/api/setup/save` — session
- `/api/signals/**` (3) — session
- `/api/usage/export` (GET+POST) — `getCurrentUser` in sub-handlers (export-get-handler.ts, export-post-handler.ts)
- `/api/usage/summary, /api/user/**` (4) — session
- `/api/v1/campaigns/create` — Bearer `raas_api_key` (SHA-256 hash check)
- `/api/v1/overage/[tenantId], /api/v1/quota/[tenantId]` — `validateJwt`
- `/api/v1/usage` — `getCurrentUser`
- `/api/v1/usage/batch` — `x-api-key` header → `raas_api_keys` table lookup
- `/api/videos/**, /api/violations/route` — session via `authenticateRequest`
- `/api/audit/route` — `validateApiKey` + `validateJwt`

## Section B — Webhook (signature-verified) ✅ 4

| Route | Mechanism |
|---|---|
| `/api/webhooks/clickbank` | HMAC-SHA1 via `verifyClickBankSignature` |
| `/api/webhooks/nowpayments` | HMAC-SHA512 (`x-nowpayments-sig`) |
| `/api/webhooks/overage-billing` | Polar/Stripe/Cloudflare signature |
| `/api/webhooks/telegram` | `X-Telegram-Bot-Api-Secret-Token` header (when `TELEGRAM_WEBHOOK_SECRET` is set) |

## Section C — Cron (CRON_SECRET / cf-cron) ✅ 19

All `/api/cron/*` routes use `verifyCronAuth()` or inline `Bearer ${CRON_SECRET}` check, EXCEPT:

- `/api/cron/workflow-stepper` — uses internal `isAuthorised()` from `workflow-stepper-runtime-utils` (custom, ✅).

CSRF middleware bypasses `/api/cron/*` (correct).

## Section D — Public (intentional) ✅ 14

| Route | Why public |
|---|---|
| `/api/auth/[...all]` | Better Auth catch-all (sign-in, sign-up, etc.) |
| `/api/auth/login, /api/auth/signup, /api/auth/logout, /api/auth/callback` | Deprecated 410 shims |
| `/api/auth/route` (GET) | Returns 401 challenge (admin login redirect target) |
| `/api/inngest` | Inngest serve handler — internal HMAC by Inngest |
| `/api/health/route` | Liveness probe |
| `/api/health/agents` | Liveness probe (calls `getCurrentUser` only opportunistically) |
| `/api/version` | Build version metadata |
| `/api/r/[code]` | Affiliate short-link redirect — public by design |
| `/api/metrics` | Prometheus snapshot — public (consider lock-down, see gap M1 below) |
| `/api/sophia-index/health` | Health probe |
| `/api/setup/verify` | Pre-login setup wizard probe |

## ⚠️ Section E — GAPS (15 routes)

### CRITICAL — Sensitive data / mutations without auth

| # | Route | Method | Issue | Fix |
|---|---|---|---|---|
| C1 | `src/app/api/debug/db-schema/route.ts` | GET | **Exposes raw DB schema in prod.** No auth check. | Wrap with `verifyCronAuth` OR `requireAdmin`; ideally remove from production build. |
| C2 | `src/app/api/debug/migrate/route.ts` | GET | **Triggers DB migrations.** No auth — anyone can run migrations. | Require `INTERNAL_API_SECRET` header + `NODE_ENV !== 'production'` guard, OR delete route. |
| C3 | `src/app/api/usage/debug/route.ts` | GET | Returns recent `usage_events` rows for any `license_nonce` query param — **PII / cross-tenant leak**. | Add `getCurrentUser` + `isUserAdmin` OR scope query to caller's `license_nonce`. |
| C4 | `src/app/api/usage/mock/route.ts` | GET, DELETE | **Inserts/deletes arbitrary mock usage events** for any license. Public mutations. | Restrict to `NODE_ENV !== 'production'` + `INTERNAL_API_SECRET`. |
| C5 | `src/app/api/usage/reconciliation/sync/route.ts` | GET, POST | Triggers full usage→KV sync (expensive + writes audit log). No auth. | Add `verifyCronAuth` or admin gate. |
| C6 | `src/app/api/internal/usage/query/route.ts` | GET | Path implies "internal" but no auth check. Reads usage aggregations. | Add `INTERNAL_API_SECRET` Bearer check (matches `raas/execute` pattern). |
| C7 | `src/app/api/license/sync/route.ts` | POST | Forces RaaS Gateway → DB license sync; logs audit events. No auth. | Add `INTERNAL_API_SECRET` Bearer or `verifyCronAuth`. |

### HIGH — Mutations / external-cost endpoints missing auth

| # | Route | Method | Issue | Fix |
|---|---|---|---|---|
| H1 | `src/app/api/media/generate/route.ts` | POST | **Calls paid muapi.ai endpoint** without any session/api-key check. Comment says "RaaS license key required" but code doesn't enforce it. | Add `getCurrentUser` + `getUserTier` gate; or require `x-api-key` validation. |
| H2 | `src/app/api/media/status/route.ts` | GET | Returns job status for any `id` — minor info leak. | Add session check + scope to user-owned jobs. |
| H3 | `src/app/api/discovery/search/route.ts` | GET | Hits Sophia index. No auth. | Add session check (matches `/api/discovery/score` pattern). |
| H4 | `src/app/api/discovery/top-50/route.ts` | GET | Same as H3. | Same as H3. |
| H5 | `src/app/api/discovery/validate-link/route.ts` | GET | External fetch (DoS amplification potential). | Add session check + per-user rate-limit. |
| H6 | `src/app/api/graphql/analytics/route.ts` | POST, GET | **Full GraphQL surface over analytics resolvers** with no auth. Major data leak. | Add `getCurrentUser` + tier gate before `executeQuery()`. |

### MEDIUM — Info disclosure

| # | Route | Method | Issue | Fix |
|---|---|---|---|---|
| M1 | `src/app/api/metrics/route.ts` | GET | Prometheus snapshot publicly exposed. Reveals internal traffic patterns. | IP-allowlist or Bearer token (Grafana scrape). |
| M2 | `src/app/api/health/detail/route.ts` | GET | Detailed health (DB, deps) — could fingerprint infra. | Add Bearer or IP-allowlist; keep `/api/health` (basic) public. |

## Top 5 Most Critical Fixes

1. **`/api/debug/migrate`** (C2) — public migration trigger. Single greatest risk; fix or delete immediately.
2. **`/api/graphql/analytics`** (H6) — entire analytics dataset behind unauth GraphQL endpoint.
3. **`/api/usage/debug`** (C3) — cross-tenant usage event read with only `license_nonce` query param.
4. **`/api/debug/db-schema`** (C1) — schema disclosure aids attacker recon.
5. **`/api/internal/usage/query` + `/api/license/sync` + `/api/usage/reconciliation/sync`** (C5/C6/C7) — "internal" by name but world-callable.

## Cross-Cutting Observations

- **CSRF coverage is solid:** `requiresCsrfCheck()` enforced at `proxy()`. Mutating routes outside `/api/auth/`, `/api/webhooks/`, `/api/cron/` get CSRF-checked. No need to add per-route tokens.
- **Cron dev-mode bypass:** `verifyCronAuth()` returns null in `NODE_ENV=development` — confirm Cloudflare prod has `NODE_ENV=production`.
- **Inconsistent "internal" gate pattern:** some routes use `INTERNAL_API_SECRET` (raas/execute), others use `CRON_SECRET` (intelligence/score, ingestion/trigger), others nothing (license/sync, internal/usage/query). Standardise on one helper (e.g. `verifyInternalSecret()`).
- **`/api/debug/*`** should be wrapped behind a build-time flag (e.g. `if (process.env.ENABLE_DEBUG_ROUTES !== 'true') return 404`).
- **Tier gating is lightly applied:** only ~7 routes call `getUserTier`. Many feature endpoints (heygen, media, scripts, discovery) could over-serve free tier. Out of scope for this audit.

## Unresolved Questions

1. Is `/api/internal/usage/query` reachable from outside the Cloudflare Worker, or is it path-prefix-blocked at edge? (Worth confirming `wrangler.toml` routes — current code does NOT enforce internal-only.)
2. Is `/api/inngest` HMAC actually verified by `serve()` from `inngest/next`? (Standard Inngest behavior — verify `INNGEST_SIGNING_KEY` is set.)
3. Are debug routes (`/api/debug/*`, `/api/usage/debug`, `/api/usage/mock`) intended for production at all, or only local dev? Confirm before fixing.
4. Should `/api/metrics` move to a separate Worker route with IP-allowlist via Cloudflare WAF?
