# Edge Case Verification Report — Sophia AI Factory

> Parallel codebase review: 6 code-reviewer agents × 30 edge cases
> Date: 2026-05-30 | Branch: main | Codebase: 2154 source files

---

## Summary

| Metric | Count |
|--------|------:|
| Total edge cases | 30 |
| ✅ Handled | 11 |
| ❌ Unhandled | 8 |
| ⚠️ Partial | 11 |

---

## Critical Unhandled (Need Fix)

| # | Edge Case | Category | File(s) | Impact |
|---|-----------|----------|---------|--------|
| 2 | Promo code TOCTOU — `incrementUsedCount` before payment confirmed; abandoned checkouts leak quota permanently | Billing | `app/api/checkout/route.ts` | **HIGH** — promo codes exhaust max_uses from abandonment |
| 5 | `from_tier` hardcoded as `'BASIC'` in tier_conversion signal | Billing | `app/api/webhooks/nowpayments/route.ts:82` | **MED** — analytics corruption; can't distinguish upgrades from new signups |
| 6 | PayOS yearly billing silently downgraded to monthly — no user warning | Billing | `app/api/checkout/route.ts:209` | **HIGH** — price/period mismatch, user charged monthly expecting yearly |
| 8 | MFA bypass on API routes — middleware matcher excludes `/api`, MFA only checked for `/dashboard` paths | Auth | `middleware.ts` | **HIGH** — authenticated user can call all APIs without completing MFA |
| 14 | Zod error `flatten()` returned to webhook caller, leaks internal schema | Webhooks | `app/api/webhooks/nowpayments/route.ts:60` | **MED** — attacker learns field names/types |
| 17 | Account deletion TOCTOU — SELECT then INSERT OR REPLACE without atomicity | Data | `app/api/account/delete/request/route.ts:92-127` | **MED** — concurrent tabs overwrite deletion requests |
| 20 | Order dedup window 30min vs invoice TTL hours — user can pay twice | Data | `app/api/checkout/route.ts:133` | **HIGH** — double-charge risk |
| 26 | 7 cron routes exist but have no mapping in CRON_ROUTES — silently never execute | Cron | `scripts/inject-scheduled-handler.mjs` | **MED** — `quota-check`, `daily-rollup`, etc. never run |

---

## Partial Handling (Need Improvement)

| # | Edge Case | Category | Issue | Priority |
|---|-----------|----------|-------|----------|
| 1 | IPN idempotency fails open on D1 outage — `isPaymentProcessed` catches → returns false | Billing | D1 down = reprocess risk | Low |
| 3 | Double-pay on dedup failure — silent fallthrough creates payable duplicate invoice | Billing | User pays 2 invoices for same tier | High |
| 4 | Missing invoice_id falls through to subscription handler which returns void — no-op but misleading log | Billing | Confusing logging | Low |
| 9 | Unconfigured redirect loop — `/dashboard/onboarding` not exempted from `/dashboard/*` redirect | Auth | Loop during first-time setup | Low |
| 10 | `getCurrentUserFromHeaders` swallows all errors — DB error = 401 instead of 500 | Auth | Lost orders during DB blip | Med |
| 12 | HMAC `split('=')[1]` drops trailing segments — base64 signatures would be truncated | Webhooks | Currently hex-only (safe) but fragile | Low |
| 15 | `getD1ForWebhooks()` returns null silently — webhook events not emitted, no warning log | Webhooks | Silent data loss | Low |
| 24 | Provider key fallback to platform — `getResendKey()`/`getNowPaymentsKey()` default `fallbackToPlatform=true` without metering | BYOK | Platform credits consumed without operator awareness | Med |
| 25 | `seed/security/webhook-signature-verification.ts` uses node:crypto — dead code but could crash if imported from edge route | BYOK | Latent risk | Low |
| 27 | Cron error swallowing — `Promise.allSettled` hides 500 errors from CF; `email-outbox-flush` lacks idempotency guard | Cron | Duplicate email sends | High |
| 30 | Email outbox flush race — concurrent cron runs SELECT same pending rows → duplicate sends | Cron | No `SELECT FOR UPDATE` or status locking | High |

---

## Handled (No Action)

| # | Edge Case | Notes |
|---|-----------|-------|
| 7 | CSRF seed-before-block | Middleware matcher excludes `/api`; webhooks exempt |
| 11 | Admin tier change race | 3-layer defense: middleware + layout + page checks |
| 13 | Buffer length mismatch in timingSafeEqual | Caught by try/catch → returns false |
| 16 | Cron secret replay | Static token but only reachable via CF internal scheduled handler (acceptable risk for internal-only routes) |
| 22 | BYOK timeout abort | AbortController atomic; no partial response path |
| 23 | AES-GCM IV reuse | CSPRNG per-call + AAD binding with userId |
| 27-crypto | Decryption error handling | Graceful null return (but silent — recommend adding logging) |
| 28 | Fulfillment retry exhaustion | Terminal `failed_permanent` state + compensation credit + email notification |
| 25-bonus | node:crypto in Edge | `nodejs_compat` flag set; production paths use Web Crypto |

---

## Recommended Fix Priority

### P0 — Fix Before Next Deploy
1. **#2 Promo TOCTOU**: Move `incrementUsedCount` to IPN handler (after payment confirmed), or add cron to revert `reserved` redemptions >2h old
2. **#6 PayOS yearly**: Return 400 if `paymentMethod=payos && period=yearly` instead of silent downgrade
3. **#8 MFA bypass**: Add MFA status check to sensitive API route handlers (account mutations, billing, admin actions)
4. **#14 Zod leak**: Replace `parsed.error.flatten()` in webhook response with generic `{ error: 'Invalid payload' }`

### P1 — Fix This Sprint
5. **#20 Dedup window**: Extend to 24h or check pending orders by `(userId, tier)` regardless of time
6. **#3 Double-pay**: Add IPN-level dedup on `(user_id, tier)` within 24h window
7. **#30 Email outbox race**: Add `UPDATE SET status='processing' WHERE status='pending'` before send, or add `wasRecentlyRun` guard
8. **#27-cron Error swallowing**: Re-throw errors in `inject-scheduled-handler.mjs` so CF knows handler failed
9. **#5 from_tier**: Query current subscription tier before emitting `TIER_CONVERSION` signal

### P2 — Plan for Next Sprint
10. **#17 Account deletion TOCTOU**: Use `INSERT WHERE NOT EXISTS` or partial unique index
11. **#26 Unmapped crons**: Audit 7 orphan routes; add to CRON_ROUTES or delete
12. **#24 Platform key metering**: Log/alert when `source === 'platform'` for cost awareness
13. **#10 Auth error swallowing**: Distinguish "no session" from "system error" in checkout flow
14. **#29 MCU reset race**: Wrap balance update + transaction log in D1 batch for atomicity

### Backlog
15. **#26-crypto Key rotation**: Plan dual-key decrypt fallback before scaling beyond MVP
16. **#9 Redirect loop**: Exempt `/dashboard/onboarding` from unconfigured redirect
17. **#25 Dead code cleanup**: Remove or archive `seed/security/webhook-signature-verification.ts`

---

## Unresolved Questions

1. Case #8: Which API routes perform sensitive mutations behind auth? Need audit to assess MFA bypass severity
2. Case #9: Does `IS_CONFIGURED=false` occur in production, or only during first-time setup?
3. Case #16: Are cron routes reachable from external network, or only via CF internal service binding?
4. Case #26: Are the 7 unmapped cron routes (quota-check, daily-rollup, etc.) intentionally disabled or accidentally orphaned?
5. Case #24: Is platform key fallback for Resend/NOWPayments a deliberate business decision or oversight?
