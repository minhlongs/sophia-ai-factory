# Overage Billing & Quota Enforcement - Implementation Plan

**Date:** 2026-03-09
**Status:** Ready for implementation
**Priority:** High

---

## Executive Summary

Hệ thống overage billing và quota enforcement **ĐÃ ĐƯỢC IMPLEMENT** ~90%.
Chỉ cần hoàn thiện 4 gaps để đạt 100% production-ready:

1. Cron job cho tự động reconciliation
2. Polar webhook handler
3. Analytics dashboard UI
4. Manual trigger API endpoint

---

## Current State (As-Is)

### ✅ Completed Components

| Component | File | Completion |
|-----------|------|------------|
| RaaS Gateway | `src/lib/raas-gate.ts` | 100% |
| Quota Checker | `src/lib/quota/quota-checker.ts` | 100% |
| Quota Enforcer | `src/lib/quota/quota-enforcer.ts` | 100% |
| Overage Reconciler | `src/lib/billing/overage-billing-reconciler.ts` | 100% |
| Polar Metered Billing | `src/lib/billing/polar-metered-billing.ts` | 100% |
| Billing Types | `src/lib/billing/billing-types.ts` | 100% |

### ✅ Existing Features

- License validation (HMAC-SHA256 + JWT)
- Real-time quota checking với KV caching
- Overage event logging (`overage_events` table)
- Tier-based pricing (BASIC $0.10, PREMIUM $0.05, ENTERPRISE $0.03, MASTER $0.02)
- Stripe invoice items creation
- Polar.sh order creation
- Idempotency protection
- Circuit breaker (fail-closed/fail-open)

---

## Gaps Analysis (To-Do)

### Gap 1: Cron Job for Auto Reconciliation

**Problem:** Reconciliation chỉ chạy manual, không có scheduled job

**Solution:** Tạo cron job chạy hàng ngày

**Files to create:**
- `src/app/api/cron/overage-billing/route.ts` - Cron endpoint
- `src/app/api/cron/daily-usage-export/route.ts` - Daily usage export (optional)

**Security:** Basic auth với `CRON_SECRET` env var

---

### Gap 2: Polar Webhook Handler

**Problem:** Chưa có webhook handler để nhận events từ Polar.sh

**Solution:** Tạo webhook endpoint xử lý:
- `checkout.created` - New subscription
- `checkout.updated` - Subscription changes
- `order.paid` - One-time charge paid
- `subscription.active` - Subscription activated
- `subscription.canceled` - Subscription canceled

**Files to create:**
- `src/app/api/webhooks/polar/route.ts` - Webhook handler
- `src/lib/webhooks/polar-webhook-handler.ts` - Business logic

**Security:** Polar webhook secret validation

---

### Gap 3: Analytics Dashboard UI

**Problem:** Chưa có UI hiển thị overage billing events và quota status

**Solution:** Tạo dashboard components:

**Files to create:**
- `src/app/[locale]/dashboard/billing/overage/page.tsx` - Overage events page
- `src/app/[locale]/dashboard/usage/quota-status/page.tsx` - Quota status page
- `src/components/billing/overage-events-table.tsx` - Table component
- `src/components/quota/quota-gauge.tsx` - Visual quota indicator
- `src/hooks/use-quota-status.ts` - Hook for quota data

---

### Gap 4: Manual Trigger API Endpoint

**Problem:** Admin không có cách manual trigger reconciliation

**Solution:** Tạo admin API endpoint

**Files to create:**
- `src/app/api/admin/quota/reconcile/route.ts` - Manual trigger endpoint

**Security:** Admin auth required

---

## Implementation Phases

### Phase 1: API Endpoints (Simple)

**Goal:** Enable manual reconciliation và cron jobs

1. Create `/api/admin/quota/reconcile` endpoint
2. Create `/api/cron/overage-billing` endpoint
3. Add auth middleware (Basic auth for cron, Admin auth for reconcile)

**Files:**
- `src/app/api/admin/quota/reconcile/route.ts`
- `src/app/api/cron/overage-billing/route.ts`
- `src/lib/security/cron-auth.ts`

**Estimated time:** 1-2 hours

---

### Phase 2: Polar Webhook Handler

**Goal:** Real-time subscription lifecycle sync

1. Create webhook route handler
2. Implement event processors:
   - `checkout.created` → Create/update license
   - `order.paid` → Sync payment, activate tier
   - `subscription.canceled` → Downgrade/deactivate
3. Add webhook secret validation
4. Create idempotency handling

**Files:**
- `src/app/api/webhooks/polar/route.ts`
- `src/lib/webhooks/polar-webhook-handler.ts`
- `src/lib/security/webhook-validator.ts`

**Estimated time:** 2-3 hours

---

### Phase 3: Analytics Dashboard UI

**Goal:** User-facing dashboard for quota & overage

1. Create quota status page with gauges
2. Create overage events table
3. Add usage charts
4. Implement real-time updates (optional)

**Files:**
- `src/app/[locale]/dashboard/usage/quota-status/page.tsx`
- `src/app/[locale]/dashboard/billing/overage/page.tsx`
- `src/components/quota/quota-gauge.tsx`
- `src/components/billing/overage-events-table.tsx`
- `src/hooks/use-quota-status.ts`
- `src/hooks/use-overage-events.ts`

**Estimated time:** 3-4 hours

---

### Phase 4: Testing & Verification

**Goal:** Ensure all components work correctly

1. Unit tests for new components
2. Integration tests for webhook flow
3. E2E test: User exceeds quota → Overage logged → Reconciliation → Invoice created
4. Manual testing checklist

**Files:**
- `src/app/api/admin/quota/reconcile/route.test.ts`
- `src/app/api/cron/overage-billing/route.test.ts`
- `src/lib/webhooks/polar-webhook-handler.test.ts`

**Estimated time:** 2-3 hours

---

## Database Schema (Already Exists)

```sql
-- Overage events table
CREATE TABLE overage_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  license_nonce VARCHAR(255) NOT NULL,
  exceeded_type VARCHAR(50) NOT NULL,
  exceeded_limit INTEGER NOT NULL,
  exceeded_current INTEGER NOT NULL,
  exceeded_by INTEGER NOT NULL,
  requested_credits INTEGER NOT NULL,
  endpoint TEXT,
  service_name VARCHAR(100),
  action VARCHAR(100),
  tier_at_exceeded VARCHAR(50) NOT NULL,
  external_customer_id VARCHAR(255),
  billable BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quota limits table (optional overrides)
CREATE TABLE quota_limits (
  id UUID PRIMARY KEY,
  license_nonce VARCHAR(255) NOT NULL UNIQUE,
  custom_daily_credits INTEGER,
  custom_hourly_credits INTEGER,
  custom_monthly_credits INTEGER,
  custom_daily_requests INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage events table
CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  external_customer_id VARCHAR(255),
  license_nonce VARCHAR(255) NOT NULL,
  service_name VARCHAR(100),
  action VARCHAR(100),
  credits_used INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  is_polar_synced BOOLEAN DEFAULT false,
  metadata JSONB
);
```

---

## Environment Variables Required

```bash
# Polar.sh
POLAR_ACCESS_TOKEN=access_token_here
POLAR_ORGANIZATION_ID=org_id_here
POLAR_METER_SLUGS=api_credits,api_requests
POLAR_WEBHOOK_SECRET=whsec_xxx

# Stripe (optional, fallback)
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Cron security
CRON_SECRET=super_secret_cron_key

# RaaS Gateway
RAAS_LICENSE_SECRET=your_hmac_secret
RAAS_JWT_SECRET=REDACTED=your_jwt_secret

# Quota enforcement
QUOTA_FAIL_CLOSED=true  # Block when quota check fails
ENABLE_OVERAGE_BILLING=true
```

---

## Success Criteria

### Functional Requirements

- [ ] Admin có thể trigger reconciliation qua API
- [ ] Cron job chạy tự động hàng ngày
- [ ] Polar webhooks được xử lý đúng
- [ ] Users xem được quota status trên dashboard
- [ ] Overage events được hiển thị rõ ràng
- [ ] Invoice items được tạo chính xác

### Non-Functional Requirements

- [ ] 100% test coverage cho new code
- [ ] Zero `any` types trong TypeScript
- [ ] All endpoints có auth validation
- [ ] Idempotency protection
- [ ] Error handling đầy đủ
- [ ] Logging structured (JSON format)

### Performance Requirements

- [ ] Quota check < 100ms (KV cache hit)
- [ ] Reconciliation < 30s cho 1000 events
- [ ] Webhook response < 500ms

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Polar API rate limits | Medium | Low | Retry with backoff, KV caching |
| Double-billing | High | Low | Idempotency keys, deduplication |
| Webhook replay attacks | High | Medium | Signature validation, nonce tracking |
| Database deadlocks | Medium | Low | Proper indexing, transaction management |
| KV cache inconsistency | Medium | Low | Cache invalidation on write |

---

## Next Steps

1. **Review & Approve Plan** - Get stakeholder approval
2. **Phase 1 Implementation** - API endpoints
3. **Phase 2 Implementation** - Polar webhook handler
4. **Phase 3 Implementation** - Analytics dashboard UI
5. **Phase 4 Testing** - Unit, integration, E2E tests
6. **Deploy to Production** - Follow CI/CD pipeline
7. **Monitor & Verify** - Production GREEN verification

---

## Unresolved Questions

1. Should we support multiple billing periods (monthly/annual)?
2. Do we need proration for mid-cycle tier changes?
3. Should overage billing be automatic or require manual review first?
4. Do we need email notifications when users approach quota limits?
5. Should we implement grace periods for quota exceeded?

---

## References

- **RaaS Gateway:** `src/lib/raas-gate.ts`
- **Quota System:** `src/lib/quota/`
- **Billing System:** `src/lib/billing/`
- **Polar SDK:** `@polar-sh/sdk`
- **Stripe SDK:** `stripe` npm package
