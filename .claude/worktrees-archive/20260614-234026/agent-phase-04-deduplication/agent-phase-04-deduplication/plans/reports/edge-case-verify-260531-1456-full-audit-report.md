# Edge Case Verification Report — sophia-ai-factory

**Date:** 2026-05-31
**Scope:** Full codebase parallel edge case verification
**Reviewers:** 6 agents (payment❌, auth✅, mission✅, middleware✅, D1✅, security✅)
**Total edge cases audited:** 32

---

## Summary

| Metric | Count |
|--------|------:|
| Total edge cases | 32 |
| ✅ Handled | 18 |
| ⚠️ Partial | 11 |
| ❌ Unhandled | 3 |

---

## Unhandled Edge Cases (Need Fix)

| # | Edge Case | Category | Severity | Files |
|---|-----------|----------|----------|-------|
| 1 | Mission stuck 'pending'/'running' if Worker crashes between status updates — no retry/sweeper | Mission | HIGH | `forest/missions/dispatcher.ts:68-100` |
| 2 | Webhook endpoints (/api/webhooks/*) have ZERO rate limiting — flood attack vector | Security | HIGH | `app/api/webhooks/heygen/route.ts` |
| 3 | API key `expires_at` column in schema but NEVER checked in `validateMissionApiKey()` — expired keys authenticate indefinitely | Auth | MEDIUM | `forest/missions/api-key-auth.ts:93` |

## Partial Handling (Need Review)

| # | Edge Case | Category | Issue | Files |
|---|-----------|----------|-------|-------|
| 4 | Credits deducted pre-execution, no refund on timeout | Mission | "Reaper" referenced in comments but unimplemented | `dispatcher.ts:130-149` |
| 5 | JSON.parse(params) silently falls back to {} | Mission | No log warning, produces wrong results while charging credits | `dispatcher.ts:118-123` |
| 6 | Handler import failure → misleading "Unknown command" | Mission | Real error only in logs, user sees wrong message | `dispatcher.ts:19-49` |
| 7 | Credit race → permanent mission failure | Mission | Atomic guard correct but no retry for transient races | `credits-repo.ts:71-83` |
| 8 | Empty Bearer token leaks info via different error text | Auth | `"Bearer "` → empty string → different 401 message than missing header | `api-key-auth.ts:62-63` |
| 9 | MFA gap: BYOK routes bypass MFA | Auth | `/api/user/byok` stores external API keys without MFA | `middleware.ts:85-86` |
| 10 | CSP nonce no Cache-Control: no-store | Middleware | If CDN caches HTML, nonce leaks across users | `middleware.ts:45-49` |
| 11 | `handleApiRoute()` is dead code — matcher excludes /api | Middleware | Tenant isolation/rate limiting never runs via middleware | `middleware.ts:287` |
| 12 | 3 cron routes return raw `err.message` in responses | Security | Internal details exposed if CRON_SECRET leaks | `cron/email-drip`, `cron/fulfillment-retry`, `cron/weekly-signals-digest` |
| 13 | D1 proxy returns `undefined` for unknown methods | D1 | Fragile proxy — no fail-fast or log | `seed/db/client.ts:84-104` |
| 14 | `getD1Sync()` 4-path fallthrough — no binding name validation | D1 | Fake binding could pass through | `seed/db/client.ts:25-50` |

---

## Handled Edge Cases (No Action Needed)

| # | Edge Case | How Handled |
|---|-----------|-------------|
| 15 | IPN idempotency via UNIQUE constraint on event_id | `nowpayments-ipn-handlers.ts:38` |
| 16 | Underpayment guard (0.99 threshold) | `nowpayments-ipn-subscription.ts:23-39` |
| 17 | D1 batch with fallback to individual statements | `nowpayments-ipn-subscription.ts:76-116` |
| 18 | CSRF bypass on webhook/cron prefixes | `seed/security/csrf.ts:27` |
| 19 | Cron secret validation on all 32 routes | `seed/security/cron-auth.ts` |
| 20 | CRON_ROUTES maps all 19 wrangler.toml patterns | `scripts/inject-scheduled-handler.mjs` |
| 21 | PII scrubbing in logger pipeline | `logger-utility.ts` + `pii-scrubber.ts` |
| 22 | Admin tier fails closed on DB errors | `middleware.ts:183-189` |
| 23 | Session fallback returns null on expired session | `better-auth-session.ts:47-49` |
| 24 | Webhook signature verification (NOWPayments HMAC-SHA512) | `nowpayments/route.ts:44` |
| 25 | CORS Vary: Origin prevents cache poisoning | `cors-security-configuration.ts` |
| 26 | `getDb()` in nowpayments-ipn-db consistent with createServerClient | `nowpayments-ipn-db.ts:10-12` |
| 27 | MFA fail-closed on DB errors | `middleware.ts:99-106` |
| 28 | 24h dedup guard against double-payment | `nowpayments-ipn-dispatch.ts:52-87` |
| 29 | `isConfigured` redirect intentional for setup flow | `middleware.ts:110-122` |
| 30 | CORS null origin returns 403 (secure posture) | `cors-security-configuration.ts:23` |
| 31 | Referrer reward wrapped in try/catch (non-fatal) | `nowpayments-ipn-subscription.ts:252-286` |
| 32 | Audit trail non-fatal, doesn't block payment flow | `nowpayments-ipn-subscription.ts:130-139` |

---

## Priority Fix Recommendations

### P0 — Fix Now
1. **Add mission stuck sweeper** — periodic job to reset `running` missions >5min back to `pending`
2. **Add webhook rate limiting** — per-IP or per-jobId cap on `/api/webhooks/*`
3. **Check `expires_at` in API key auth** — column exists, never read

### P1 — Fix This Sprint
4. **Add `Cache-Control: no-store`** in `attachCspHeaders()`
5. **Log warning on JSON.parse failure** in dispatcher params
6. **Differentiate error messages** — "Unknown command" vs "Handler module failed"
7. **Return generic error** in cron routes instead of `err.message`

### P2 — Nice to Have
8. **Add retry loop** for credit deduction (2-3 attempts, 500ms backoff)
9. **Normalize error text** for empty Bearer token vs missing header
10. **Add MFA to BYOK routes** (`/api/user/byok`)

---

## Unresolved Questions
- Is `handleApiRoute()` truly dead code, or called via route wrapper not found by grep?
- Does Cloudflare-level rate limiting cover webhook endpoints at the edge?
- "Reaper" job referenced in dispatcher.ts:149 — planned or removed?
- Is there an Inngest scheduled function for mission lifecycle management?
