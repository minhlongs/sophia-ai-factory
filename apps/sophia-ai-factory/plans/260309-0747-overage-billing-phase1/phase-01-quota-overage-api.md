# Phase 1: Quota & Overage API Endpoints

**Date:** 2026-03-09
**Status:** In Progress
**Priority:** High

---

## Overview

Implement secure API endpoints exposing quota limits, current usage, and overage status per tenant.

**Endpoints:**
- `GET /v1/quota/{tenantId}` - Quota limits + current usage
- `GET /v1/overage/{tenantId}` - Overage events + billing status

---

## Security Requirements

- JWT + mk_ API key authentication (RaaS v2.0.0)
- Rate limiting via Cloudflare KV
- Agency ID validation (tenant isolation)
- Audit logging for all requests

---

## Implementation Steps

### Step 1: Create Quota API Endpoint

**File:** `src/app/api/v1/quota/[tenantId]/route.ts`

**Functions:**
- `GET /api/v1/quota/{tenantId}` - Return quota status

**Response Schema:**
```typescript
interface QuotaStatusResponse {
  tenantId: string;
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  limits: {
    hourlyCredits: number;
    dailyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };
  usage: {
    hourly: number;
    daily: number;
    monthly: number;
    requests: number;
  };
  percentages: {
    hourly: number;
    daily: number;
    monthly: number;
  };
  status: 'ok' | 'warning' | 'critical';
  polarSynced: boolean;
  lastPolarSync?: string;
}
```

**Auth:** JWT validation + agency_id check

---

### Step 2: Create Overage API Endpoint

**File:** `src/app/api/v1/overage/[tenantId]/route.ts`

**Functions:**
- `GET /api/v1/overage/{tenantId}` - Return overage events

**Response Schema:**
```typescript
interface OverageEventsResponse {
  tenantId: string;
  events: Array<{
    id: string;
    exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
    exceededLimit: number;
    exceededCurrent: number;
    exceededBy: number;
    requestedCredits: number;
    endpoint: string;
    service: string;
    action: string;
    billable: boolean;
    createdAt: string;
  }>;
  totalOverage: number;
  billedOverage: number;
  unbilledOverage: number;
}
```

**Auth:** JWT validation + agency_id check

---

### Step 3: Create Shared Utilities

**Files:**
- `src/lib/quota/quota-api-helpers.ts` - Shared helpers for quota API
- `src/lib/overage/overage-formatter.ts` - Format overage events for API

---

### Step 4: Add Rate Limiting

**File:** `src/lib/security/rate-limiter.ts` (already exists, update if needed)

**Config:**
- 100 requests/minute per tenant
- KV-based sliding window

---

### Step 5: Write Tests

**Files:**
- `src/app/api/v1/quota/[tenantId]/route.test.ts`
- `src/app/api/v1/overage/[tenantId]/route.test.ts`

**Test Cases:**
- Auth failure (no token)
- Auth failure (invalid token)
- Cross-tenant access blocked
- Successful quota fetch
- Successful overage fetch
- Rate limiting triggered

---

## Success Criteria

- [ ] Both endpoints return correct data
- [ ] JWT authentication works
- [ ] Agency ID validation blocks cross-tenant access
- [ ] Rate limiting prevents abuse
- [ ] All tests pass (100%)
- [ ] Zero TypeScript `any` types
- [ ] Build passes with 0 errors

---

## Files to Create

```
src/app/api/v1/quota/[tenantId]/route.ts
src/app/api/v1/overage/[tenantId]/route.ts
src/lib/quota/quota-api-helpers.ts
src/lib/overage/overage-formatter.ts
src/app/api/v1/quota/[tenantId]/route.test.ts
src/app/api/v1/overage/[tenantId]/route.test.ts
```

---

## Dependencies

- `src/lib/raas-gateway-enhanced.ts` - JWT validation
- `src/lib/quota/quota-enforcer.ts` - Quota status
- `src/lib/billing/overage-billing-reconciler.ts` - Overage events
- `src/lib/security/rate-limiter.ts` - Rate limiting
- `src/lib/audit/audit-logger.ts` - Request logging
