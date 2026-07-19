# Phase A — NOWPayments Tier Upgrade E2E Verify

**Owner:** fullstack-developer (payments)
**File ownership:** `src/app/api/checkout/**`, `src/components/pricing/coupon-input.tsx`, `src/components/pricing/pricing-card.tsx`, NEW `src/app/api/checkout/checkout.test.ts`

## Goals

1. Verify `/api/checkout?tier=BASIC|PREMIUM|ENTERPRISE|MASTER` returns NOWPayments invoice URL when authed
2. Verify anonymous flow → redirect to `/login?redirect=...`
3. Add Vitest test covering 4 tiers + auth + tier mapping
4. Add UX toast in `pricing-card.tsx` for fetch failures

## Current State (scout findings)

- `src/app/api/checkout/route.ts` exists with GET handler
- `createInvoiceUrl(mappedTier, userId)` from `nowpayments-client.ts`
- Tier mapping: STARTER→BASIC, GROWTH→PREMIUM, PREMIUM→ENTERPRISE, MASTER→MASTER
- 3 secrets present: NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, NOWPAYMENTS_WALLET

## Implementation Steps

1. Read `src/app/api/checkout/route.ts` and `src/lib/clients/nowpayments-client.ts`
2. Add Vitest unit test `src/app/api/checkout/route.test.ts`:
   - Mock Better Auth session (authed + anon)
   - Mock `createInvoiceUrl` to return known URL
   - Assert: redirect to invoice for each of 4 tiers when authed
   - Assert: redirect to /login?redirect=... when anon
   - Assert: redirect to /pricing when invalid tier
3. Inspect `pricing-card.tsx` — if Buy buttons fetch /api/checkout client-side, add try/catch + toast for failures
4. Live verify (curl with HEALTH_CHECK_SECRET style — but checkout is auth-protected, so just verify 307 redirect for unauthed)

## File Ownership (do NOT touch outside)

- ✅ `src/app/api/checkout/route.ts` (read + edit if needed)
- ✅ `src/app/api/checkout/route.test.ts` (NEW)
- ✅ `src/components/pricing/pricing-card.tsx` (toast UX only)
- ❌ DO NOT touch `src/app/[locale]/pricing/page.tsx` (Phase B/C devs may collide)
- ❌ DO NOT touch `src/lib/clients/nowpayments-client.ts` unless test requires mock surface

## Success Criteria

- [ ] route.test.ts passes (≥6 tests)
- [ ] curl `https://sophia.agencyos.network/api/checkout?tier=BASIC` returns 307 → /login (anon)
- [ ] No new TS errors
- [ ] No new lint errors

## Reports

Save report to `/Users/macbook/sophia-ai-factory/plans/260429-2101-revenue-growth-parallel/reports/fullstack-developer-payments-260429-2101.md`
