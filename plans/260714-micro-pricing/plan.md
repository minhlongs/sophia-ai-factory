# L-Plan: ID-01 Micro-Pricing (Hybrid Subscription + Credits)

**Phase:** P1 | **Effort:** S | **Status:** DRAFT — Awaiting founder invoice creation
**Gated by:** Q1 answered (HYBRID confirmed), founder creates 3 NOWPayments invoices
**Blocks:** ID-05 (Agency credit gating), ID-08 (cost calibration)

---

## Overview

Add credit pack purchases (one-time, additive) on top of existing subscription tiers.
Users buy credits → spend per video → top up when low. Subscription remains the access
gate; credits are the usage metering layer.

**Zero regression:** Subscription IPN flow is untouched. Credit packs use the existing
`one_time` SKU pipeline (`nowpayments-ipn-one-time.ts`) which is already production-hardened.

---

## Phases

| # | Phase | File | Status |
|---|-------|------|--------|
| 1 | Invoice + SKU Setup | `phase-01-invoice-setup.md` | PENDING (founder action) |
| 2 | Expiry Cron | `phase-02-expiry-cron.md` | READY |
| 3 | Feature Flag + Tier Gate | `phase-03-feature-flag.md` | READY |
| 4 | Customer-Facing Credits API | `phase-04-credits-api.md` | READY |
| 5 | Integration Tests | `phase-05-tests.md` | READY |

---

## Dependencies

```
Phase 1 (INVOICE SETUP — MANUAL)
  └── Founder: Create 3 invoices in NOWPayments dashboard
       ├── CREDIT_PACK_STARTER: $29, 10 credits
       ├── CREDIT_PACK_STANDARD: $129, 50 credits
       └── CREDIT_PACK_POWER: $449, 200 credits
       └── Register invoice IDs in ONE_TIME_SKUS (Phase 2 code)

Phase 2 (EXPIRY CRON)
  ├── Depends: Phase 1 invoice IDs registered
  └── Migration: none (uses existing user_purchases.expires_at)

Phase 3 (FEATURE FLAG)
  └── Depends: Phase 2 cron deployed
       └── Adds 'enable_credit_topup' to FeatureFlag type + TIER_CONFIGS

Phase 4 (CREDITS API)
  ├── Depends: Phase 3 flag deployed
  └── New route: GET /api/v1/credits (user-facing, not API-key-only)

Phase 5 (TESTS)
  ├── Depends: Phase 4 API deployed
  └── Integration tests for full purchase → spend → expiry flow
```

---

## Key Files

| Concern | File | Change |
|---------|------|--------|
| SKU catalog | `seed/config/one-time-skus.ts` | Add 3 credit pack SKUs |
| IPN dispatch | `land/billing/nowpayments-ipn-dispatch.ts` | **No change** — `one_time` already routes |
| One-time IPN | `land/billing/nowpayments-ipn-one-time.ts` | **No change** — generic, works for any SKU |
| Credit deduction | `land/video/templates/cost-guardrail.ts` | Add expiry-aware balance check |
| Feature flag | `seed/config/flags.ts` + `tier-configs.ts` | Add `enable_credit_topup` |
| Credits API | `app/api/v1/credits/route.ts` | Expand from API-key to user session |
| Expiry cron | `app/api/cron/credit-expiry/` | **New** — marks expired packs |
| Topup types | `land/billing/overage-topup-types.ts` | No change (constants reusable) |

---

## Acceptance Criteria

- [ ] 3 NOWPayments invoices created and IDs registered in `ONE_TIME_SKUS`
- [ ] `npm run build` passes (0 TS errors)
- [ ] `npm test` passes (existing + new tests)
- [ ] Credit pack purchase → IPN → credits appear in balance (E2E)
- [ ] Credits deduct on video generation (cost-guardrail blocks when empty)
- [ ] Expired credits excluded from balance (cron marks, guardrail respects)
- [ ] Subscription IPN flow **unchanged** (verified: no changes to `nowpayments-ipn-subscription.ts`)
- [ ] Tier-gated: only PREMIUM+ can purchase credit packs (`enable_credit_topup` flag)
- [ ] Bilingual labels (VI + EN) on all customer-facing copy

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| IPN handler regression | Zero changes to subscription path; credit packs use existing `one_time` flow |
| Invoice ID collision | NOWPayments dashboard = separate ID space from subscriptions |
| NOWPayments invoice creation delay | Founder action gating — cannot proceed without invoices |
| Credit expiry cron missed | Add to deploy checklist + CF Cron Trigger |
| Tier enum breaking change avoided | No Tier enum changes — uses existing `FeatureFlag` + `TIER_CONFIGS.features` |

---

## Next on Lock

After this plan executes:
1. **ID-02 (VN Voice)** — parallel L-plan, S effort, zero new contracts
2. **ID-03 (Support Triage)** — parallel L-plan, S effort, Telegram bot extension
3. **ID-08 (Cost Attribution Dashboard)** — recommended next after ID-01 locks pricing
