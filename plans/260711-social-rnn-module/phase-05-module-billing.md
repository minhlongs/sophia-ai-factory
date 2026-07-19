---
phase: 5
title: "Module Billing"
status: pending
priority: P2
dependencies: [3]
effort: "4h"
---

# Phase 5: Module Billing

## Overview

Pricing + billing for Social RNN. Extend existing NOWPayments IPN. No new payment provider needed.

## TDD Workflow

**RED**: Contract tests for payment flow
**GREEN**: Extend IPN handler + billing logic
**REFACTOR**: Extract social-specific logic

## Test-First Checklist

**Pricing Config**
- [ ] Test: Channel tiers correct (Telegram free, FB/TT/YT $99/mo)
- [ ] Test: Usage-based option: $0.10 per publish

**IPN Handler Extension**
- [ ] Test: IPN detects `social_channels` product type
- [ ] Test: Agency payment → channels activated
- [ ] Test: Individual payment → channels activated
- [ ] Test: Duplicate IPN → idempotent (no double-charge)

**Channel Lifecycle**
- [ ] Test: Payment success → channels set to active
- [ ] Test: Cancellation → channels deactivated immediately
- [ ] Test: User downgrade removes channels beyond limit

**Zero Regression**
- [ ] Test: Existing tier billing flow unchanged
- [ ] Test: Existing IPN tests still pass

## Implementation Steps

1. Define pricing config: channel tiers + per-publish cost
2. Extend NOWPayments IPN: detect `social_channels` payment
3. social-billing.ts: channel activation + tracking
4. UI: Billing page for channel subscription management
5. Verify existing billing unchanged
6. Write docs/social-rnn-pricing.md

## Success Criteria

- [ ] User pays → channels activated immediately
- [ ] Cancellation → channels deactivated
- [ ] Existing billing flow regression-free
- [ ] Pricing docs published

## Risk Assessment

- Webhook regression: test existing NOWPayments flow after adding social branch.
