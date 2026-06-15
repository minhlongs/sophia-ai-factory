# Overage Billing & Dunning Workflow Implementation Plan

## Overview
Implement complete dunning workflow for Sophia AI Factory: Stripe Billing auto-charges, grace periods, email notifications (Resend), API restriction for delinquent accounts.

## Current State (Existing)
- ✅ `overage_events` table - tracks quota exceeded events
- ✅ `quota_limits` table - custom quota/overage settings per license
- ✅ `polar-metered-billing.ts` - Polar.sh integration
- ✅ `stripe-metered-billing.ts` - Stripe Billing integration
- ✅ `overage-billing-reconciler.ts` - scans & creates invoice items
- ✅ `quota-alert-service.ts` - email/SMS alerts for usage thresholds
- ✅ `raas-gate.ts` - license validation + quota enforcement

## Gaps to Fill
1. ❌ No dunning state machine (payment failure workflow)
2. ❌ No grace period enforcement
3. ❌ No Resend email integration for failed payments
4. ❌ No API restriction for delinquent accounts
5. ❌ No dunning visibility in analytics dashboard

## Implementation Phases

### Phase 1: Database Schema for Dunning ✅
- [x] Review existing `overage_events`, `quota_limits` tables
- [ ] Create `dunning_attempts` table (track payment retry history)
- [ ] Create `dunning_settings` table (per-user dunning config)
- [ ] Create `billing_events` table (all billing-related events log)

### Phase 2: Dunning Workflow Service
- [ ] Implement dunning state machine: `current` → `past_due` → `delinquent` → `suspended`
- [ ] Grace period logic (configurable days per tier)
- [ ] Payment retry scheduling (exponential backoff: 1d, 3d, 7d, 15d)
- [ ] Webhook handlers for `invoice.payment_failed`, `customer.subscription.deleted`

### Phase 3: Resend Email Integration
- [ ] Setup Resend API client
- [ ] Email templates: payment_failed, grace_period_warning, suspension_notice
- [ ] Trigger emails on dunning state transitions
- [ ] Log email delivery in `billing_events` table

### Phase 4: RaaS Gateway Dunning Enforcement
- [ ] Add dunning state check to `raas-gate.ts`
- [ ] Block API requests when state = `suspended`
- [ ] Return `402 Payment Required` with dunning info
- [ ] Add `X-Dunning-State` header for dashboard polling

### Phase 5: Analytics Dashboard Integration
- [ ] Add dunning events to analytics queries
- [ ] Create `DunningStatusCard` component
- [ ] Add dunning history table to billing page
- [ ] Real-time dunning state updates via SWR

### Phase 6: Testing & Deployment
- [ ] Unit tests for dunning state machine
- [ ] Integration tests with Stripe webhooks
- [ ] E2E test: subscription → overage → failed payment → dunning → suspension
- [ ] Deploy migration + verify production

## Dependencies
- Stripe account with metered billing enabled
- Resend API key for email delivery
- Existing usage metering + overage detection

## Success Metrics
- 100% dunning workflow reliability
- Email delivery rate > 99%
- < 1s latency for dunning state checks
- Zero duplicate charges
