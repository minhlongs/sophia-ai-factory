# Sophia AI Factory — Revenue Push Plan

**Date:** 2026-05-23
**Goal:** Maximize revenue conversion from existing infrastructure
**Current State:** Production live (HTTP 200), 87.5/100 infra score, revenue health 5.8/10

## Audit Summary (3 parallel scouts)

| Domain | Score | Key Gap |
|--------|-------|---------|
| Revenue/Billing | 5.8/10 | Crypto-only payment, no annual plans, weak onboarding |
| Marketing/SEO | 5.5/10 | No GA4, no UTM, blog minimal, VN market under-served |
| Sales Funnel | 4/10 | Dunning not wired, coupons fragmented, no funnel metrics |

## Phase Architecture

```
PARALLEL WAVE 1 (Quick Wins — Revenue Impact):
├── Phase 01: Landing page CRO — pricing visible, hero value prop, CTAs
├── Phase 02: Payment expansion — PayOS activation for VN fiat
└── Phase 03: Funnel analytics — GA4/UTM + conversion tracking

PARALLEL WAVE 2 (Activation & Retention):
├── Phase 04: Onboarding email sequence — 3-email post-purchase drip
├── Phase 05: Dunning wiring — connect state machine to Resend
└── Phase 06: Affiliate discovery — surface program on landing + dashboard

WAVE 3 (Growth):
├── Phase 07: Annual pricing + bundle discounts
├── Phase 08: VN market localization — Zalo, VND, holiday campaigns
└── Phase 09: Content/SEO — blog CMS, JSON-LD injection, structured data
```

## Phases

- [x] Audit complete (3 parallel scouts)
- [x] Phase 01: Landing CRO ([phase-01](phase-01-landing-cro.md)) — COMPLETE
- [x] Phase 02: PayOS activation ([phase-02](phase-02-payos-activation.md)) — COMPLETE
- [x] Phase 03: Funnel analytics ([phase-03](phase-03-funnel-analytics.md)) — COMPLETE
- [x] Phase 04: Onboarding emails ([phase-04](phase-04-onboarding-emails.md)) — COMPLETE
- [x] Phase 05: Dunning wiring ([phase-05](phase-05-dunning-wiring.md)) — COMPLETE
- [x] Phase 06: Affiliate discovery ([phase-06](phase-06-affiliate-discovery.md)) — COMPLETE
- [x] Phase 07: Annual pricing ([phase-07](phase-07-annual-pricing.md)) — COMPLETE
- [x] Phase 08: VN market ([phase-08](phase-08-vn-market.md)) — COMPLETE
- [x] Phase 09: Content/SEO ([phase-09](phase-09-content-seo.md)) — COMPLETE

## Revenue Impact Estimate

| Fix | Est. Conversion Lift |
|-----|---------------------|
| PayOS fiat option | +30-50% VN checkout completion |
| Pricing on hero | +10-15% pricing page visits |
| Annual plans | +20% LTV per customer |
| Onboarding emails | +15-25% activation rate |
| Dunning recovery | +5-10% retained revenue |
| GA4 + UTM | Enables data-driven optimization |

## Constraints
- NOWPayments is primary (Polar REJECTED)
- PayOS is backup for VN domestic — already in codebase, flag-gated
- Deploy: CF-direct via `npm run deploy:full` (no GH Actions)
- No operator third-party setup per doctrine
