# Edge Case Verification Report — Sophia AI Factory

> **Date:** 2026-05-30 | **Branch:** main | **SHA:** 4bca4710
> **Method:** Ultrathink edge case identification → 5 parallel code-reviewer agents
> **Scope:** Full codebase — auth, payments, webhooks, crypto, database

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total edge cases verified | 25 + 1 bonus |
| ✅ Handled | 7 |
| ⚠️ Partial | 12 |
| ❌ Unhandled | 7 |
| **CRITICAL** severity | 3 |
| **HIGH** severity | 4 |

### Top 3 Findings (Act Now)

1. **[CRITICAL] Middleware matcher excludes `/api` — entire API security layer is dead code** (MFA, CSRF, rate limiting, usage metering for API routes never executes)
2. **[CRITICAL] Tenant scoping not applied in repositories** — write operations in `videos-repo.ts` lack user ownership checks, accessible from webhook handlers
3. **[HIGH] NOWPayments IPN idempotency has TOCTOU race** — concurrent IPNs can double-credit users

---

## Detailed Findings by Category

### 1. Auth & Middleware Security

| # | Edge Case | Status | Severity |
|---|-----------|--------|----------|
| 1.1 | MFA bypass — middleware matcher excludes `/api`, MFA gate is dead code | ❌ | **CRITICAL** |
| 1.2 | Admin tier check race condition — 3-layer defense-in-depth, fail-closed | ✅ | Low |
| 1.3 | CSRF cookie non-HttpOnly + CSP compensation — CSP nonce-based is strong but CSRF check for API routes also dead code | ⚠️ | Medium |
| 1.4 | Session error vs no-session ambiguity — `getSession()` swallows errors, returns null | ⚠️ | Medium |
| 1.5 | Middleware matcher gap confirmed — all API security logic (MFA, CSRF, rate limiting, metering, CSP headers) is dead code | ❌ | **CRITICAL** |

**Key insight:** Edge cases 1.1 and 1.5 are the same root cause — matcher regex `(?!api|...)` excludes `/api` routes. This means:
- MFA enforcement for `/api/account`, `/api/checkout`, `/api/admin/*`: **not running**
- CSRF verification for mutating API calls: **not running**
- `handleApiRoute()` (likely rate limiting/blocking): **not running**
- Usage metering & response time tracking: **not running**
- CSP headers for API responses: **not set**

**Fix:** Change matcher to `['/((?!_next|_worker|auth/callback|.*\\..*).*)']` — include `/api` routes. Test Better Auth routes still work.

---

### 2. Payment & Billing Webhooks

| # | Edge Case | Status | Severity |
|---|-----------|--------|----------|
| 2.1 | NOWPayments IPN replay — idempotency check exists but TOCTOU gap | ⚠️ | **High** |
| 2.2 | order_id parsing — safe in domain layer, unsafe in route analytics layer | ⚠️ | Medium |
| 2.3 | Concurrent IPN race condition — no atomic lock, side-effects can double-fire (referral rewards, emails) | ⚠️ | **High** |
| 2.4 | PayOS webhook signature — proper HMAC + timing-safe + idempotency | ✅ | Low |
| 2.5 | Dunning cancelled subscription — no subscription status check in dunning flow | ⚠️ | Medium |

**Key insight:** `isPaymentProcessed()` + `recordIpnEvent()` pattern is non-atomic. Two concurrent IPNs pass check simultaneously → both proceed → double tier activation, double referral rewards, double welcome emails.

**Fix:** Atomic idempotency: `INSERT INTO payment_events ... ON CONFLICT(event_id) DO NOTHING RETURNING event_id` — if no row returned, already processed.

---

### 3. HeyGen Webhook & Video Fulfillment

| # | Edge Case | Status | Severity |
|---|-----------|--------|----------|
| 3.1 | Cross-tenant video update in legacy path — unscoped when ownerUserId null + platform secret | ⚠️ | Medium |
| 3.2 | Signature header fallback chain — empty string check + HMAC verification | ✅ | N/A |
| 3.3 | No webhook secret = silent 200 — drops event, doesn't process (ops risk, not security) | ❌ | Low |
| 3.4 | completeVideoFromWebhook unguarded throw → 500 → HeyGen retry storm | ❌ | **High** |
| 3.5 | Empty video_id passed to fulfillment — effectively no-op, wastes D1 query | ⚠️ | Low |

**Key insight:** `completeVideoFromWebhook` and `failVideoFromWebhook` calls at `route.ts:162-182` have NO try/catch. D1 outage → 500 → HeyGen retry storm → amplified load during outage.

**Fix:** Wrap in try/catch, return `200 { ok: true, error: 'internal' }` to prevent retry storm. Cron poller provides eventual consistency.

---

### 4. Encryption & Secrets

| # | Edge Case | Status | Severity |
|---|-----------|--------|----------|
| 4.1 | Node.js `crypto` import in Edge runtime — barrel re-export is time bomb | ⚠️ | Medium |
| 4.2 | Decrypt hex validation missing — NaN bytes from malformed input | ❌ | Medium |
| 4.3 | BYOK timeout vs CF Workers CPU limit — 5s headroom, clean cleanup | ✅ | Low |
| 4.4 | Key rotation gap — `encryption-aes-gcm.ts` has no rotation mechanism | ⚠️ | **High** |
| 4.5 | API key hash timing attack — constant-time XOR, format pre-validated | ✅ | Low |
| 4.B | **BONUS: Fake SHA-256** — `crypto-utils.ts:sha256()` is custom djb2 hash, NOT cryptographic SHA-256 | ⚠️ | **High** |

**Key insight:** `crypto-utils.ts` exports a function named `sha256` that is NOT SHA-256 — it's a custom djb2+mixing hash. Used for audit log hash chain where collision resistance matters.

**Fix:** Rename to `fastHash()` or `contentFingerprint()`. For audit logs, use `crypto.subtle.digest('SHA-256', ...)`.

---

### 5. D1 Database & Rate Limiting

| # | Edge Case | Status | Severity |
|---|-----------|--------|----------|
| 5.1 | D1 client fallback chain — production safe, test-might-hit-prod risk | ⚠️ | Low |
| 5.2 | Rate limiter record accumulation — cleanup function exists but never called | ⚠️ | Medium |
| 5.3 | Tenant scoping not applied in repositories — write ops lack ownership checks | ❌ | **CRITICAL** |
| 5.4 | Billing atomicity — referral credit read-modify-write race, non-atomic fallback | ⚠️ | **High** |
| 5.5 | CAS concurrent write safety — properly implemented with RETURNING clause | ✅ | N/A |

**Key insight:** `TenantScopedClient` exists but is **never imported** by any repository. `videos-repo.ts` write functions (`markVideoProcessing`, `recordAttempt`, `markPermanentFailure`, `revokeAccessByPurchaseId`) use only `id` in WHERE — no ownership check. Accessible from webhook handlers where caller identity may not match row owner.

**Fix:** Add `user_id` to WHERE clauses in all write operations, or apply `withTenantScope` wrapper.

---

## Priority Action Plan

### P0 — Fix This Week (Security/Data Integrity)

| # | Issue | Severity | Effort | Files |
|---|-------|----------|--------|-------|
| 1 | Fix middleware matcher to include `/api` routes | CRITICAL | Small | `src/middleware.ts:283` |
| 2 | Add tenant scoping to repository write ops | CRITICAL | Medium | `src/seed/db/repositories/videos-repo.ts`, others |
| 3 | Make IPN idempotency atomic (INSERT ON CONFLICT) | HIGH | Small | `src/land/billing/nowpayments-ipn-db.ts` |
| 4 | Wrap HeyGen fulfillment calls in try/catch | HIGH | Small | `src/app/api/webhooks/heygen/route.ts:162-182` |

### P1 — Fix This Sprint (Reliability/Correctness)

| # | Issue | Severity | Effort | Files |
|---|-------|----------|--------|-------|
| 5 | Make referral credit atomic (json_set in single UPDATE) | HIGH | Small | `nowpayments-ipn-subscription.ts:260-276` |
| 6 | Rename fake sha256 → fastHash, use real SHA-256 for audit | HIGH | Medium | `src/seed/security/crypto-utils.ts` |
| 7 | Add key rotation to encryption-aes-gcm.ts | HIGH | Medium | `src/seed/security/encryption-aes-gcm.ts` |
| 8 | Replace route-level order_id parser with safe version | Medium | Small | `src/app/api/webhooks/nowpayments/route.ts:80` |

### P2 — Fix Next Sprint (Hardening)

| # | Issue | Severity | Effort | Files |
|---|-------|----------|--------|-------|
| 9 | Wire cleanupExpiredRateLimits into cron | Medium | Small | `src/seed/security/sql-rate-limiter.ts` |
| 10 | Add hex validation to decrypt() | Medium | Small | `src/seed/security/encryption-aes-gcm.ts` |
| 11 | Add dunning subscription status check | Medium | Small | dunning modules |
| 12 | Migrate webhook-signature-verification to Web Crypto | Medium | Medium | `src/seed/security/webhook-signature-verification.ts` |
| 13 | Create getSessionStrict() throwing variant | Medium | Small | `src/seed/auth/better-auth-session.ts` |

---

## Unresolved Questions

1. `handleApiRoute()` in `middleware-api-handler.ts` — what does it contain? If rate limiting, it's also dead code.
2. Are non-CAS variants of `recordAttempt` / `markPermanentFailure` still called from concurrent paths?
3. Does `videos` table have `tenant_id` column, or only `user_id`?
4. Is `.gitlab-ci.yml` active or historical?
5. Has Phase B+ dual-key rotation for `encrypt-secret.ts` been implemented?

---

## Files Reviewed (across all 5 agents)

- `src/middleware.ts` — middleware logic + matcher
- `src/seed/auth/better-auth-session.ts` — session management
- `src/seed/auth/require-master-tier.ts` — admin gate
- `src/seed/security/csrf.ts` — CSRF implementation
- `src/seed/security/content-security-policy-configuration.ts` — CSP
- `src/seed/security/encryption-aes-gcm.ts` — AES-GCM encryption
- `src/seed/security/webhook-signature-verification.ts` — webhook HMAC
- `src/seed/security/crypto-utils.ts` — hash utilities
- `src/seed/security/api-key-validator*.ts` — API key validation
- `src/seed/security/sql-rate-limiter.ts` — rate limiting
- `src/seed/db/client.ts` — D1 client
- `src/seed/db/with-tenant-scope.ts` — tenant isolation
- `src/seed/db/repositories/videos-repo.ts` — video CRUD
- `src/app/api/webhooks/nowpayments/route.ts` — IPN webhook
- `src/app/api/webhooks/heygen/route.ts` — HeyGen webhook
- `src/app/api/webhooks/payos/route.ts` — PayOS webhook
- `src/land/billing/nowpayments-ipn-handlers.ts` — IPN processing
- `src/land/billing/nowpayments-ipn-db.ts` — IPN database ops
- `src/land/billing/nowpayments-ipn-subscription.ts` — subscription activation
- `src/lib/fulfillment/complete-video-from-webhook.ts` — video fulfillment
- `src/lib/webhooks/heygen-signature-verifier.ts` — HeyGen HMAC
- `src/lib/webhooks/heygen-webhook-secret-resolver.ts` — per-customer secrets
- `src/tree/byok/with-timeout.ts` — BYOK timeout
- `src/tree/credentials/encryption.ts` — credential encryption
- `src/tree/crypto/encrypt-secret.ts` — secret encryption
