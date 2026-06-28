# Multi-Tenant Usage Attribution System Research

**Date:** 2026-03-09
**Researcher:** general-purpose agent
**Phase:** Phase 6 - RaaS Gateway Integration

---

## 1. Current State Analysis

### 1.1 RaaS Gateway Architecture

#### JWT Claims Structure (`jwt-validator.ts`)

```typescript
interface JwtPayload {
  sub: string        // user_id
  iat: number        // issued at
  exp: number        // expiration
  permissions?: string[]
  aud?: string       // audience: 'authenticated' | 'supabase'
  iss?: string       // issuer: Supabase URL
}
```

**Key Findings:**
- Current JWT does NOT include `agency_id` or `tenant_id` claims
- Validation uses Supabase JWKS endpoint: `{url}/auth/v1/jwks`
- Audience validation: `['authenticated', 'supabase']`
- Issuer validation: `{SupabaseURL}/auth/v1`

#### mk_ API Key Validation (`raas-gateway-enhanced.ts`, `api-key-validator.ts`)

**Current Flow:**
1. API key format: `mk_<key_id>_<secret>` (HMAC-SHA256)
2. Validation via `raas.agencyos.network` gateway
3. Dual auth support: JWT + API key
4. Rate limiting: 100 req/min default

**Interfaces:**
```typescript
export interface ApiKeyInfo {
  keyId: string      // 16 hex chars
  keyHash: string    // HMAC-SHA256
  ownerId: string    // user_id
  permissions: string[]
  expiresAt?: number
  rateLimitPerMin: number
}
```

#### Cloudflare KV Integration

**Current Usage:**
- Circuit breaker state storage (`circuit:${licenseNonce}`)
- Real-time usage counters (`usage:${userId}:${licenseNonce}`)
- Quota cache with TTL-based expiration

**KV Operations:**
```typescript
// Get state
const cached = await kv.get(key);

// Set with TTL
await kv.set(key, state, { expirationTtl: 300 });

// Delete
await kv.set(key, null);
```

### 1.2 Usage Metering Schema

#### `usage_events` Table (260309-0931)

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  license_nonce TEXT NOT NULL,
  user_id UUID NOT NULL,

  -- Usage details
  tier TEXT NOT NULL,                    -- BASIC | PREMIUM | ENTERPRISE
  service TEXT NOT NULL DEFAULT 'default',
  usage_count INTEGER NOT NULL,
  overage_count INTEGER NOT NULL,
  overage_fee DECIMAL(10,4) NOT NULL,

  -- Idempotency
  idempotency_key TEXT NOT NULL UNIQUE,
  event_timestamp TIMESTAMPTZ NOT NULL,
  billing_period TEXT,                   -- YYYY-MM format

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ
);
```

**Gap:** No explicit `tenant_id`, `agency_id`, or `customer_id` columns for multi-tenant attribution.

#### `overage_events` Table (260308-1800)

```sql
CREATE TABLE overage_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  license_nonce TEXT NOT NULL,

  -- Overage details
  exceeded_type TEXT NOT NULL,           -- hourly_credits | daily_credits | monthly_credits | daily_requests
  exceeded_limit INTEGER NOT NULL,
  exceeded_current INTEGER NOT NULL,
  exceeded_by INTEGER NOT NULL,

  -- Request context
  endpoint TEXT,
  service_name TEXT,
  action TEXT,

  -- Billing context
  tier_at_exceeded TEXT NOT NULL,
  external_customer_id TEXT,             -- Stripe/Polar customer ID
  billable BOOLEAN DEFAULT false,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,
  created_at BIGINT NOT NULL
);
```

**Note:** `external_customer_id` exists but is optional and not enforced.

### 1.3 Tenant/Agency Relationship

#### Current Schema (`raas_licenses` table via `raas-gateway-enhanced.ts`)

```typescript
// Enhanced validation attempts agency_id check
const { data: license } = await supabase
  .from('raas_licenses')
  .select('id')
  .eq('nonce', licenseNonce)
  .eq('agency_id', agencyId)  // agency_id column referenced but may not exist
  .single();
```

**Gap:** `agency_id` column is referenced in code but database schema may not have this column yet.

### 1.4 Stripe/Polar Integration

#### Polar Metered Billing (`polar-metered-billing.ts`)

**Customer Mapping:**
```typescript
interface PolarUsageRecordInput {
  customerId: string;      // Polar customer ID
  meterSlug: string;       // 'api_credits' | 'api_requests'
  quantity: number;
  idempotencyKey: string;
  timestamp?: string;
  metadata?: Record<string, string>;
}
```

**Key Functions:**
- `recordPolarUsage()` - Record usage to Polar meter
- `getPolarCustomerMeterBalance()` - Get current balance
- `createPolarInvoiceItem()` - One-time charges
- `mapOverageToPolarUsage()` - Convert overage to Polar record

**Metadata Enrichment:**
```typescript
metadata: {
  license_nonce: licenseNonce,
  exceeded_type: exceededType,
}
```

**Gap:** No `tenant_id` or `agency_id` in metadata for cross-tenant attribution.

#### Polar Webhook Handler (`polar-webhook-handler.ts`)

**Event Types Handled:**
- `checkout.success` / `checkout.failed`
- `subscription.created` / `subscription.active` / `subscription.past_due` / `subscription.expired`
- `order.created` / `order.paid`

**Customer ID Flow:**
```typescript
const polarCustomerId = safeString((data.customer as Record<string, unknown>)?.id);

// Store in license metadata
await createLicense({
  metadata: {
    polarCustomerId,
    polarSubscriptionId,
    customerEmail,
    // ...
  }
});
```

---

## 2. Gaps Identification for Multi-Tenant Attribution

### 2.1 Critical Gaps (P0)

| Gap | Impact | Current State | Required State |
|-----|--------|---------------|----------------|
| **No tenant_id in JWT claims** | Cannot attribute usage to agency/tenant | JWT only has `sub` (user_id) | Add `agency_id`, `tenant_id` claims |
| **No agency_id in usage_events** | Usage cannot be aggregated by tenant | Only `user_id`, `license_nonce` | Add `tenant_id`, `agency_id` columns |
| **No multi-tenant KV namespacing** | Rate limiting not tenant-aware | Key: `usage:${userId}:${licenseNonce}` | Key: `usage:${tenantId}:${agencyId}:${licenseNonce}` |
| **Polar metadata incomplete** | Cannot reconcile usage to tenant | `license_nonce`, `exceeded_type` only | Add `tenant_id`, `agency_id`, `feature_key` |

### 2.2 Secondary Gaps (P1)

| Gap | Impact | Notes |
|-----|--------|-------|
| No `raas_api_keys` → tenant mapping | API keys not tenant-scoped | Add `tenant_id` column to `raas_api_keys` |
| No tenant-level quota aggregation | Cannot enforce agency-level limits | Add `quota_limits` table with `tenant_id` |
| No cross-tenant access audit | Security gap for multi-tenant isolation | Add `cross_tenant_access` audit event type |

### 2.3 Schema Gaps

**Missing Columns:**
- `raas_licenses.agency_id` (TEXT, nullable)
- `raas_licenses.tenant_id` (TEXT, nullable)
- `usage_events.tenant_id` (TEXT, NOT NULL)
- `usage_events.agency_id` (TEXT, nullable)
- `overage_events.tenant_id` (TEXT, NOT NULL)
- `raas_api_keys.tenant_id` (TEXT, nullable)

---

## 3. Schema Đề Xuất cho Tenant Context Enrichment

### 3.1 Migration: Tenant Attribution Columns

```sql
-- ============================================================================
-- Migration: 260309-1400-add-tenant-attribution-columns.sql
-- Purpose: Add tenant context to usage attribution tables
-- ============================================================================

-- Add tenant_id and agency_id to raas_licenses
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS tenant_id TEXT,
  ADD COLUMN IF NOT EXISTS agency_id TEXT;

CREATE INDEX IF NOT EXISTS idx_raas_licenses_tenant ON raas_licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_agency ON raas_licenses(agency_id);

-- Add tenant context to usage_events
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS agency_id TEXT;

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_agency ON usage_events(agency_id);

-- Backfill tenant_id from user_id (assuming 1:1 mapping initially)
UPDATE usage_events ue
SET tenant_id = ue.user_id::text
WHERE tenant_id = '';

-- Add tenant context to overage_events
ALTER TABLE overage_events
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS agency_id TEXT;

CREATE INDEX IF NOT EXISTS idx_overage_events_tenant ON overage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_overage_events_agency ON overage_events(agency_id);

-- Backfill tenant_id
UPDATE overage_events oe
SET tenant_id = oe.user_id::text
WHERE tenant_id = '';

-- Add tenant_id to raas_api_keys
ALTER TABLE raas_api_keys
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_raas_api_keys_tenant ON raas_api_keys(tenant_id);

-- Add comments
COMMENT ON COLUMN raas_licenses.tenant_id IS 'Tenant identifier for multi-tenant attribution';
COMMENT ON COLUMN raas_licenses.agency_id IS 'Agency identifier for RaaS gateway isolation';
COMMENT ON COLUMN usage_events.tenant_id IS 'Tenant ID for usage attribution and billing';
COMMENT ON COLUMN overage_events.tenant_id IS 'Tenant ID for overage billing reconciliation';
COMMENT ON COLUMN raas_api_keys.tenant_id IS 'Tenant ID for API key scoping';
```

### 3.2 Enhanced Usage Events Schema (Future)

```sql
-- New table for granular feature-level metering
CREATE TABLE IF NOT EXISTS usage_event_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES usage_events(id) ON DELETE CASCADE,

  -- Feature attribution
  feature_key TEXT NOT NULL,           -- e.g., 'video-render', 'avatar-gen'
  model_name TEXT,                     -- e.g., 'gpt-4', 'elevenlabs'
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,

  -- Cost breakdown
  credit_cost INTEGER NOT NULL,
  unit_cost DECIMAL(10,6),
  currency TEXT DEFAULT 'USD',

  -- Tenant context (denormalized for fast queries)
  tenant_id TEXT NOT NULL,
  agency_id TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_event_details_event ON usage_event_details(event_id);
CREATE INDEX idx_usage_event_details_feature ON usage_event_details(feature_key);
CREATE INDEX idx_usage_event_details_tenant ON usage_event_details(tenant_id);
```

---

## 4. Integration Points với KV Rate Limiting

### 4.1 Current KV Key Patterns

```typescript
// Circuit breaker
const circuitKey = `circuit:${licenseNonce}`;

// Real-time usage
const usageKey = `usage:${userId}:${licenseNonce}`;

// Quota cache
const quotaKey = `quota:${userId}:${tier}:${window}`;
```

### 4.2 Proposed Tenant-Aware KV Keys

```typescript
// Tenant-scoped circuit breaker
const circuitKey = `circuit:${tenantId}:${agencyId}:${licenseNonce}`;

// Tenant-scoped usage counter
const usageKey = `usage:${tenantId}:${agencyId}:${licenseNonce}:${featureKey}`;

// Tenant-level quota aggregate
const tenantQuotaKey = `tenant-quota:${tenantId}:${window}`;

// Agency-level rate limit
const agencyRateKey = `agency-rate:${agencyId}:${endpoint}:${window}`;
```

### 4.3 KV Rate Limiting with Tenant Context

```typescript
interface TenantRateLimitState {
  tenantId: string;
  agencyId?: string;
  requestsInWindow: number;
  windowStart: number;
  windowMs: number;
  featureBreakdown: Record<string, number>;  // Per-feature usage
}

async function checkTenantRateLimit(
  tenantId: string,
  agencyId: string,
  featureKey: string,
  limit: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const kv = getKvClient();
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;  // 1-minute window
  const key = `rate:${tenantId}:${agencyId}:${windowStart}`;

  const current = await kv.get(key) as TenantRateLimitState | null;
  const currentCount = current?.requestsInWindow || 0;

  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: windowStart + 60000,
    };
  }

  // Update counter
  const updated: TenantRateLimitState = {
    tenantId,
    agencyId,
    requestsInWindow: currentCount + 1,
    windowStart,
    windowMs: 60000,
    featureBreakdown: {
      ...current?.featureBreakdown,
      [featureKey]: (current?.featureBreakdown?.[featureKey] || 0) + 1,
    },
  };

  await kv.set(key, updated, { expirationTtl: 120 });  // 2-minute TTL

  return {
    allowed: true,
    remaining: limit - currentCount - 1,
    resetAt: windowStart + 60000,
  };
}
```

---

## 5. Implementation Recommendations

### 5.1 Phase 1: Database Schema (Week 1)

**Tasks:**
1. Run migration `260309-1400-add-tenant-attribution-columns.sql`
2. Backfill `tenant_id` from `user_id` for existing records
3. Update RLS policies to include tenant checks
4. Add database triggers for auto-populating `tenant_id`

**RLS Policy Example:**
```sql
-- Users can only view usage events for their tenant
CREATE POLICY "Users can view own tenant usage"
  ON usage_events FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );
```

### 5.2 Phase 2: JWT Enrichment (Week 1)

**Tasks:**
1. Add `tenant_id` and `agency_id` to JWT claims on auth
2. Update `jwt-validator.ts` to extract tenant context
3. Update RaaS Gateway to pass tenant context in headers

**JWT Payload Extension:**
```typescript
interface ExtendedJwtPayload {
  sub: string;           // user_id
  tenant_id: string;     // NEW: Tenant identifier
  agency_id?: string;    // NEW: Agency identifier (optional)
  iat: number;
  exp: number;
  permissions?: string[];
  aud?: string;
  iss?: string;
}
```

### 5.3 Phase 3: Usage Event Enrichment (Week 2)

**Tasks:**
1. Update `usage-event-tracker.ts` to include `tenant_id`
2. Update `usage-aggregator.ts` to aggregate by tenant
3. Update Polar webhook handlers to include tenant in metadata

**Code Change Example:**
```typescript
// Before
await supabase.from('usage_events').insert({
  user_id: userId,
  license_nonce: licenseNonce,
  // ...
});

// After
await supabase.from('usage_events').insert({
  user_id: userId,
  tenant_id: tenantId,    // NEW
  agency_id: agencyId,    // NEW
  license_nonce: licenseNonce,
  // ...
});
```

### 5.4 Phase 4: KV Rate Limiting (Week 2)

**Tasks:**
1. Migrate KV keys to tenant-scoped format
2. Implement tenant-level rate limiting
3. Add agency-level cross-tenant aggregation

### 5.5 Phase 5: Polar/Stripe Integration (Week 3)

**Tasks:**
1. Update `polar-metered-billing.ts` to include tenant in metadata
2. Add tenant attribution to invoice items
3. Implement cross-tenant usage reconciliation

**Metadata Enhancement:**
```typescript
metadata: {
  license_nonce: licenseNonce,
  tenant_id: tenantId,        // NEW
  agency_id: agencyId,        // NEW
  exceeded_type: exceededType,
  feature_key: featureKey,    // NEW (for granular metering)
}
```

### 5.6 Phase 6: Testing & Validation (Week 3)

**Test Cases:**
1. Multi-tenant isolation verification
2. Cross-tenant access blocking
3. Tenant-level quota enforcement
4. Agency-level aggregation accuracy
5. Polar usage attribution correctness

---

## 6. Unresolved Questions

1. **Tenant Hierarchy:** Is there a hierarchy (tenant → sub-tenant → agency) or flat structure?

2. **Agency vs Tenant:** Are these the same concept or different? Current code uses both terms interchangeably.

3. **Existing Licenses:** How to handle existing licenses without `tenant_id`? Migration strategy needed.

4. **RaaS Gateway URL:** Is `raas.agencyos.network` production-ready or still in development?

5. **KV Namespace ID:** What is the Cloudflare KV namespace ID for production?

6. **Polar Meter Slugs:** What are the exact meter slugs configured in Polar dashboard?

7. **Multi-Tenant Pricing:** Different pricing per tenant tier? Volume discounts?

---

## Summary

**Current State:** The system has basic usage tracking but lacks multi-tenant attribution. JWT tokens, database schemas, and KV rate limiting are all user-centric, not tenant-aware.

**Key Gaps:**
- No `tenant_id` in JWT claims
- No `tenant_id` columns in key tables
- No tenant-scoped rate limiting
- Polar metadata incomplete for cross-tenant reconciliation

**Recommended Approach:**
1. Schema migration first (add columns)
2. JWT enrichment (add claims)
3. Code updates (propagate tenant context)
4. KV rate limiting (tenant-aware)
5. Polar integration (metadata enrichment)
6. Testing (isolation verification)

**Timeline:** 3 weeks for full implementation
