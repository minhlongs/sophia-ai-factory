# Sprint 3 Implementation Plan — Polar Billing Integration

**Date:** 2026-03-20
**Plan Dir:** `plans/260320-0114-sprint-3-polar-billing/`
**Reports Path:** `plans/reports/`

---

## Executive Summary

Complete Polar.sh billing integration for Sophia AI Factory with 4 subscription tiers, MCU tracking, usage-based billing, and pilot onboarding flow.

---

## Plan Overview

| Phase | Title | Effort | Status |
|-------|-------|--------|--------|
| 1 | Database Schema + Tables | 2h | pending |
| 2 | Polar Client Library | 1.5h | pending |
| 3 | Checkout API Endpoints | 2h | pending |
| 4 | Webhook Handler | 2h | pending |
| 5 | MCU Tracking + Balance | 2h | pending |
| 6 | Billing Dashboard UI | 2h | pending |
| 7 | Pilot Onboarding Flow | 1.5h | pending |
| **Total** | | **13h** | |

---

## Files Structure

```
lib/billing/
├── polar-client.ts          # Polar.sh API wrapper
├── mcu-pricing.ts           # MCU cost calculations
├── usage-tracker.ts         # Usage logging
└── balance-checker.ts       # Balance validation

app/api/
├── billing/
│   ├── checkout/route.ts
│   ├── portal/route.ts
│   └── subscription/route.ts
├── usage/
│   ├── route.ts
│   └── log/route.ts
├── webhooks/
│   └── polar/route.ts
├── feedback/route.ts
└── onboarding/status/route.ts

app/(dashboard)/
├── billing/
│   ├── page.tsx
│   └── upgrade/page.tsx
├── usage/
│   └── page.tsx
└── onboarding/
    └── page.tsx

components/
├── billing/
│   ├── plan-card.tsx
│   ├── billing-status.tsx
│   └── usage-chart.tsx
├── onboarding/
│   └── pilot-checklist.tsx
└── surveys/
    └── nps-survey.tsx

tests/billing/
├── polar-checkout.test.ts
├── webhook-handler.test.ts
└── mcu-pricing.test.ts

lib/supabase/migrations/
└── 004_billing_tables.sql
```

---

## Key Requirements (from sprint-03-polar-billing.md)

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | Users can subscribe via Polar checkout | P1 |
| FR3.2 | Subscription activates MCU credits | P1 |
| FR3.3 | Usage deducts from MCU balance | P1 |
| FR3.4 | HTTP 402 when balance zero | P1 |
| FR3.5 | Users can view usage history | P2 |
| FR3.6 | Users can upgrade/downgrade plans | P2 |
| FR3.7 | Pilot onboarding flow | P1 |
| FR3.8 | NPS survey after 7 days | P2 |

### Polar Tiers

| Tier | Price | MCU/Month | Overage |
|------|-------|-----------|---------|
| Starter | $49 | 500 | $0.10/MCU |
| Growth | $149 | 2,000 | $0.08/MCU |
| Premium | $499 | 10,000 | $0.06/MCU |
| Master | $999 | 25,000 | $0.05/MCU |

---

## Database Schema

### Tables

1. **subscriptions** - Polar subscription records
2. **usage_logs** - MCU consumption tracking
3. **org_balances** - Organization MCU balances
4. **billing_settings** - Polar customer mappings
5. **customer_feedback** - NPS and survey responses

### Functions

1. **credit_mcu_balance()** - Atomically credit MCU on payment
2. **deduct_mcu_balance()** - Atomically deduct MCU on usage

---

## Success Criteria

- [ ] 4 Polar products created in dashboard
- [ ] Checkout flow: Click → Polar → Webhook → MCU credited
- [ ] HTTP 402 on zero balance for billable APIs
- [ ] Usage dashboard shows consumption
- [ ] First pilot onboarded <30 min
- [ ] NPS survey triggered after 7 days

---

## Environment Variables

Add to `.env.local`:

```bash
# Polar.sh Billing
POLAR_API_URL=https://api.polar.sh
POLAR_API_KEY=sk_live_your_api_key
POLAR_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_APP_URL=https://sophia.agencyos.network
```

---

## Testing Checklist

```bash
# 1. Test checkout creation
curl -X POST http://localhost:3000/api/billing/checkout \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "premium"}'

# 2. Test webhook (simulate Polar event)
curl -X POST http://localhost:3000/api/webhooks/polar \
  -H "Content-Type: application/json" \
  -H "X-Polar-Signature: t=TS,v1=SIG" \
  -d @test-order-paid.json

# 3. Test balance check (should return 402 if zero)
curl -X POST http://localhost:3000/api/proposals/generate \
  -H "Authorization: Bearer TOKEN"

# 4. Test usage logging
curl -X POST http://localhost:3000/api/usage/log \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feature": "proposal_generation", "mcu_cost": 10}'
```

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Polar.sh doesn't support SEA | Medium | High | Research Stripe fallback |
| Webhook delivery fails | Low | High | Retry logic, manual reconciliation |
| MCU calculation errors | Medium | High | Audit trail, manual review |
| Cannot recruit 10 pilots | Medium | Critical | Extend timeline, adjust ICP |

---

## Unresolved Questions

1. **Polar.sh SEA Coverage:** Does Polar support GrabPay, GoPay, PromptPay?
2. **Pilot Incentive:** $100 credit vs discount vs extended trial?
3. **Overage Pricing:** Final MCU overage rates per tier confirmed?
4. **Refund Policy:** What's the refund window for dissatisfied pilots?

---

## Next Steps

1. Create Polar.sh account and products (CEO)
2. Run database migration
3. Implement phases 1-7 sequentially
4. Test end-to-end payment flow
5. Onboard first pilot customer

---

**Plan Created:** 2026-03-20
**Owner:** CTO / OpenClaw
**Status:** Ready for implementation
