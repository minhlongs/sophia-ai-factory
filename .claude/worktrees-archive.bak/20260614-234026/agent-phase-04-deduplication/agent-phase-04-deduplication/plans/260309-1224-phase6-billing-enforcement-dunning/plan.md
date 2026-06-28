---
title: "Phase 6: Billing Enforcement & Dunning Workflow - Implementation Plan"
description: "Complete billing enforcement with RaaS Gateway integration, dunning workflow, overage billing, and dashboard UI"
status: pending
priority: P1
effort: 12h
branch: main
tags: [billing, dunning, overage, enforcement, raas-gateway, dashboard]
created: 2026-03-09
---

# Phase 6: Billing Enforcement & Dunning Workflow

## Overview

Implement complete billing enforcement system integrating:
- **RaaS Gateway** quota enforcement with dunning-aware blocking
- **Dunning Workflow** state machine for payment failures
- **Overage Billing** calculation and reconciliation
- **Dashboard UI** for billing status and usage analytics
- **Admin APIs** for managing billing, dunning, violations

## Current State (As of 2026-03-09)

### ✅ Already Implemented

| Component | File | Status |
|-----------|------|--------|
| Overage Reconciliation | `src/lib/billing/overage-billing-reconciler.ts` | ✅ Complete |
| Dunning Workflow | `src/lib/billing/dunning-workflow.ts` | ✅ Complete |
| Email Service | `src/lib/billing/resend-email-service.ts` | ✅ Complete |
| Stripe Webhooks | `src/lib/payments/stripe-webhook-handler.ts` | ✅ Complete |
| Quota Enforcer | `src/lib/quota/quota-enforcer.ts` | ✅ Complete |
| Cron Jobs | `src/app/api/cron/overage-billing/route.ts` | ✅ Complete |
| DB Schemas | Migrations 260308-1800 to 260309-1149 | ✅ Complete |

### ❌ Gaps to Fill

| Gap | Priority | Effort |
|-----|----------|--------|
| RaaS Gateway Integration | P1 | 2h |
| Dashboard UI Components | P1 | 3h |
| Admin Billing APIs | P2 | 2h |
| Polar Webhook Handler | P2 | 2h |
| Usage Calculator Service | P2 | 2h |
| Integration Tests | P1 | 1h |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Billing Enforcement System                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Stripe     │    │    Polar     │    │  Cron Jobs   │      │
│  │  Webhooks    │    │  Webhooks    │    │  (Hourly)    │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Payment Event Handler                       │   │
│  │  - invoice.payment_failed → dunning-workflow             │   │
│  │  - invoice.paid → restore access                         │   │
│  │  - subscription.updated → tier changes                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Dunning State Machine                       │   │
│  │  current → past_due → delinquent → suspended             │   │
│  │  - Grace period enforcement (tier-based)                 │   │
│  │  - Retry scheduling (exponential backoff)                │   │
│  │  - Email notifications (Resend)                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Overage Calculator                          │   │
│  │  - Scan usage_events                                     │   │
│  │  - Calculate exceeded credits                            │   │
│  │  - Create billing records                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              RaaS Gateway Enforcement                    │   │
│  │  - Quota check (hard block)                              │   │
│  │  - Dunning state check (block if suspended)              │   │
│  │  - Rate limiting                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Dashboard UI                                │   │
│  │  - Usage analytics                                       │   │
│  │  - Billing status                                        │   │
│  │  - Dunning state                                         │   │
│  │  - Overage charges                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 1: RaaS Gateway Integration](./phase-01-raas-gateway-integration.md) | Integrate dunning check into quota enforcement | Pending |
| [Phase 2: Overage Usage Calculator](./phase-02-overage-calculator.md) | Service to calculate overage from usage events | Pending |
| [Phase 3: Polar Webhook Handler](./phase-03-polar-webhook-handler.md) | Handle Polar payment events | Pending |
| [Phase 4: Admin Billing APIs](./phase-04-admin-apis.md) | Admin endpoints for billing management | Pending |
| [Phase 5: Dashboard UI Components](./phase-05-dashboard-ui.md) | Billing status and usage UI | Pending |
| [Phase 6: Integration Tests + Docs](./phase-06-testing-docs.md) | End-to-end tests and documentation | Pending |

## Success Criteria

- [ ] **RaaS Gateway** blocks requests when dunning state = suspended
- [ ] **Payment failure** triggers dunning workflow with email notifications
- [ ] **Payment success** restores access immediately
- [ ] **Overage billing** reconciles unbilled events hourly
- [ ] **Dashboard UI** shows real-time billing status and usage
- [ ] **Admin APIs** allow manual dunning state management
- [ ] **Integration tests** cover all dunning state transitions
- [ ] **Documentation** updated with API specs and workflows

## Dependencies

- Stripe API (payment webhooks)
- Polar.sh API (metered billing)
- Resend (email delivery)
- Supabase (database)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stripe webhook failures | High | Idempotency + retry logic |
| Dunning state sync issues | High | Real-time cache invalidation |
| Email delivery failures | Medium | Logging + fallback to dashboard |
| Overage calculation errors | High | Audit logging + manual reconciliation API |

## Timeline

- **Day 1:** Phases 1-3 (Gateway, Calculator, Polar)
- **Day 2:** Phases 4-5 (Admin APIs, Dashboard UI)
- **Day 3:** Phase 6 (Testing + Documentation)

## Related Files

### Core Libraries
- `src/lib/billing/overage-billing-reconciler.ts`
- `src/lib/billing/dunning-workflow.ts`
- `src/lib/billing/resend-email-service.ts`
- `src/lib/quota/quota-enforcer.ts`
- `src/lib/quota/quota-checker.ts`

### API Routes
- `src/app/api/cron/overage-billing/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/quota/overage-events/route.ts`

### Database Migrations
- `260308-1800-create-overage-events-table.sql`
- `260308-1801-create-quota-limits-table.sql`
- `260309-1100-create-dunning-workflow-tables.sql`
- `260309-1149-create-violations-table.sql`

---

## Unresolved Questions

1. **Polar.sh webhook secret** - Need to configure webhook endpoint in Polar dashboard
2. **Email template branding** - Need logo and brand colors for Resend templates
3. **Dunning grace period** - Confirm tier-specific grace periods with business requirements
