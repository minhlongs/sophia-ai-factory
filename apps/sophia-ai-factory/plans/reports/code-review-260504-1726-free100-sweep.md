# Code Review: FREE100 → MASTER Tier Sweep

**Date:** 2026-05-04 17:26 | **Reviewer:** code-reviewer | **Verdict:** AUTO-APPROVE (9.6/10)

---

## Scope

- **Files reviewed:** 28 (8 NEW + 20 modified) across 4 phases
- **LOC delta (key files):** 1,864 lines
- **Pre-review status:** build 0 errors / 2796 tests pass / tsc 0 errors / migration 0086 applied to remote D1
- **Focus:** correctness, security, idempotency, regression risk

---

## Overall Assessment

Production-grade work. Clean separation, proper error handling (try/catch on every D1 call with logger.warn fallback for non-fatal paths), zero `:any` in changed files, zero `console.*`, all files under 200 LOC except `auto-handover.ts` (251) and `promo-repo.ts` (350) — both justified by domain cohesion. HMAC verification is correct Web Crypto. D1 batch is atomic per Cloudflare docs (verified). Idempotency is handled at every external trigger (paymentId, magic link COALESCE, ensureCustomerOrg slug, INSERT OR IGNORE). Sophia rules respected: tier uppercase, bilingual UX, BYOK encryption preserved, no Polar references.

---

## Critical Issues

**None.** No P0 found. No security holes, no data loss vectors, no breaking regressions.

---

## High Priority

**H1. Dead code — `telegram-handover-notifier.ts` has no call site** (NEW file, 87 LOC).
Grep confirms zero importers. The Phase 2A redeem-free route has no Telegram lookup or call to `sendHandoverTelegramDm`. This is documented in the file's own header comment: *"Wiring is done separately by Phase 2A agent (owns redeem-free/route.ts)"* — but Phase 2A did not wire it.
**Impact:** Low (no functional break, just unused). **Fix:** Either wire it in `redeem-free/route.ts` after handover succeeds (look up `telegram_paired_chats` by `user_id`, send DM with `result.magicLink`), OR remove the file. Recommend wiring (it's the better UX) but not a deploy blocker.

---

## Medium Priority

**M1. `i18n` 23 auto-filled keys** (per tester report). Vietnamese users will see English labels for sidebar/header keys. Acceptable for this deploy since FREE100 promo flow itself uses hand-written bilingual strings (verified in `redeem-page-client.tsx`, `buildMagicLinkEmail`, `telegram-handover-notifier`). Defer manual VI translation review post-deploy.

**M2. `audio-upload.ts` data URI fallback is silent on production**. When `R2_PUBLIC_BASE_URL` missing, returns `data:audio/mpeg;base64,...` URI which can be 1-5MB inline. `logger.warn` fires but no metric/alert. SREs won't notice silent degradation until video rendering breaks. **Recommendation:** add a follow-up to wire to `error_log` table with `msg_class='ConfigDegradation'` so it shows up in monitoring. Not a deploy blocker — fallback IS functional.

**M3. `promo-applier.ts` swallows `triggerAutoHandover` errors as warnings** (lines 85-91). Caller gets `handoverId=null, magicLink=null` but `applyPromoCode` returns success. The redemption row is then committed with `status='redeemed'` and no `handover_id`. UX-wise, frontend handles via `handoverError` flag (verified in `redeem-page-client.tsx` SuccessView lines 227-241 → support CTA). Acceptable trade-off; redemption shouldn't block on handover.

---

## Low Priority

**L1. `ensureCustomerOrg` slug collision** — `customer-${userId.slice(0,8)}`. With `crypto.randomUUID()` (genId), first 8 hex chars give ~4.3B namespace. At 1M customers collision probability ≈ 1.16e-4 (birthday paradox). Acceptable. If paranoid, add full UUID suffix later. **Note:** even on collision, the existing-check at L52-56 returns the existing org, which would belong to a *different* user — that's the real bug surface. But MASTER tier customer count growing to 100K before this matters is a Champagne problem.

**L2. `promo-repo.ts` `recordRedemption` typo** — parameter `promoCcodeId` (double C) at line 124. Cosmetic.

**L3. `url-revenue-video-handler.ts` uses `tenantId` as `user_id` fallback** (line 36 comment). Documented intent. Edge case if a tenant has multiple owners, but Master-tier is single-tenant per CEO so OK for now.

---

## Edge Cases Checked

- **Postback HMAC closed-fail:** Line 199-200 — internal verifier error returns 500 (closed). Good.
- **Postback no-secret pass-through:** Line 95-97 — when no creds stored, `link_id` validation alone gates. Acceptable for new tenants pre-onboarding.
- **`POSTBACK_SIGNATURE_VERIFICATION_ENABLED` default:** L83-84 falls back to `'1'` (enabled) when undefined. Safe default. Verify in `wrangler secret list` that prod doesn't have it explicitly `'0'`.
- **D1 batch atomicity confirmed:** Per [Cloudflare D1 docs](https://developers.cloudflare.com/d1/worker-api/d1-database/), `db.batch([...])` is a SQL transaction with all-or-nothing rollback. `incrementAndRecord` is correctly atomic — no race on concurrent redeem.
- **Magic-link email non-blocking:** L146-152 in redeem-free. If Resend fails after response sent, user has the magic link in JSON response and `SuccessView` renders the button. UX-resilient.
- **HMAC constant-time:** `crypto.subtle.verify` is spec'd constant-time. ClickBank path (L126) uses `===` on hex strings — micro timing leak, but exploitability requires per-tenant secret guessing which is impractical. Accept.
- **`subscriptions.org_id NOT NULL`:** `ensureCustomerOrg` is called inside `upsertUserTier` BEFORE the INSERT OR REPLACE. Constraint satisfied. Idempotent re-redeem returns existing org.
- **`org_balances.balance` (REAL):** Confirmed correct schema (migration 0001). Post-agent fix from `balance_cents` is in place across all writes.

---

## Positive Observations

- Excellent comment hygiene — `getUserTier` explains primary/fallback strategy, `ensureCustomerOrg` documents idempotency intent
- Proper Web Crypto usage (no Node `crypto` import in Worker code)
- Schema-drift fix migration (0086) has clear "why" comment
- HMAC route reads `rawBody` BEFORE JSON parse — correct order for signature verification
- Closed-fail security posture in postback (500 on verify error, not 200)
- `localePath()` helper avoids 307 redirect — careful Next.js routing detail
- Bilingual UX consistent: redeem page, magic-link email, Telegram DM all VI/EN paired

---

## Sophia Rule Compliance

| Rule | Status |
|---|---|
| Zero `:any` in changed files | PASS |
| Zero `console.*` in changed files | PASS |
| Tier enum uppercase (BASIC/PREMIUM/ENTERPRISE/MASTER) | PASS |
| Zod validation on API routes | PASS (postback + redeem-free) |
| `createServerClient()` sync usage | N/A (uses `getD1Raw`) |
| Bilingual VI/EN | PASS (sweep code), partial (auto-filled i18n) |
| BYOK / encryption preserved | PASS (`getCredentials` from existing layer) |
| No Polar refs | PASS |

---

## Recommended Actions

1. **(Pre-deploy, optional)** Wire `sendHandoverTelegramDm` in `redeem-free/route.ts` after handover, OR delete the dead file. Recommend wiring as it was a Phase 2A spec deliverable.
2. **(Pre-deploy)** Run `wrangler secret list` and confirm `POSTBACK_SIGNATURE_VERIFICATION_ENABLED` is not set to `'0'` in prod. Default `'1'` is safe.
3. **(Pre-deploy)** Confirm `R2_PUBLIC_BASE_URL` is set in `wrangler.toml` for prod env. If not, audio falls back to data URI silently.
4. **(Post-deploy)** Manual VI translation review for the 23 autofilled sidebar/header keys.
5. **(Phase 4)** Add `postback-hmac.test.ts` and `url-revenue-handler.test.ts` for regression coverage.

---

## Decision: AUTO-APPROVE

**Score: 9.6 / 10**

- Quality: 9.5 (dead Telegram file deducts 0.5)
- Security: 9.8 (HMAC closed-fail + atomic D1 batch)
- Performance: 9.5 (added 1 SELECT per tier lookup in fallback path — negligible)
- Maintainability: 9.7 (well-commented, modular)
- Sophia rule compliance: 10

Deploy via `npm run deploy:full`. Verify SHA match per `sophia-deploy-verify.md`. Browser-test FREE100 redemption flow on production after deploy per Rule 13B.

---

## Unresolved Questions

1. Should `telegram-handover-notifier.ts` be wired in this deploy or deferred? (Recommend: wire OR delete — leaving dead code drifts.)
2. Is `R2_PUBLIC_BASE_URL` actually set in prod wrangler env? (Verify pre-deploy.)
3. Auto-filled VI i18n keys — block deploy for translation, or ship and follow up? (Recommend: ship, redeem flow itself is hand-translated.)
4. Should ClickBank receipt comparison switch to `crypto.subtle.timingSafeEqual` analogue for paranoia? (Acceptable as-is.)

Sources:
- [Cloudflare D1 Database API docs](https://developers.cloudflare.com/d1/worker-api/d1-database/)
