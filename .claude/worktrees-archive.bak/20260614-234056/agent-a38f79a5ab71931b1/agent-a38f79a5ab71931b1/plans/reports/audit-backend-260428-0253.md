# Backend Go-Live Audit — Sophia AI Factory

**Date:** 2026-04-28 02:53
**Scope:** Layer 1 Database, Layer 2 Server, Layer 6 Security (target 30/30)
**App path:** `apps/sophia-ai-factory/`
**Stack:** Next.js 16 + OpenNext + Cloudflare Workers + D1 (`sophia-raas-db`) + Better Auth + NOWPayments
**Production:** https://sophia.agencyos.network (commit bc9ab688)

---

## SCORING SUMMARY

| Layer | Score | Verdict |
|-------|-------|---------|
| 1 Database  🗄️ | **8/10** | Solid schema, idempotency, indexes; FK CASCADE rare; no PITR docs |
| 2 Server    🖥️ | **8/10** | Clean middleware pipeline; cron exposed via HTTP; ~462 TS errors masked |
| 6 Security  🔒 | **7/10** | Strong CSP/HSTS/HMAC; admin auth fragmented; CSRF gaps; `unsafe-inline` script |
| **TOTAL** | **23/30** | **Production-ready with caveats — 7 gaps to close for 30/30** |

---

## LAYER 1 — DATABASE 🗄️ (8/10)

### Strengths
- 24 numbered migrations under `migrations/` (`0001-init.sql` … `0024-videos.sql`), `migrations_dir` correctly wired in `wrangler.toml:20`
- 75 `CREATE INDEX` declarations across migrations — well-indexed hot paths (`idx_missions_org_id`, `idx_videos_user_created`, `idx_raas_api_keys_key_hash`)
- Idempotency via `payment_events.event_id UNIQUE` (`migrations/0002-payment-events.sql:4`) and `affiliate_conversions UNIQUE(receipt, event_type)` (`migrations/0022-affiliate-conversions.sql:24`)
- D1 has no native RLS, but server-side ownership filtering enforced consistently — e.g. `eq('user_id', user.id)` (`heygen/status/[id]/route.ts:42`, `raas/missions/[id]/route.ts:38`)
- CHECK constraints on enums (`status IN ('processing','completed','failed')` migration 0024:13)

### Gaps
- **MEDIUM** Only 2 of 34 FK references use `ON DELETE CASCADE` (both Better Auth tables in `0003-better-auth.sql`). Orphan rows possible in `videos`, `missions`, `org_members`, `transactions` when parent deleted.
- **MEDIUM** `users.password_hash` column declared (`0001-init.sql:9`) but Better Auth uses its own `account` table with `password` field — duplicate auth surface, drift risk.
- **MEDIUM** No documented D1 backup/PITR cadence. D1 has automatic Time Travel (30-day) but no run-book for restore.
- **LOW** `transactions.amount REAL` (`0001-init.sql:63`) — REAL stores money lossily; should be INTEGER cents.
- **LOW** Mixed timestamp types: some `TEXT DEFAULT (datetime('now'))`, others `INTEGER DEFAULT (unixepoch())` (`videos.created_at` 0024:17 vs `users.created_at` 0001:17). Pick one per project.

### Fixes for 10/10
1. Add `ON DELETE CASCADE` (or `RESTRICT` for billing) to all 32 remaining FK refs.
2. Drop `users.password_hash` (Better Auth owns auth) — write migration 0025.
3. Add `docs/disaster-recovery.md`: D1 Time Travel restore command, RPO=24h, RTO=1h, quarterly drill.
4. Migrate `transactions.amount`, `org_balances.balance` to INTEGER cents.
5. Standardize all `created_at` to `INTEGER unixepoch()` for sort efficiency.

---

## LAYER 2 — SERVER 🖥️ (8/10)

### Strengths
- 150 API route files under `src/app/api/`, organized by domain
- Centralized middleware pipeline `src/middleware.ts` chains: tenant isolation → webhook version pinning → rate limit → RaaS gate → response (`middleware-api-handler.ts`)
- D1 client clean abstraction `lib/db/client.ts` with sync/lazy proxy fallback (`createServerClient()`)
- Edge runtime explicitly opted-in for hot endpoints (9 routes use `runtime = 'edge'`); 40 routes set `dynamic = 'force-dynamic'`
- Cron jobs gated by `Bearer ${CRON_SECRET}` (`cron/heartbeat/route.ts:32`, `cron/error-digest/route.ts:42`, `intelligence/score/route.ts:18`)
- D1 health probe before heartbeat push (`cron/heartbeat/route.ts:62`) — fails closed
- Webhook canary protection — pins `Cloudflare-Workers-Version-Key: stable` for nowpayments/payos/telegram (`middleware-api-handler.ts:18-29`)
- Bindings clean: `DB`, `ASSETS`, `NEXT_INC_CACHE_R2_BUCKET`, `WORKER_SELF_REFERENCE`, `EXPERIMENT_KV`, `IMAGES`

### Gaps
- **CRITICAL** `next.config.ts:24` `typescript.ignoreBuildErrors: true` masks ~462 TS errors. Build is not a gate. Type-safety is illusory.
- **HIGH** Cron handlers exposed as POST/GET HTTP endpoints (`cron/error-digest/route.ts:128`, `heartbeat:39`) — only `Bearer CRON_SECRET` separates them from public. Should migrate to CF Worker `scheduled()` handler (already noted as TODO in source).
- **MEDIUM** `realtime/alerts/route.ts:78` POST handler instantiates `new NextRequest('http://localhost/...')` — fake request for self-call; brittle and odd in Workers runtime.
- **MEDIUM** `globalThis as unknown as Env` casts proliferate (`cron/heartbeat:59`, `error-digest:143`) — replace with typed `getCloudflareContext()` from `@opennextjs/cloudflare`.
- **LOW** `scriptSrc: ["'unsafe-inline'"]` in CSP (`content-security-policy-configuration.ts:11`) — disables script CSP protection. Use nonce-based CSP for App Router.
- **LOW** No `export const runtime` declared on most routes — defaults to nodejs Worker shim, larger bundle.

### Fixes for 10/10
1. Set `typescript.ignoreBuildErrors: false`. Split-PR cleanup the 462 errors (already tracked as B2 tech-debt).
2. Migrate all `/api/cron/*` to `wrangler.toml [scheduled]` handler — remove HTTP exposure entirely.
3. Replace `globalThis as Env` casts with `getCloudflareContext().env` typed via `cloudflare-env.d.ts`.
4. Convert CSP to nonce-based: `"'self'" "'nonce-${nonce}'" "'strict-dynamic'"`.
5. Audit `realtime/alerts/route.ts` — refactor to direct function call, not synthetic NextRequest.

---

## LAYER 6 — SECURITY 🔒 (7/10)

### Strengths
- HMAC-SHA512 with constant-time compare on NOWPayments IPN (`nowpayments-client.ts:81-110`); HMAC-SHA256 timing-safe for Polar/Telegram (`webhook-signature-verification.ts`)
- Telegram webhook validates `X-Telegram-Bot-Api-Secret-Token` (`webhooks/telegram/route.ts:53`)
- HSTS 2y + preload, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy all set in `next.config.ts:40-77`
- CSP applied globally with explicit allowlist (heygen, openrouter, elevenlabs, nowpayments)
- CORS allowlist (no wildcards) — `cors-security-configuration.ts:12`
- SQL-based sliding-window rate limiter, per-bucket configs (api/webhook/auth/admin/discovery) `sql-rate-limiter.ts:24-31`
- IPN replay-protection via `payment_events.event_id UNIQUE` + signature verification at `webhooks/nowpayments/route.ts:31`
- Tenant isolation middleware blocks cross-tenant resource IDs (`middleware/tenant-isolation.ts:74`)
- Zod schemas widely used (`heygen/create-video/route.ts:16`, `admin/licenses/create/route.ts:20`, `raas/missions/[id]:16`)
- Server-only tier upgrade trust boundary (`webhooks/nowpayments:62` RED-TEAM #11 comment)
- License keys stored as SHA-256 hash, returned full key once (`admin/licenses/create:95,134`)

### Gaps
- **CRITICAL** Three different admin auth schemes coexist:
  1. `checkAdminAuth()` Basic Auth via `ADMIN_USER/ADMIN_PASS` (`admin/licenses/middleware.ts:12`, `admin/audit/reports/route.ts`)
  2. `x-admin-key` against `ADMIN_API_KEY` (`admin/quota/adjust:38`, `admin/quota/mark-billable`)
  3. JWT `Bearer` w/ Basic Auth fallback (`admin/api-keys/[id]/route.ts:27`)
  Inconsistent → high IDOR/admin-auth-bypass risk if one is misconfigured.
- **CRITICAL** Basic Auth over HTTPS still passes admin password in every request — no TOTP/MFA, no session, no rotation. Compromise of Cloudflare logs ⇒ full admin compromise.
- **HIGH** `coupons/apply/route.ts` is **public** (no rate-limit beyond default api bucket, no auth) and lets anyone apply `FREE50 = 100% discount`. Must require auth + per-user use-counter (the `maxUses: 9999` field is currently unenforced — there is no DB lookup of redemptions).
- **HIGH** `errors/report/route.ts` accepts unauthenticated POST and writes to logger with no size cap on `body.message` — log-injection / cost-amplification vector. Cap body size (1KB), strip CR/LF, rate-limit per IP harder than default.
- **HIGH** `setup/save/route.ts:22` accepts arbitrary API keys POST with **no auth** — even though it doesn't persist them, it's a leak vector if someone mistakes it for a real save endpoint. Add `getCurrentUser()` gate.
- **HIGH** `realtime/alerts/route.ts:32` `GET` initialises Supabase Realtime subscriptions with **zero auth** — anyone can poke this and (re)subscribe; should be cron-only or admin-only.
- **HIGH** No CSRF protection visible. Better Auth has built-in CSRF via cookie+header but state-changing endpoints not using Better Auth (`admin/*`, `coupons/*`, `setup/save`) are pure POST without CSRF token check.
- **MEDIUM** `verifyCronSecret()` returns `true` in dev (`cron/heartbeat:30`, `error-digest:39`). Acceptable but make sure `NODE_ENV` cannot be flipped via env injection in production.
- **MEDIUM** `script-src 'unsafe-inline'` (`content-security-policy-configuration.ts:11`) — XSS gate disabled. Use nonces.
- **MEDIUM** CSP still allows `https://*.supabase.co` even though stack migrated to D1 — drop to shrink attack surface.
- **MEDIUM** `setup-wizard` redirect logic in `middleware.ts:33` reads `NEXT_PUBLIC_IS_CONFIGURED` — public env var controls security-relevant routing; safer with server-side D1 lookup.
- **MEDIUM** `apply CorsHeaders` allows `*` methods incl. `DELETE/PUT` for any allow-listed origin — narrow per-route.
- **LOW** `admin/api-keys/[id]:43` falls back to Basic Auth even when JWT validation failed silently — log mismatch, return 401.
- **LOW** `users.password_hash` schema column unused but exists — remove to avoid accidental writes.

### Fixes for 10/10
1. **Unify admin auth**: single `requireAdmin(request)` helper using Better Auth session + `users.role = 'admin'` D1 check. Delete `ADMIN_USER/ADMIN_PASS` and `ADMIN_API_KEY` env-var paths.
2. **Add MFA/TOTP** for admin role via Better Auth two-factor plugin.
3. **Lock down public endpoints**: `coupons/apply` (auth + DB redemption count), `errors/report` (size-cap, IP rate-limit 10/min), `setup/save` (auth required), `realtime/alerts` (cron-secret).
4. **CSRF**: enforce `X-CSRF-Token` header check on every non-Better-Auth POST/PUT/PATCH/DELETE; helper in `middleware-api-handler.ts`.
5. **Nonce-based CSP**: drop `'unsafe-inline'` from `scriptSrc`; emit per-request nonce and inject into Next root layout.
6. **Drop `https://*.supabase.co`** from CSP `connect-src` once OAuth callbacks confirmed not using Supabase Realtime.
7. **Confirm secrets** via `wrangler secret list` (out-of-band): `NOWPAYMENTS_IPN_SECRET`, `RAAS_LICENSE_SECRET`, `CRON_SECRET`, `INTERNAL_API_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_API_KEY`, `ADMIN_PASS` are all CF Secrets (not in `wrangler.toml`) — wrangler.toml `[vars]` block is empty, **good**.
8. **Audit log review**: `audit_logs` writes happen but no admin UI to surface — add tamper-evident hash-chain (hash prev row).

---

## TECH-DEBT QUICK SCAN

| Pattern | Count | Status |
|---------|-------|--------|
| `: any` in `src/app/api/**/route.ts` | **0** | ✅ |
| `console.*` in `src/` (non-test, non-logger) | 5 | ⚠ Trace and remove |
| `TODO` / `FIXME` in `src/` | 11 | ⚠ Acceptable |
| `@ts-ignore` / `@ts-nocheck` | 1 | ⚠ Locate and fix |
| TS errors masked by `ignoreBuildErrors` | ~462 | 🔴 CRITICAL |
| Hardcoded secrets in `src/` | 0 | ✅ |
| `wrangler.toml [vars]` block leakage | 0 | ✅ |

---

## PRIORITISED ACTION LIST (to reach 30/30)

### CRITICAL (must fix before declaring 100/100)
1. Unify admin auth → single Better-Auth-backed `requireAdmin()` (Layer 6)
2. Fix the 462 TS errors and flip `ignoreBuildErrors: false` (Layer 2)
3. Auth-gate `coupons/apply`, `errors/report`, `setup/save`, `realtime/alerts` (Layer 6)

### HIGH
4. Migrate `/api/cron/*` HTTP routes → `wrangler.toml` `[triggers] scheduled()` (Layer 2)
5. Add CSRF token enforcement on non-Better-Auth mutating endpoints (Layer 6)
6. Add MFA for admin role (Layer 6)
7. Nonce-based CSP — drop `script-src 'unsafe-inline'` (Layer 6)

### MEDIUM
8. Add `ON DELETE CASCADE`/`RESTRICT` to remaining 32 FK refs (Layer 1)
9. Migrate money columns to INTEGER cents (Layer 1)
10. Document D1 Time Travel disaster recovery + quarterly drill (Layer 1)
11. Replace `globalThis as Env` casts with `getCloudflareContext()` (Layer 2)
12. Drop unused `users.password_hash` and `https://*.supabase.co` from CSP (Layers 1, 6)

---

## UNRESOLVED QUESTIONS
1. Is `ADMIN_PASS` rotated on a schedule? Cannot verify from repo.
2. Are CF secrets `NOWPAYMENTS_IPN_SECRET` etc. set in production? Verify via `wrangler secret list --name sophia-ai-factory`.
3. Does Better Auth two-factor plugin work on Workers runtime? Needs spike before MFA adoption.
4. Is the `users.role = 'admin'` field actually populated for any user in production D1? If empty, switching admin auth to RBAC will lock everyone out.
5. Are the 11 TODO/FIXME comments security-relevant? Each needs a quick triage.
6. PostHog telemetry sends `distinctId` from `ipn.order_id.split('_')[1]` (`webhooks/nowpayments:63`) — what if `order_id` lacks underscore? Possible `undefined` distinctId pollution.
