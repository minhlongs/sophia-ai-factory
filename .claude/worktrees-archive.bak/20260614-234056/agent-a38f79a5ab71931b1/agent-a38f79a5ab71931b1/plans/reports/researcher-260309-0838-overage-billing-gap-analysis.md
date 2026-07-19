# Overage Billing & Quota Enforcement Gap Analysis

**Date:** 2026-03-09
**Author:** Researcher Agent
**Project:** Sophia AI Factory
**Scope:** RaaS Gateway, Quota Enforcement, Polar.sh Integration

---

## Executive Summary

The Sophia AI Factory has a **solid foundation** for overage billing and quota enforcement with ~70% of core infrastructure implemented. Key components are in place but several critical gaps prevent production-ready deployment.

**Overall Status:** 70% Complete

| Component | Status | Completion |
|-----------|--------|------------|
| Database Schema | ✅ Complete | 100% |
| Quota Checking | ✅ Complete | 95% |
| Quota Enforcement | ✅ Complete | 90% |
| Overage Logging | ✅ Complete | 90% |
| Polar Metered Billing | ⚠️ Partial | 60% |
| Real-time Balance Checks | ❌ Missing | 0% |
| 429 Error Responses | ⚠️ Partial | 50% |
| Cloudflare KV Caching | ⚠️ Partial | 40% |
| Dashboard Analytics Sync | ❌ Missing | 0% |

---

## 1. Current Implementation Summary

### 1.1 Database Schema (100% Complete)

**Tables Created:**
- `overage_events` - Tracks quota exceeded events for billing reconciliation
- `quota_limits` - Custom quota limits per license with overage settings
- `raas_licenses` - RaaS license keys with Polar customer ID linkage
- `usage_events` - Real-time usage tracking with idempotency

**Key Fields:**
```sql
-- overage_events
- exceeded_type (hourly_credits | daily_credits | monthly_credits | daily_requests)
- exceeded_by (how much over limit)
- billable (boolean flag for reconciliation)
- external_customer_id (Polar/Stripe customer ID)

-- quota_limits
- overage_allowed (bool - allow usage beyond limits)
- overage_price_per_credit (DECIMAL for billing)
- overage_hard_limit (absolute max before block)
- soft_warning_threshold (default 80%)
```

**Location:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/supabase/migrations/`

### 1.2 Quota Checking Service (95% Complete)

**File:** `src/lib/quota/quota-checker.ts`

**Features:**
- Cloudflare KV caching for sub-ms quota checks
- Soft/hard threshold enforcement (80% warning, 100% block)
- Real-time usage calculation from `usage_events` table
- Enhanced results with `warningThreshold`, `softLimitReached`, `overageAllowed` flags
- Overage event logging integration

**Configuration:**
```typescript
DEFAULT_CONFIG: QuotaConfig = {
  softWarningThreshold: 0.8,     // 80% triggers warning
  enableOverageBilling: false,   // false = block on exceeded
  failClosed: true,              // true = block on quota check failure
}
```

**KV Cache Pattern:**
- Key format: `quota:{userId}:{licenseNonce}`
- TTL: 1 hour (3600s)
- Fallback to DB if KV unavailable

### 1.3 Quota Enforcer (90% Complete)

**File:** `src/lib/quota/quota-enforcer.ts`

**Features:**
- Hard blocking with 429 response generation
- Polar.sh sync integration (`syncQuotaFromPolar`)
- Circuit breaker pattern via `realtime-tracker.ts`
- Standardized `QuotaExceededResponse` with retry-after headers

**Response Format:**
```typescript
{
  error: 'Quota exceeded',
  code: 'quota_exceeded',
  message: 'Daily credit limit exceeded',
  exceeded: { type, limit, current, requested },
  remaining: { dailyCredits, hourlyCredits, monthlyCredits, dailyRequests },
  retryAfter: 3600,  // seconds until reset
  upgradeUrl: '/dashboard/billing',
  polarCustomerId?: string
}
```

**Polar Sync:**
- Fetches usage from Polar API monthly period
- Upserts to `usage_events` with idempotency keys
- Invalidates cache after sync

### 1.4 Overage Logger (90% Complete)

**File:** `src/lib/quota/overage-logger.ts`

**Features:**
- Batch buffering (10 events or 5-second flush)
- Immediate mode for critical events
- Billable flag tracking
- Summary aggregation by type

**Buffer Pattern:**
```typescript
class OverageEventBuffer {
  MAX_BUFFER_SIZE = 10;
  FLUSH_INTERVAL_MS = 5000;
  // Retries on failure with overflow protection
}
```

### 1.5 RaaS Gate Middleware (90% Complete)

**File:** `src/lib/raas-gate.ts`

**Features:**
- License key validation (HMAC-SHA256 via `raas-service.ts`)
- Emergency bypass header (`x-emergency-bypass`)
- Circuit breaker integration
- Fail-closed/fail-open configuration
- Quota enforcement integration

**Flow:**
1. Extract license key from headers
2. Validate via HMAC or V1 format fallback
3. Check emergency bypass
4. Enforce quota via `enforceQuota()`
5. Return receipt + quota warning flags

### 1.6 Polar Metered Billing Client (60% Complete)

**File:** `src/lib/billing/polar-metered-billing.ts`

**Features:**
- Usage recording via `customerMeters.createUsage()`
- Meter balance fetching via `customerMeters.listBalances()`
- One-time invoice item creation
- Exponential backoff retry (3 retries, 1s-10s delay)
- Idempotency key generation

**Functions:**
```typescript
recordPolarUsage(input: PolarUsageRecordInput)
getPolarCustomerMeterBalance(customerId, meterSlug)
createPolarInvoiceItem(input: PolarInvoiceItemInput)
mapOverageToPolarUsage(userId, polarCustomerId, exceededBy, ...)
```

**Gaps:**
- `createPolarInvoiceItem` uses `polar.orders.create()` - may not be correct API for invoice items
- No webhook handling for payment reconciliation
- No balance check integration with quota enforcement

### 1.7 Real-time Tracker with Circuit Breaker (85% Complete)

**File:** `src/lib/usage-metering/realtime-tracker.ts`

**Features:**
- Redis/Upstash for real-time counters
- Circuit breaker pattern (closed/open/half-open states)
- Failure threshold: 5 failures → circuit opens
- Reset timeout: 30 seconds → half-open
- Emergency bypass header support

**Circuit States:**
- **Closed:** Allow all requests
- **Open:** Block all (fail-closed)
- **Half-open:** Allow limited requests to test recovery

### 1.8 API Endpoints (70% Complete)

**Quota APIs:**
- `GET /api/quota/overage-events` - Fetch user's overage events
- `GET /api/quota/status` - Get current quota status

**Admin APIs:**
- `/api/admin/quota/` - Exists (implementation unknown)
- `/api/admin/usage/` - Exists (implementation unknown)

**Missing:**
- POST endpoint for manual usage adjustment
- Webhook endpoints for Polar payment reconciliation
- Analytics export endpoint for AgencyOS sync

---

## 2. Gap Analysis

### 2.1 Real-Time Polar Balance Checks (CRITICAL - 0% Complete)

**Problem:** The system checks local quota limits but doesn't verify against actual Polar customer balance/subscription status.

**Missing Components:**
1. **Pre-request balance check** - Before allowing requests, check if user has prepaid credits/active subscription
2. **Subscription status validation** - Verify subscription is active (not cancelled/expired)
3. **Balance-based quota override** - If Polar balance is 0, block even if local quota has remaining

**Required Implementation:**
```typescript
// New function needed in polar-metered-billing.ts
async function checkPolarSubscriptionStatus(
  polarCustomerId: string
): Promise<{
  active: boolean;
  balance: number;
  currentPeriodEnd: string | null;
  subscriptionTier: string;
}>

// Integration point: raas-gate.ts enforceQuota() call
const polarStatus = await checkPolarSubscriptionStatus(polarCustomerId);
if (!polarStatus.active || polarStatus.balance <= 0) {
  return { allowed: false, response: subscriptionExpiredResponse };
}
```

**Impact:** Without this check, users with cancelled subscriptions or zero balance could continue using services if local quota hasn't been exhausted.

### 2.2 429 Quota Exceeded Error Responses (PARTIAL - 50% Complete)

**Current State:**
- `createQuotaExceededResponse()` exists in `quota-enforcer.ts`
- Returns proper structure with `retryAfter`, `upgradeUrl`, etc.
- BUT: Not consistently returned from middleware

**Missing:**
1. **HTTP 429 status code** - Current code returns 503 in some places, 403 in others
2. **Standardized headers:**
   - `Retry-After: <seconds>`
   - `X-RateLimit-Limit: <max>`
   - `X-RateLimit-Remaining: <remaining>`
   - `X-RateLimit-Reset: <timestamp>`
3. **Response body standardization:**
   ```json
   {
     "error": "quota_exceeded",
     "message": "Daily credit limit exceeded",
     "code": "QUOTA_EXCEEDED",
     "exceeded": { "type": "daily_credits", "limit": 100, "current": 105 },
     "retry_after": 3600,
     "upgrade_url": "/dashboard/billing"
   }
   ```

**Fix Required in `raas-gate.ts`:**
```typescript
// Current (line ~293-301):
if (!quotaResult.allowed) {
  return {
    valid: false,
    response: quotaResult.response,  // May be 503 or wrong format
  };
}

// Should be:
if (!quotaResult.allowed && quotaResult.response) {
  return {
    valid: false,
    response: NextResponse.json(quotaResult.response, {
      status: 429,  // Explicit 429
      headers: {
        'Retry-After': String(quotaResult.response.retryAfter),
        'X-RateLimit-Remaining': '0',
      },
    }),
  };
}
```

### 2.3 Cloudflare Worker KV-Based Rate Limiting (PARTIAL - 40% Complete)

**Current State:**
- KV interface declared in `quota-checker.ts` (lines 23-29)
- `getKvClient()` function for lazy init
- Cache key format: `quota:{userId}:{licenseNonce}`
- But: No actual Cloudflare Worker deployment config

**Missing:**
1. **wrangler.toml configuration** - No Cloudflare Workers project setup
2. **KV namespace binding** - No `KV_KV` binding in deployment config
3. **Edge-compatible runtime** - Next.js middleware runs on Edge, but full quota logic may not be edge-optimized
4. **Distributed rate limiting** - Current implementation is single-region

**Required Files:**
```toml
# wrangler.toml (NEW FILE NEEDED)
name = "sophia-quota-enforcer"
main = "src/edge/quota-enforcer.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "KV_KV"
id = "<KV_NAMESPACE_ID>"
preview_id = "<PREVIEW_KV_ID>"
```

**Edge Function Pattern:**
```typescript
// src/edge/quota-enforcer.ts (NEW FILE NEEDED)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const kv = env.KV_KV;  // Cloudflare KV binding
    const usage = await kv.get(`quota:${userId}:${nonce}`);
    // ... edge-optimized quota check
  }
}
```

**Impact:** Without Cloudflare Workers deployment, rate limiting only works in Next.js serverless functions, not at the edge. This means requests hit your infrastructure before being blocked.

### 2.4 AgencyOS Dashboard Analytics Sync (MISSING - 0% Complete)

**Problem:** No endpoint to export quota/overage data to AgencyOS dashboard for unified analytics.

**Missing Components:**
1. **Export endpoint** - `/api/analytics/export` for quota data
2. **AgencyOS API client** - Push data to central AgencyOS instance
3. **Scheduled sync job** - Cron job for periodic sync
4. **Data transformation** - Map local schema to AgencyOS schema

**Required Implementation:**
```typescript
// NEW: /api/analytics/agencyos-sync/route.ts
export async function POST(req: NextRequest) {
  // Authenticate AgencyOS webhook secret
  // Fetch quota/overage data for date range
  // Transform to AgencyOS schema
  // Push to AgencyOS API
  // Log sync status
}
```

**AgencyOS Schema Mapping:**
```typescript
interface AgencyOSQuotaReport {
  agencyId: string;
  licenseNonce: string;
  periodStart: string;
  periodEnd: string;
  totalCreditsUsed: number;
  totalOverageCredits: number;
  overageCharges: number;
  tierHistory: Array<{ tier: string; startDate: string }>;
  quotaViolations: Array<{
    timestamp: string;
    type: string;
    exceededBy: number;
  }>;
}
```

### 2.5 Polar Webhook Reconciliation (MISSING - 0% Complete)

**Problem:** No webhook handler for Polar payment events to update subscription status and trigger billing reconciliation.

**Missing:**
1. **Webhook endpoint** - `/api/webhooks/polar-metered`
2. **Event handlers:**
   - `subscription.active` → activate quota
   - `subscription.expired` → revoke quota
   - `invoice.paid` → mark overage events as billable
   - `payment.failed` → suspend quota
3. **Signature verification** - Validate Polar webhook signatures

**Required Implementation:**
```typescript
// NEW: /api/webhooks/polar-metered/route.ts
export async function POST(req: NextRequest) {
  const signature = req.headers.get('polar-signature');
  const body = await req.json();

  // Verify webhook signature
  const isValid = verifyPolarWebhookSignature(body, signature);
  if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  switch (body.type) {
    case 'subscription.active':
      await activateSubscription(body.data);
      break;
    case 'subscription.expired':
      await expireSubscription(body.data);
      break;
    case 'invoice.paid':
      await reconcileOverageBilling(body.data);
      break;
  }

  return NextResponse.json({ received: true });
}
```

### 2.6 Missing Database Indexes

**Observation:** While indexes exist, some could improve query performance:

**Recommended Additions:**
```sql
-- Faster overage queries by billable status + date
CREATE INDEX idx_overage_events_billable_created
  ON overage_events(billable, created_at DESC)
  WHERE billable = true;

-- Faster Polar customer lookups
CREATE INDEX idx_usage_events_polar_customer
  ON usage_events(external_customer_id, created_at DESC);

-- Composite index for quota status queries
CREATE INDEX idx_quota_limits_license_overage
  ON quota_limits(license_nonce, overage_allowed);
```

---

## 3. Recommended Implementation Priorities

### Phase 1: Critical (Week 1)

1. **429 Error Response Standardization** (2-4 hours)
   - Update `raas-gate.ts` to return explicit 429 status
   - Add `Retry-After` and `X-RateLimit-*` headers
   - Create standardized response body

2. **Polar Subscription Status Check** (4-6 hours)
   - Implement `checkPolarSubscriptionStatus()` function
   - Integrate into `raas-gate.ts` quota enforcement flow
   - Add subscription expiry handling

3. **Polar Webhook Handler** (4-6 hours)
   - Create `/api/webhooks/polar-metered` endpoint
   - Implement signature verification
   - Handle subscription lifecycle events

### Phase 2: High Priority (Week 2)

4. **Cloudflare Workers Deployment** (8-12 hours)
   - Create `wrangler.toml` configuration
   - Migrate quota checker to edge-compatible format
   - Set up KV namespace binding
   - Deploy edge function

5. **AgencyOS Analytics Sync** (6-8 hours)
   - Create export endpoint
   - Build AgencyOS API client
   - Implement scheduled sync job
   - Add sync status logging

### Phase 3: Medium Priority (Week 3)

6. **Database Index Optimization** (1-2 hours)
   - Add recommended indexes
   - Run `EXPLAIN ANALYZE` on slow queries
   - Monitor query performance

7. **Overage Billing Reconciliation** (4-6 hours)
   - Build billing reconciliation job
   - Calculate overage charges from `overage_events`
   - Create invoices via Polar API
   - Mark events as billable

### Phase 4: Nice to Have (Week 4+)

8. **Dashboard UI Components** (8-16 hours)
   - Quota usage chart
   - Overage events table
   - Subscription status card
   - Billing history

---

## 4. Technical Debt & Issues Found

### 4.1 Code Quality Issues

**Issue 1: Inconsistent Error Handling**
- `quota-checker.ts` line 232-236: Returns zero usage on error (fail-open)
- `quota-enforcer.ts` line 208-212: Logs Polar sync failure but continues
- **Risk:** Silent failures could allow unauthorized usage

**Issue 2: Magic Numbers**
- `quota-checker.ts` line 56-60: Hardcoded config defaults
- `realtime-tracker.ts` line 32-36: Circuit breaker thresholds
- **Recommendation:** Extract to constants file or env vars

**Issue 3: Duplicate Code**
- `raas-gate.ts` and `raas-gateway-enhanced.ts` have overlapping logic
- **Recommendation:** Refactor into shared base class

### 4.2 Security Concerns

**Concern 1: KV Cache Poisoning**
- No cache signature/validation
- `getCachedUsage()` trusts KV data blindly
- **Risk:** If KV is compromised, quota checks bypassed

**Mitigation:**
```typescript
interface CachedQuota {
  usage: { hourly: number; daily: number };
  signature: string;  // HMAC of usage data
  timestamp: number;
}
```

**Concern 2: Race Conditions**
- `checkQuotaWithOverage()` reads usage, then decides
- Between read and decision, parallel requests could exceed quota
- **Risk:** Users could exploit race to exceed limits

**Mitigation:** Use atomic Redis INCR with TTL instead of read-then-write

### 4.3 Performance Bottlenecks

**Bottleneck 1: DB Query Pattern**
- `calculateCurrentUsage()` runs 3 parallel queries
- Each query scans `usage_events` without covering index
- **Impact:** ~50-100ms per quota check under load

**Optimization:**
```sql
-- Covering index for quota queries
CREATE INDEX idx_usage_events_quota_check
  ON usage_events(user_id, license_nonce, created_at)
  INCLUDE (credits_used);
```

**Bottleneck 2: Buffer Flush Latency**
- `OverageEventBuffer` flushes synchronously
- Under high load, buffer could grow large
- **Impact:** Memory pressure, potential data loss

**Optimization:** Use background worker or queue (e.g., Inngest, Bull)

---

## 5. File Inventory

### Core Implementation Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/quota/quota-checker.ts` | Real-time quota validation with KV caching | ✅ Complete |
| `src/lib/quota/quota-enforcer.ts` | Hard blocking + 429 responses | ✅ Complete |
| `src/lib/quota/overage-logger.ts` | Batch-buffered overage logging | ✅ Complete |
| `src/lib/quota/quota-api-helpers.ts` | API response formatting utilities | ✅ Complete |
| `src/lib/raas-gate.ts` | RaaS license validation middleware | ✅ Complete |
| `src/lib/raas-gateway-enhanced.ts` | Enhanced gateway with agency ID | ⚠️ Partial |
| `src/lib/billing/polar-metered-billing.ts` | Polar.sh usage tracking | ⚠️ Partial |
| `src/lib/usage-metering/realtime-tracker.ts` | Circuit breaker + Redis counters | ✅ Complete |
| `src/lib/usage-metering/aggregator.ts` | Usage aggregation logic | ✅ Complete |
| `src/lib/usage-metering/types.ts` | Type definitions | ✅ Complete |
| `src/lib/clients/upstash-redis-client.ts` | Redis client singleton | ✅ Complete |
| `src/lib/clients/polar-client.ts` | Polar SDK wrapper | ✅ Complete |

### API Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `GET /api/quota/overage-events` | Fetch user overage events | ✅ Complete |
| `GET /api/quota/status` | Get current quota status | ✅ Complete |
| `/api/admin/quota/` | Admin quota management | ⚠️ Unknown |
| `/api/admin/usage/` | Admin usage data | ⚠️ Unknown |
| `/api/webhooks/polar-metered` | Polar webhook handler | ❌ Missing |
| `/api/analytics/agencyos-sync` | AgencyOS sync | ❌ Missing |

### Database Migrations

| Migration | Purpose | Status |
|-----------|---------|--------|
| `260308-1800-create-overage-events-table.sql` | Overage tracking | ✅ Complete |
| `260308-1801-create-quota-limits-table.sql` | Custom quota config | ✅ Complete |
| `20260308130000_create_raas_api_keys_table.sql` | API key auth | ✅ Complete |
| `20260307-usage-metering-schema-updates.sql` | Usage events schema | ✅ Complete |

---

## 6. Unresolved Questions

1. **What is the actual Polar.sh API for creating invoice items?** Current code uses `polar.orders.create()` but this may not be the correct endpoint for one-time charges.

2. **Should Cloudflare Workers replace Next.js middleware entirely?** Or run as a sidecar for rate limiting only?

3. **What is the AgencyOS API schema for quota data export?** Need to coordinate with AgencyOS team.

4. **What is the pricing model for overage credits?** Is it per-tier or dynamic?

5. **How should grace periods work?** Should users get a 5-minute grace window before hard blocking?

---

## 7. Quick Start for Next Developer

To continue implementation:

```bash
# 1. Review existing implementation
cd /Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/apps/sophia-ai-factory

# 2. Check current environment
cat .env.local | grep -E 'POLAR|KV|REDis'

# 3. Test existing quota endpoints
curl http://localhost:3000/api/quota/status \
  -H "Authorization: Bearer <test_token>"

# 4. Start with Phase 1 priority items:
#    - Fix 429 responses in src/lib/quota/quota-enforcer.ts
#    - Add Polar subscription check to src/lib/raas-gate.ts
#    - Create webhook handler at src/app/api/webhooks/polar-metered/route.ts
```

---

**End of Report**
