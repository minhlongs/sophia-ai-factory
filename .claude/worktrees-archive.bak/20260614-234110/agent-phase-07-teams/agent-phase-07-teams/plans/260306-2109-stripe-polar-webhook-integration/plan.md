---
title: Stripe & Polar Webhook Integration
description: Complete webhook integration for Stripe and Polar.sh with license auto-generation, subscription lifecycle management, and idempotent event processing
status: in-progress
priority: P0
effort: 16h
branch: main
tags: [stripe, polar, webhook, license, subscription, payment]
created: 2026-03-06
---

# Stripe & Polar Webhook Integration Plan

## Overview

Implement comprehensive webhook integration for both Stripe and Polar.sh payment providers to automate license key generation, subscription lifecycle management, and payment event tracking.

## Problem Statement

**Current State:**
- ✅ Polar webhook implemented at `/api/webhooks/polar` (Phase 1 complete)
- ✅ Auto-license generation on `checkout.updated`, `subscription.created`, `order.created`
- ✅ License revocation on `subscription.cancelled`
- ❌ Stripe webhook NOT implemented
- ❌ Polar Phase 2-5 pending (active, past_due, expired events)

**Target State:**
- ✅ Stripe webhook at `/api/webhooks/stripe` with full event handling
- ✅ Polar webhook Phase 2-5 complete
- ✅ Shared types, utilities, error handling patterns
- ✅ 100% test coverage for both webhook handlers
- ✅ Dashboard configuration documented

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Payment Providers                             │
│         Stripe                    │        Polar.sh              │
└────────────────┬──────────────────┴───────────────┬──────────────┘
                 │                                  │
                 │ webhook                          │ webhook
                 ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  /api/webhooks/stripe          /api/webhooks/polar              │
│  - Verify Stripe signature      - Verify Polar signature         │
│  - Construct event              - Idempotency check              │
│  - Idempotency check                                            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  stripe-webhook-handler.ts       polar-webhook-handler.ts       │
│  - switch(event.type)            - switch(event.type)            │
│  - Call appropriate handler      - Call appropriate handler      │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Shared Services                               │
│  - raas-audit.ts (license create/revoke)                         │
│  - polar-subscription-service.ts                                 │
│  - notification-service.ts (Telegram)                            │
│  - logger-utility.ts                                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Database                             │
│  - payment_events (stripe_event_id, polar_event_id)              │
│  - raas_licenses (metadata.stripe_subscription_id)               │
│  - user_profiles (stripe_subscription_id, polar_subscription_id) │
│  - raas_audit_logs                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Phases

| Phase | Title | Status | Provider |
|-------|-------|--------|----------|
| [Phase 1: Polar Auto-License](./phase-01-auto-license-generation.md) | Auto-generate license on payment | **COMPLETE** | Polar |
| [Phase 2: Stripe Webhook Core](./phase-01-stripe-webhook-core.md) | Stripe endpoint + signature verification | pending | Stripe |
| [Phase 3: Stripe Events](./phase-02-stripe-events.md) | Handle checkout, subscription, invoice events | pending | Stripe |
| [Phase 4: Polar Lifecycle](./phase-03-polar-lifecycle.md) | active, past_due, expired events | pending | Polar |
| [Phase 5: Database Enhancements](./phase-04-database-enhancements.md) | Unified payment_events schema | pending | Both |
| [Phase 6: Testing & Security](./phase-05-testing-security.md) | Unit, integration, security tests | pending | Both |
| [Phase 7: Dashboard Config](./phase-06-dashboard-config.md) | Configure Stripe & Polar dashboards | pending | Both |

## Event Mapping

### Stripe Events

| Event | License Action | DB State |
|-------|----------------|----------|
| `checkout.session.completed` | Create + Activate | `is_revoked=false` |
| `customer.subscription.created` | Create + Activate | `is_revoked=false` |
| `customer.subscription.updated` | Update tier/status | Update metadata |
| `customer.subscription.deleted` | Revoke | `is_revoked=true` |
| `invoice.paid` | Extend expiration | Update `expires_at` |
| `invoice.payment_failed` | Warning (grace period) | Add warning metadata |

### Polar Events

| Event | License Action | DB State |
|-------|----------------|----------|
| `checkout.updated` (succeeded) | Create + Activate | `is_revoked=false` |
| `subscription.created` | Create + Activate | `is_revoked=false` |
| `subscription.updated` | Update tier/status | Update metadata |
| `subscription.cancelled` | Revoke | `is_revoked=true` |
| `subscription.active` | Reactivate | `is_revoked=false` |
| `subscription.past_due` | Warning | Add warning metadata |
| `subscription.expired` | Full revoke | `is_revoked=true` |
| `order.created` | Create + Activate | `is_revoked=false` |

## Dependencies

- Supabase admin client (existing)
- Polar SDK (existing)
- Stripe SDK (`npm install stripe`)
- RaaS audit service (existing - `raas-audit.ts`)
- Notification service (existing - Telegram)

## Security Requirements

1. **Signature Verification:**
   - Stripe: `stripe.webhooks.constructEvent()` with `Stripe-Signature` header
   - Polar: HMAC-SHA256 with `Polar-Signature` header

2. **Idempotency:**
   - Database-level uniqueness on `stripe_event_id` and `polar_event_id`
   - Early return if event already processed

3. **Input Validation:**
   - Zod schemas for webhook headers and payloads
   - Type-safe event routing

4. **Error Handling:**
   - Structured logging with correlation IDs
   - Retry logic with exponential backoff
   - Alert on critical failures

## Success Criteria

- [ ] Stripe webhook endpoint at `/api/webhooks/stripe`
- [ ] Polar webhook Phase 2-5 complete
- [ ] All event types handled correctly
- [ ] 100% test coverage (unit + integration)
- [ ] Security audit: 0 critical issues
- [ ] Dashboard configuration documented
- [ ] Build passes with 0 errors
- [ ] Production verified green

## Unresolved Questions

1. Should Stripe and Polar share the same `payment_events` table or have separate tables?
2. What is the grace period for `invoice.payment_failed` / `subscription.past_due`? (recommending 7 days)
3. Should license keys be emailed to customers or only shown in dashboard?
4. Should trial subscriptions generate licenses?

## Next Steps

1. **Phase 1**: Implement Stripe webhook core (signature verification, endpoint structure)
2. **Phase 2**: Add Stripe event handlers (checkout, subscription, invoice)
3. **Phase 3**: Complete Polar lifecycle events (active, past_due, expired)
4. **Phase 4**: Database enhancements (unified schema, indexes)
5. **Phase 5**: Testing and security hardening
6. **Phase 6**: Configure Stripe & Polar dashboards
