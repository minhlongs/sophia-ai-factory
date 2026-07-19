---
phase: 5
title: "Billing & Contracts"
status: pending
priority: P2
dependencies: [3]
---

# Phase 5: Billing & Contracts

## Overview

Wire NOWPayments + PayOS for agency tiers. Agency onboarding fulfillment after payment. Public API docs.

## Requirements

- Functional: Payment → tier activation → welcome email + Telegram onboarding
- Non-functional: Zero regression on existing individual billing flow

## Architecture

Leverage existing NOWPayments IPN flow. Add agency tier branching. PayOS as Vietnam domestic backup.

Tiers:
- Starter: $500/mo — 5 sub-tenants, 100 credits
- Growth: $1500/mo — 20 sub-tenants, 500 credits
- Enterprise: $3000/mo — unlimited, custom

Flow:
```
Agency completes onboarding → payment link (NOWPayments/PayOS)
  → IPN webhook → payment handler detects agency tier
    → activates agency account
      → fulfillment: welcome email + Telegram onboarding link
```

## Related Code Files

- Create: `land/billing/agency-billing.ts`
- Create: `land/fulfillment/agency-fulfillment.ts`
- Create: `docs/api-agency.md`
- Modify: Existing NOWPayments IPN handler (add agency branch)

## Implementation Steps

1. Extend NOWPayments IPN handler: detect agency tier payment
2. Build agency-billing.ts (tier config, payment status, status tracking)
3. Build agency-fulfillment.ts (post-payment: activate, email, Telegram)
4. Write docs/api-agency.md (public API contract for agencies)
5. Verify existing individual billing flow unchanged

## Success Criteria

- [ ] Agency payment → tier activation → email + Telegram delivery
- [ ] Existing billing flow regression-free
- [ ] API docs published

## Risk Assessment

- Webhook regression risk: test existing payment flow thoroughly after changes
