---
title: "Sprint 3 — Polar Billing Integration"
description: "Complete Polar.sh checkout, webhook handler, MCU tracking, and billing dashboard"
status: completed
priority: P1
effort: 13h
branch: main
tags: [billing, polar, monetization, sprint-3]
created: 2026-03-20
completed: 2026-03-20
---

# SPRINT 3 — POLAR BILLING IMPLEMENTATION PLAN

**Work Context:** /Users/macbook/mekong-cli/apps/sophia-proposal
**Reports Path:** /Users/macbook/mekong-cli/apps/sophia-proposal/plans/reports/
**Plans Path:** /Users/macbook/mekong-cli/apps/sophia-proposal/plans/

---

## Overview

Implement complete Polar.sh billing integration for Sophia AI Factory with 4 subscription tiers, MCU tracking, and usage-based billing.

## Phases

| Phase | Title | Effort | Status |
|-------|-------|--------|--------|
| [Phase 1](./phase-01-database-schema.md) | Database Schema + Tables | 2h | ✅ Done |
| [Phase 2](./phase-02-polar-client.md) | Polar Client Library | 1.5h | ✅ Done |
| [Phase 3](./phase-03-checkout-api.md) | Checkout API Endpoints | 2h | ✅ Done |
| [Phase 4](./phase-04-webhook-handler.md) | Webhook Handler | 2h | ✅ Done |
| [Phase 5](./phase-05-mcu-tracking.md) | MCU Tracking + Balance | 2h | ✅ Done |
| [Phase 6](./phase-06-billing-ui.md) | Billing Dashboard UI | 2h | ✅ Done |
| [Phase 7](./phase-07-pilot-onboarding.md) | Pilot Onboarding Flow | 1.5h | ✅ Done |

## Completion Summary

- **Files Created/Modified:** 20
- **Tests:** 77 passing
- **TypeScript Errors:** 0
- **Build:** Successful
- **Security Issues Fixed:** 3 critical

## Dependencies

- Sprint 1: Auth + Organization management (done)
- Sprint 2: AI Proposal Engine (done)
- External: Polar.sh account, webhook secret

## Success Criteria

- [ ] 4 Polar products created (Starter $49, Growth $149, Premium $499, Master $999)
- [ ] Checkout flow works end-to-end
- [ ] Webhook credits MCU on payment
- [ ] HTTP 402 on zero balance
- [ ] Usage dashboard shows MCU consumption
- [ ] First pilot can onboard <30 min
