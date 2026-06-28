# Phase 08 — Tests (Vitest Unit + Playwright E2E)

## Context Links
- Existing test config: `apps/sophia-ai-factory/playwright.config.ts`, vitest config in package.json
- Existing test patterns: `src/app/api/checkout/route.test.ts`, `src/lib/billing/__tests__/`
- All previous phases produce code under test

## Overview
- Priority: P1 (gating — no merge without these)
- Status: pending
- Effort: 75m
- Description: Comprehensive test suite covering payment-critical paths. Goal: 100% line coverage on HMAC verification, idempotency, and tier upgrade state machine. Plus one E2E that drives the full purchase flow against NOWPayments sandbox.

## Key Insights
- Many unit tests already authored across earlier phases (HMAC, idempotency, atomic upgrade, repo, status endpoint, receipt email, payos stub). Phase 08 is mainly: (a) E2E orchestration, (b) state machine coverage matrix, (c) gap-filling.
- NOWPayments sandbox: documented at `https://documenter.getpostman.com/view/7907941/2s93JusNJt` — has `sandbox.nowpayments.io` + test API key + simulated IPN trigger.
- E2E uses Playwright already installed; reuse existing playwright.config.ts.

## Requirements

### Functional
- Unit: 30+ new tests across all phases (cumulative count)
- E2E: 1 happy-path test that:
  1. Visits `/pricing`
  2. Logs in (or signs up) via Better Auth magic link in test mode
  3. Clicks PREMIUM → expects redirect to NOWPayments sandbox
  4. Triggers fake IPN via sandbox tooling OR direct curl to webhook with valid sandbox sig
  5. Polls `/api/checkout/status?orderId=...` until completed
  6. Visits `/dashboard` → expects "Premium" tier badge
- E2E: 1 failure-path test (underpayment IPN → status=failed → /checkout/failure renders)

### Non-Functional
- Unit suite p95 < 30s total
- E2E test < 90s (network round-trips dominate)
- Coverage report: `npm run test:coverage` → 100% on critical files: `verifyIpnSignature`, `processNowPaymentsIpn`, `handleFinished`, `pending-order-repo`, `checkout/route POST`

## Architecture
```
Vitest (unit + integration with miniflare D1 mock)
  ├─ HMAC: src/lib/clients/__tests__/nowpayments-hmac.test.ts (5 cases — Phase 03)
  ├─ Idempotency: src/lib/billing/__tests__/nowpayments-ipn-idempotency.test.ts (6 cases — Phase 03)
  ├─ Atomic upgrade: src/lib/billing/__tests__/nowpayments-ipn-atomic-upgrade.test.ts (4 cases — Phase 03)
  ├─ Pending orders repo: src/lib/orders/__tests__/pending-order-repo.test.ts (6 cases — Phase 01)
  ├─ Checkout API: src/app/api/checkout/route.test.ts (extend with period/payos validation — Phase 02)
  ├─ Status endpoint: src/app/api/checkout/status/__tests__/route.test.ts (3 cases — Phase 05)
  ├─ Receipt email: src/lib/billing/email/__tests__/receipt-email.test.ts (4 cases — Phase 06)
  ├─ PayOS stub: src/lib/clients/__tests__/payos-client.test.ts (3 cases — Phase 04)
  └─ NEW state machine: src/lib/billing/__tests__/tier-transition-matrix.test.ts (16 cases — this phase)

Playwright E2E
  ├─ tests/e2e/checkout-happy-path.spec.ts (this phase)
  └─ tests/e2e/checkout-failure-underpayment.spec.ts (this phase)
```

## Related Code Files

### Create
- `src/lib/billing/__tests__/tier-transition-matrix.test.ts` — every from→to combination
- `tests/e2e/checkout-happy-path.spec.ts`
- `tests/e2e/checkout-failure-underpayment.spec.ts`
- `tests/e2e/helpers/nowpayments-sandbox.ts` — wrapper to trigger sandbox IPN with valid sig

### Modify
- `playwright.config.ts` — add new spec paths if needed
- CI workflow `Tests & Deploy` — confirm runs `npm run test:e2e` (or split)

## Implementation Steps

1. Build state machine matrix test (`tier-transition-matrix.test.ts`):
   ```ts
   const tiers: Tier[] = ['BASIC','PREMIUM','ENTERPRISE','MASTER']
   for (const from of tiers) for (const to of tiers) {
     it(`${from} → ${to}`, async () => {
       // seed user with `from` tier
       // simulate IPN finished for `to` invoice
       // assert subscription.plan === to.toLowerCase()
       // assert audit_log row exists
       // assert pending_orders.status === 'completed'
     })
   }
   // → 16 tests; expect downgrade still works (paid downgrade is unusual but legal)
   ```

2. Create sandbox helper `tests/e2e/helpers/nowpayments-sandbox.ts`:
   ```ts
   export async function triggerSandboxIpn(payload: NowPaymentsIpnPayload, secret: string): Promise<Response> {
     const body = JSON.stringify(payload)
     const sig = await computeHmacSha512(body, secret)  // matches verifier
     return fetch(`${process.env.PLAYWRIGHT_BASE_URL}/api/webhooks/nowpayments`, {
       method: 'POST',
       headers: { 'content-type': 'application/json', 'x-nowpayments-sig': sig },
       body,
     })
   }
   ```

3. E2E happy path (`checkout-happy-path.spec.ts`):
   ```ts
   test('full purchase activates tier', async ({ page, request }) => {
     await page.goto('/en/login')
     await loginAsTestUser(page)  // existing helper
     await page.goto('/en/pricing')
     await page.click('button:has-text("Get Growth")')
     await expect(page).toHaveURL(/nowpayments\.io/)
     // Bypass actual nowpayments by extracting orderId from current page URL or cookies
     const orderId = await getOrderIdFromCheckoutResponse(request)
     await triggerSandboxIpn({ payment_id: 'test_'+Date.now(), payment_status: 'finished', invoice_id: NOWPAYMENTS_TIERS.PREMIUM.invoiceId, order_id: orderId, price_amount: 399, price_currency: 'USD', actually_paid: 399 }, process.env.NOWPAYMENTS_IPN_SECRET!)
     // Poll status
     await page.goto(`/en/payment-success?order_id=${orderId}&tier=PREMIUM`)
     await expect(page.locator('text=Payment Confirmed')).toBeVisible({ timeout: 30000 })
     // Verify dashboard
     await page.goto('/en/dashboard')
     await expect(page.locator('text=Growth')).toBeVisible()
   })
   ```

4. E2E failure path (`checkout-failure-underpayment.spec.ts`):
   - Same setup, but trigger IPN with `actually_paid: 100` (underpayment)
   - Expect status endpoint reports failed (or pending, then expired after 60s)
   - /checkout/failure shows correctly

5. Coverage check:
   - `npm run test:coverage`
   - Confirm payment-critical files at 100% line + branch
   - If gaps, add specific assertions

6. CI integration:
   - Confirm `Tests & Deploy` workflow runs `npm test` (covers vitest)
   - Add `npm run test:e2e` step OR add separate E2E job (depends on existing config — investigate)

## Todo List
- [ ] Write tier-transition-matrix.test.ts (16 cases)
- [ ] Create nowpayments-sandbox.ts E2E helper
- [ ] Write checkout-happy-path.spec.ts
- [ ] Write checkout-failure-underpayment.spec.ts
- [ ] Run `npm test` → all green
- [ ] Run `npm run test:coverage` → confirm 100% on critical files
- [ ] Run `npm run test:e2e` → green
- [ ] Run `npm run build` → 0 errors
- [ ] Push to branch → CI green → verify production deploy SHA match
- [ ] Final commit `test: add comprehensive checkout e2e + state matrix coverage`

## Success Criteria
- Aggregate test count increases by 30+
- 100% coverage on `verifyIpnSignature`, `processNowPaymentsIpn`, `handleFinished`, `pending-order-repo`, `route POST checkout`
- Both E2E specs pass
- `Tests & Deploy` workflow → all jobs green
- `/api/version` SHA matches local commit SHA post-deploy

## Risk Assessment
- Risk: NOWPayments sandbox unavailable on CI runner (firewall) → mitigation: E2E uses LOCAL sandbox helper (compute HMAC locally, hit local /api/webhooks/nowpayments) — no external network needed
- Risk: D1 local mock differs from production → mitigation: miniflare-based testing; smoke test on staging post-deploy before main merge
- Risk: Magic-link login in E2E flaky → mitigation: use test-mode login bypass (existing pattern in repo) or pre-seed session token

## Security Considerations
- Test secrets (NOWPAYMENTS_IPN_SECRET) in `.env.test` only — never committed; CI uses separate test secret
- Sandbox helper never sends real money signals
- E2E test users are isolated (test_user_*) with cleanup hook

## Next Steps
- Post-merge: monitor production logs for first real self-serve purchase
- Doc update: `docs/system-architecture.md` — add self-serve checkout section
- Doc update: `docs/development-roadmap.md` — mark GAP 2 as closed

---

# Final Verification Report Template (paste at end of run)

```
## Verification Report — Self-Serve Checkout
- Build: ✅ exit code 0
- Tests: ✅ <N>/<N> passed (delta: +30)
- Coverage: ✅ 100% on payment-critical paths
- E2E: ✅ checkout-happy-path + underpayment specs pass
- Git Push: ✅ <commit_sha> → main
- CI/CD Run: ✅ <run_id> Tests & Deploy completed:success
  - Job: Lint & Build & Test ✅
  - Job: Deploy to Cloudflare Workers ✅
- Production HTTP: ✅ 200 (https://sophia.agencyos.network)
- Deploy SHA Match: ✅ /api/version shortSha == <local_short_sha>
- Manual smoke: ✅ 4 tier checkout URLs generate correctly
- Deploy verified: <ISO timestamp>
```
