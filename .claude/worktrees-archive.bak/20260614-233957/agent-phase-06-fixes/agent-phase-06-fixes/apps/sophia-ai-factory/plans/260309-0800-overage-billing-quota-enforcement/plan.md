# Phase 1-5: Overage Billing & Quota Enforcement System

**Date:** 2026-03-09
**Status:** Phase 1 Complete, Ready for Phase 2-5
**Work Context:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/apps/sophia-ai-factory`

---

## Overview

Hệ thống Overage Billing & Quota Enforcement cho Sophia AI Factory tích hợp với RaaS Gateway tại `raas.agencyos.network`.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AgencyOS Dashboard                           │
│                     agencyos.network (Real-time)                    │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Sync
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RaaS Gateway v2.0.0                            │
│                  raas.agencyos.network (Edge)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ JWT Auth    │  │ mk_ API Key  │  │ Quota Enforcement       │   │
│  │ (Supabase)  │  │ Validation   │  │ (KV-stored usage)       │   │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Webhooks + API
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Sophia AI Factory (Next.js)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ Quota API   │  │ Overage API  │  │ Polar Webhook Handler   │   │
│  │ /v1/quota   │  │ /v1/overage  │  │ /webhooks/polar         │   │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ Usage       │  │ Billing      │  │ Analytics Dashboard     │   │
│  │ Metering    │  │ Reconciliation│  │ (Charts/Gauges)        │   │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Storage
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL + KV)                       │
│  - raas_licenses (tier, nonce, polar_customer_id)                  │
│  - usage_events (hourly/daily/monthly counters)                     │
│  - overage_events (exceeded limits, billable flag)                 │
│  - quota_limits (custom limits per license)                         │
│  - payment_events (Polar webhook audit trail)                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phases

### ✅ Phase 1: Quota & Overage API Endpoints (COMPLETE)

**Status:** Complete
**Files Created:**
- `src/app/api/v1/quota/[tenantId]/route.ts`
- `src/app/api/v1/overage/[tenantId]/route.ts`
- `src/lib/quota/quota-api-helpers.ts`
- `src/lib/overage/overage-formatter.ts`

**Security Features:**
- JWT authentication via Supabase JWKS
- Agency ID validation (tenant isolation)
- Rate limiting: 100 req/min per tenant
- Structured audit logging

**API Endpoints:**
- `GET /api/v1/quota/{tenantId}` - Returns quota limits, usage, percentages, status
- `GET /api/v1/overage/{tenantId}` - Returns overage events list + totals

---

### 🔄 Phase 2: Polar Webhook Handler Enhancement

**Status:** Pending
**Goal:** Xử lý Polar.sh webhooks để sync tier changes và usage records

**Required Changes:**
1. **Enhance existing webhook handler** for overage events:
   - File: `src/lib/payments/polar-webhook-handler.ts`
   - Add: `usage.updated` event type for metered billing
   - Add: Sync usage records from Polar → local DB

2. **Create webhook endpoint** if not exists:
   - File: `src/app/api/webhooks/polar/route.ts`
   - Secret validation via `POLAR_WEBHOOK_SECRET`
   - Event routing to handlers

**Events to Handle:**
- `checkout.created` - One-time purchase → license generation
- `subscription.created` - New subscription → activate tier
- `subscription.active` - Reactivation → unblock license
- `subscription.past_due` - Grace period → warning metadata
- `subscription.expired` - Full expiration → revoke license
- `subscription.cancelled` - Cancellation → revoke at period end
- `order.created` - One-time order → license generation
- `usage.updated` - Metered usage sync (NEW)

**Testing:**
- Unit tests for each event handler
- Integration test: Webhook → DB update → license state change

---

### 🔄 Phase 3: Analytics Dashboard UI

**Status:** Pending
**Goal:** Dashboard UI cho quota status và overage events

**Components to Create:**
1. **Quota Status Card** (`src/components/quota/quota-status-card.tsx`)
   - Display current usage vs limits
   - Visual gauges for hourly/daily/monthly
   - Status indicators (ok/warning/critical)
   - Real-time refresh (polling every 30s)

2. **Overage Events Table** (`src/components/overage/overage-events-table.tsx`)
   - List overage events with filtering
   - Billable vs non-billable toggle
   - Date range picker
   - Export to CSV functionality

3. **Usage Trends Chart** (`src/components/analytics/usage-trends-chart.tsx`)
   - Line chart for usage over time
   - Compare vs quota limits
   - Hover details for specific dates

4. **Dashboard Page** (`src/app/[locale]/dashboard/quota/page.tsx`)
   - Combine all components
   - Responsive layout
   - Loading states and error boundaries

**Dependencies:**
- Use existing chart components from `src/components/analytics/`
- Query hooks from `src/hooks/analytics/`
- UI components from `src/components/ui/`

---

### 🔄 Phase 4: Testing & Verification

**Status:** Pending
**Goal:** Comprehensive test coverage

**Test Files to Create:**
1. **Unit Tests:**
   - `src/lib/quota/quota-api-helpers.test.ts`
   - `src/lib/overage/overage-formatter.test.ts`
   - `src/lib/security/jwt-validator.test.ts` (already exists)
   - `src/lib/security/rate-limiter.test.ts`

2. **Integration Tests:**
   - `src/app/api/v1/quota/[tenantId]/route.test.ts`
   - `src/app/api/v1/overage/[tenantId]/route.test.ts`
   - `src/lib/payments/polar-webhook-handler.test.ts` (already exists)

3. **E2E Test Flow:**
   ```
   User exceeds quota → Overage logged → Reconciliation → Invoice created
   ```

**Test Coverage Target:** >80%

---

### 🔄 Phase 5: Cron Jobs for Auto-Reconciliation

**Status:** Partially Complete
**Existing Files:**
- `src/app/api/cron/overage-billing/route.ts`
- `src/app/api/cron/daily-usage-export/route.ts`
- `src/app/api/cron/usage-export/route.ts`

**Enhancement Needed:**
1. **Daily reconciliation job:**
   - Scan overage_events table
   - Calculate billable overage
   - Create invoices in Polar/Stripe
   - Mark events as billed

2. **Weekly usage export:**
   - Export usage data to data warehouse
   - Generate compliance reports
   - Send summary emails to tenants

3. **Monthly quota reset:**
   - Reset monthly counters
   - Generate monthly reports
   - Archive old usage events

---

## Integration Points

### RaaS Gateway (raas.agencyos.network)

**Authentication Flow:**
1. Client includes `Authorization: Bearer <JWT>` header
2. RaaS Gateway validates JWT via Supabase JWKS
3. Gateway injects `X-RaaS-Agency-ID` header
4. Sophia AI Factory validates agency_id matches tenantId

**Quota Enforcement:**
- Gateway calls `GET /v1/quota/{tenantId}` before processing
- If quota exceeded → 429 response with retry-after
- Overage events logged for billing reconciliation

### AgencyOS Dashboard (agencyos.network)

**Real-time Sync:**
- Usage counters pushed via KV storage
- Dashboard polls for updates every 5s
- WebSocket for live notifications (future enhancement)

**License Management:**
- Tier changes sync via Polar webhooks
- License activation/revocation audited
- Emergency bypass for admin override

---

## Database Schema

### Existing Tables

```sql
-- raas_licenses: License storage
CREATE TABLE raas_licenses (
  id UUID PRIMARY KEY,
  nonce VARCHAR(255) UNIQUE NOT NULL,
  tier VARCHAR(50) NOT NULL,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  polar_customer_id VARCHAR(255),
  polar_subscription_id VARCHAR(255),
  metadata JSONB
);

-- usage_events: Usage tracking
CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  license_nonce VARCHAR(255) REFERENCES raas_licenses(nonce),
  service_name VARCHAR(100),
  action VARCHAR(100),
  credits_used INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  is_polar_synced BOOLEAN DEFAULT FALSE,
  idempotency_key VARCHAR(255) UNIQUE
);

-- overage_events: Overage tracking
CREATE TABLE overage_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  license_nonce VARCHAR(255) REFERENCES raas_licenses(nonce),
  exceeded_type VARCHAR(50) NOT NULL,
  exceeded_limit INTEGER NOT NULL,
  exceeded_current INTEGER NOT NULL,
  exceeded_by INTEGER NOT NULL,
  requested_credits INTEGER NOT NULL,
  endpoint VARCHAR(255),
  service_name VARCHAR(100),
  action VARCHAR(100),
  billable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- quota_limits: Custom limits
CREATE TABLE quota_limits (
  id UUID PRIMARY KEY,
  license_nonce VARCHAR(255) REFERENCES raas_licenses(nonce),
  custom_hourly_credits INTEGER,
  custom_daily_credits INTEGER,
  custom_monthly_credits INTEGER,
  custom_daily_requests INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- payment_events: Webhook audit trail
CREATE TABLE payment_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  polar_event_id VARCHAR(255) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Security Considerations

### JWT Authentication
- Use Supabase JWKS endpoint
- Validate issuer, audience, expiration
- Include clock tolerance (60s)

### Tenant Isolation
- Validate `X-RaaS-Agency-ID` header matches tenantId
- Block cross-tenant access with 403
- Audit all access attempts

### Rate Limiting
- SQL-based rate limiting (100 req/min)
- Include retry-after headers
- Distributed-safe using KV storage

### Audit Logging
- Log all validation attempts
- Include user_id, IP, user-agent
- Receipt-based audit trail

---

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key

# JWT
RaaS_JWT_SECRET=REDACTED=your_jwt_secret

# Polar.sh
POLAR_API_KEY=sk_xxx
POLAR_WEBHOOK_SECRET=whsec_xxx

# Rate Limiting
CLOUDFLARE_KV_NAMESPACE=xxx
CLOUDFLARE_API_TOKEN=xxx

# Emergency Bypass
EMERGENCY_BYPASS_SECRET=xxx

# Quota Enforcement
QUOTA_FAIL_CLOSED=true
RAAS_BYPASS_DEV=true  # Development only
```

---

## Next Steps

1. **Phase 2:** Enhance Polar webhook handler
2. **Phase 3:** Build Analytics Dashboard UI
3. **Phase 4:** Write comprehensive tests
4. **Phase 5:** Configure cron jobs

---

## Unresolved Questions

1. Should overage events endpoint support pagination? (current limit: 100)
2. Need to add `polarCustomerId` to quota response for Polar integration?
3. Should rate limit be configurable per tier? (e.g., MASTER gets 500 req/min)
4. WebSocket support for real-time dashboard updates?
