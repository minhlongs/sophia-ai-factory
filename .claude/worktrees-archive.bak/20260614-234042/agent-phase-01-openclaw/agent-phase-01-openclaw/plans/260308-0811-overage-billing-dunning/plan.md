# Overage Billing & Dunning Workflow Implementation Plan

## Overview
Triển khai hệ thống overage billing và dunning workflow cho Sophia AI Factory, tích hợp Stripe Billing Metered Usage với hệ thống usage metering hiện tại.

## Goals
1. Tự động tính phí overage khi usage vượt quá tier limits
2. Dunning workflow với automatic invoice creation và payment retries
3. Overage alerts và pending charges trong Analytics dashboard
4. Integration với RaaS Gateway và License Management UI

## Current System
- **Payment Provider**: Polar.sh (subscriptions)
- **Usage Tracking**: RaaS Gateway với usage_events table
- **Rollup**: Hourly và daily summaries
- **License**: RaaS license keys với tier gating

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         STRIPE BILLING                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Products   │  │    Prices    │  │  Usage Recs  │              │
│  │  (Metered)   │  │  (Per unit)  │  │  (Report)    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────┬────────────────────────────────────────────────────┘
               │
               │ Webhooks (invoice.payment_failed, etc.)
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SOPHIA AI FACTORY                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    BILLING SERVICE                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │   Overage   │  │   Stripe    │  │   Dunning Engine    │  │  │
│  │  │  Calculator │  │   Client    │  │  (Retry Logic)      │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    USAGE METERING                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │   Tracker   │  │   Rollup    │  │   Quota Monitor   │  │  │
│  │  │  (Events)   │  │  (Hourly)   │  │  (Limit Check)    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    LICENSE MANAGEMENT                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │   Enforce   │  │   Grace     │  │   Suspension      │  │  │
│  │  │   (Check)   │  │  (Period)   │  │   (Action)        │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Stripe Metered Billing Setup
- [ ] Tạo Stripe Products với metered billing
- [ ] Setup Usage Records API integration
- [ ] Tạo webhook handlers cho Stripe billing events

### Phase 2: Database Schema
- [ ] Tạo `overage_charges` table
- [ ] Tạo `dunning_attempts` table
- [ ] Tạo `dunning_settings` table
- [ ] Tạo `stripe_usage_records` table

### Phase 3: Overage Calculation Service
- [ ] Implement overage detection logic
- [ ] Integrate với usage rollup service
- [ ] Tạo overage charge calculation
- [ ] Ghi nhận overage vào database

### Phase 4: Dunning Workflow Service
- [ ] Implement dunning state machine
- [ ] Tạo automatic invoice creation
- [ ] Implement payment retry logic
- [ ] Xử lý grace periods

### Phase 5: UI Components
- [ ] Overage Alert Banner component
- [ ] Pending Charges Card component
- [ ] Usage vs Limit Gauge component
- [ ] Billing History Table component

### Phase 6: RaaS Gateway Integration
- [ ] Implement billing event logging
- [ ] License enforcement integration
- [ ] Grace period handling
- [ ] Service suspension logic

### Phase 7: Testing & Deployment
- [ ] Unit tests cho billing services
- [ ] Integration tests với Stripe
- [ ] Dunning workflow tests
- [ ] E2E tests cho UI components

## Dependencies
- Stripe account với metered billing enabled
- Stripe API keys (test và production)
- Existing usage metering system
- Polar.sh integration (existing)

## Risk Mitigation
- Idempotency cho tất cả billing operations
- Rollback plan cho database migrations
- Feature flags cho từng phase
- Comprehensive logging

## Success Metrics
- 100% accurate overage detection
- 99.9% dunning workflow reliability
- < 1s latency cho overage calculations
- 0 duplicate charges
