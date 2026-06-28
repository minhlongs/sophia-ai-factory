# Edge Case Verification Report — Checkout + Middleware + Auth

> Generated: 2026-05-30 17:50 PST
> Scope: 4 modified files on `main` branch (uncommitted changes)
> Method: Ultrathink analysis → direct verification (subagents rate-limited)

## Summary

| Metric | Count |
|--------|------:|
| Total edge cases analyzed | 28 |
| ✅ Handled | 14 |
| ❌ Unhandled (need fix) | 8 |
| ⚠️ Partial (need review) | 6 |

## ❌ Unhandled Edge Cases (Need Fix)

| # | Severity | Edge Case | File | Line |
|---|----------|-----------|------|------|
| 1 | **CRITICAL** | Test file syntax error — dangling test outside `describe` block | `route.test.ts` | 223-229 |
| 2 | **CRITICAL** | Dangling test expects 503 but route returns 500; duplicate of test at 216-222 with conflicting status | `route.test.ts` | 223 vs 216 |
| 3 | **HIGH** | Deleted "invalid tier → 400" test — lost POST validation coverage | `route.test.ts` | (removed) |
| 4 | **HIGH** | `free_trial` promo grants trial BEFORE payment — user exploits: enter promo → get trial → abandon checkout | `route.ts` | 190-193 |
| 5 | **HIGH** | Rate limit headers bug: `X-RateLimit-Limit` and `X-RateLimit-Remaining` both use same value | `middleware.ts` | 234-235 |
| 6 | **MEDIUM** | MFA check error is non-fatal → DB error = MFA bypass for sensitive API routes | `middleware.ts` | 99-102 |
| 7 | **MEDIUM** | PayOS yearly error message is Vietnamese-only — non-VN users get incomprehensible error | `route.ts` | 212-213 |
| 8 | **LOW** | Promo discount calculated but NOT applied to NOWPayments invoice — user pays full price despite valid promo | `route.ts` | 263 |

## ⚠️ Partial Handling (Need Review)

| # | Edge Case | File | Issue |
|---|-----------|------|-------|
| 1 | `getUserId()` silently swallows non-AuthSystemError → masks TypeErrors | `route.ts:23-31` | Acceptable for GET (redirect fallback) but risky for POST (could mask real bugs) |
| 2 | GET handler catches ALL errors → masks system failures as /pricing redirect | `route.ts:62` | Design choice but hides D1 outages from users |
| 3 | `writeOrder` non-fatal failure → IPN webhook can't find order | `route.ts:291-297` | Logged as warning but no retry/alert mechanism |
| 4 | Admin tier query case-sensitive | `middleware.ts:174` | Checks 'MASTER'/'master' but not 'Master' — D1 stores uppercase by convention so likely OK |
| 5 | Dedupe 24h window vs actual NOWPayments invoice TTL | `route.ts:135` | May serve expired invoice URLs if NOWPayments TTL < 24h |
| 6 | `orderId` extraction from URL fragile | `route.ts:267` | Fallback creates inconsistent ID format; works but brittle |

## ✅ Handled (No Action Needed)

| # | Edge Case | How Handled |
|---|-----------|-------------|
| 1 | `promoCcodeId` typo | Consistent across interface + DB binding + return — intentional naming (ugly but functional) |
| 2 | `track()` unhandled rejection | Uses `void (async () => { try/catch })()` — safe pattern, errors logged |
| 3 | AuthSystemError.cause propagation | Preserved via `super(message)` + `cause` property, logged in `getCurrentUserFromHeaders` |
| 4 | Race: session expires mid-flow | Low probability; session lifetime >> request duration |
| 5 | Zod validation on POST | `checkoutSchema` enforces `z.enum(["BASIC","PREMIUM","ENTERPRISE","MASTER"])` — invalid tier → 400 via Zod |
| 6 | `getSession()` swallows errors | By design — RSC context where throwing = 500 page; returns null to trigger redirect |
| 7 | Role default 'user' | Correct — new users should default to 'user' role |
| 8 | CSRF + API interaction | CSRF check runs for API paths when applicable; matcher correctly excludes static assets |
| 9 | CSP nonce for API routes | Minimal overhead; consistent security headers |
| 10 | `getD1Raw()` failures in admin check | Fail-closed (deny admin) — correct security posture |
| 11 | `x-quota-remaining` malformed JSON | Caught in try/catch, logged, rate limit headers just not set |
| 12 | PayOS `amount_usd_cents: 0` | VND payment — USD amount genuinely N/A; analytics should filter by `payment_method` |
| 13 | `checkoutSchema` validation | Handles missing/invalid fields properly via Zod safeParse |
| 14 | `assertPaymentMethodAllowed` | Guards PayOS behind feature flag |

## Detailed Analysis of Critical Issues

### Issue 1-2: Test File Syntax Error (CRITICAL)

```
// Line 222: closes describe('POST /api/checkout')
});  it('AuthSystemError...→ POST returns 503...', async () => {
// ^ describe block CLOSED, then orphan test on SAME LINE
```

The `});` at line 223 closes the `describe` block. The `it(...)` immediately after is outside any describe — likely a merge conflict artifact. Additionally:
- Test at line 216 expects **500** for AuthSystemError
- Dangling test at line 223 expects **503** for AuthSystemError
- Route.ts outer catch actually returns **500** (line 313)

**Fix:** Remove dangling test (lines 223-229). The 500-expectation test at 216-222 is correct.

### Issue 3: Missing "invalid tier" Test

Git diff shows the `"invalid tier → 400"` test was replaced by the AuthSystemError test. Zod schema still validates tier, but no test verifies POST returns 400 for invalid tier.

**Fix:** Re-add the test.

### Issue 4: Free Trial Exploit

```typescript
// route.ts:190-193
if (validation.discountType === 'free_trial' && promoTrialDays > 0) {
  const trialEndsAt = Math.floor(Date.now() / 1000) + promoTrialDays * 86400;
  await setUserTrialExpiry(userId, trialEndsAt);
}
```

Trial granted immediately, before any payment. Promo redemption status is 'reserved' but trial is already active.

**Fix:** Move trial grant to IPN handler (after payment confirmed), or add a cron to revoke trials for 'reserved' redemptions older than 2h.

### Issue 5: Rate Limit Headers Bug

```typescript
// middleware.ts:234-235
response.headers.set('X-RateLimit-Limit', String(remaining.hourlyCredits || remaining.dailyCredits))
response.headers.set('X-RateLimit-Remaining', String(remaining.hourlyCredits ?? remaining.dailyCredits))
```

Both headers read from the same field (`remaining.hourlyCredits`). `Limit` should be the MAX quota, `Remaining` should be current remaining count. Currently both show the same number.

## Unresolved Questions

1. Does NOWPayments support custom invoice amounts for promo discounts, or is the full-price-despite-promo behavior intentional?
2. What is the actual NOWPayments invoice TTL? If < 24h, dedupe may serve expired URLs.
3. Is the `promoCcodeId` naming a deliberate convention or a typo that propagated? (Functional but confusing)
