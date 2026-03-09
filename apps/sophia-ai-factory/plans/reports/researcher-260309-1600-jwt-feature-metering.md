# Research Report: JWT Claims & Feature-Level Metering for Phase 6 RaaS Gateway

**Date:** 2026-03-09 16:00
**Author:** general-purpose agent
**Work Context:** /Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/apps/sophia-ai-factory

---

## Executive Summary

This research analyzes the current JWT claims structure, API key validation flow, usage metering system, and database schema to identify gaps and recommend enhancements for feature-level metering in the Phase 6 RaaS Gateway.

**Key Findings:**
1. Current JWT payload lacks feature entitlements and granular permissions
2. Usage events schema has been extended with `feature_name` and `product_context` columns but tracking is not fully integrated
3. API keys support permissions array but no feature-level scoping
4. Cloudflare Worker KV caching exists for quota but not for feature entitlements

---

## 1. Current JWT Claims Structure Analysis

### 1.1 JWT Payload Interface (`src/lib/security/jwt-validator.ts`)

```typescript
export interface JwtPayload {
  sub: string                    // user_id
  iat: number                    // issued at (seconds)
  exp: number                    // expiration (seconds)
  permissions?: string[]         // optional permissions array
  aud?: string                   // audience
  iss?: string                   // issuer
  // MISSING: agency_id, feature_entitlements, tier, license_nonce
}
```

### 1.2 Agency ID Extraction (`src/lib/raas-gateway-enhanced.ts`)

The system extracts `agency_id` from JWT claims:

```typescript
async function verifyAgencyIdFromJwt(token: string): Promise<string | null> {
  const verified = await jwtVerify(token, secret);
  const agencyId = verified.payload.agency_id as string;
  // ...
}
```

**Current State:**
- `agency_id` is expected but NOT currently embedded in JWT by Supabase Auth
- Extraction falls back to `X-RaaS-Agency-ID` header
- No validation that agency_id matches license ownership in JWT itself

### 1.3 JWT Nonce Tracking (`src/lib/auth/jwt-nonce-tracker`)

System implements replay prevention via `jti` claim:
- Tracks used nonces to prevent JWT replay attacks
- Called in `jwt-validator.ts` line 174-190

---

## 2. API Key Validation Analysis

### 2.1 API Key Structure (`src/lib/security/api-key-validator.ts`)

```typescript
export interface ApiKeyInfo {
  keyId: string
  keyPrefix: string           // First 8 chars of mk_...
  ownerId: string
  permissions: string[]       // ['audit:read', 'audit:write', 'reports:download']
  createdAt: number
  expiresAt?: number
  lastUsedAt?: number
  rateLimitPerMinute: number
}
```

**Database Schema (`raas_api_keys` table):**
```sql
CREATE TABLE raas_api_keys (
  id UUID PRIMARY KEY,
  key_id TEXT UNIQUE NOT NULL,
  key_hash TEXT NOT NULL,                    -- HMAC-SHA256 hash
  owner_id TEXT NOT NULL REFERENCES auth.users(id),
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  rate_limit_per_min INT DEFAULT 100
);
```

### 2.2 Multi-Tenant Attribution (Migration 260309-1400)

Added columns for tenant isolation:
```sql
ALTER TABLE raas_api_keys
  ADD COLUMN tenant_id UUID REFERENCES auth.users(id),
  ADD COLUMN agency_id TEXT,
  ADD COLUMN product_context TEXT;
```

**Gap Identified:**
- No `feature_entitlements` column for granular feature access
- Permissions are action-based (`audit:read`) not feature-based (`heygen.createVideo`)

---

## 3. Usage Metering & Feature Tracking

### 3.1 Usage Events Schema (`260309-0931-create-usage-events-table.sql`)

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY,
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tier TEXT NOT NULL,
  service TEXT NOT NULL DEFAULT 'default',
  usage_count INTEGER NOT NULL,
  overage_count INTEGER NOT NULL,
  overage_fee DECIMAL(10,4) NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_timestamp TIMESTAMPTZ NOT NULL,
  billing_period TEXT,
  processed BOOLEAN DEFAULT false
);
```

### 3.2 Feature Columns Added (`260309-1400-add-tenant-attribution-columns.sql`)

```sql
ALTER TABLE usage_events
  ADD COLUMN tenant_id UUID,
  ADD COLUMN agency_id TEXT,
  ADD COLUMN product_context TEXT,         -- e.g., "content-factory", "analytics"
  ADD COLUMN feature_name TEXT;            -- e.g., "video-render", "voice-synthesis"
```

### 3.3 Usage Event Types (`src/lib/usage-metering/types.ts`)

```typescript
export interface UsageEventInput {
  userId: string;
  licenseKeyHash: string;
  licenseNonce: string;
  service: AiService;                 // 'heygen' | 'elevenlabs' | 'openrouter'
  endpoint: string;
  action: string;
  tokensInput?: number;
  tokensOutput?: number;
  creditsUsed: number;
  tierAtRequest: string;
  statusCode?: number;
  resourceType?: string;              // 'rate_limited' | 'api_call'
  // MISSING: featureKey, featureEntitlements, quotaRemaining
}
```

### 3.4 Aggregated Usage Tracking

```typescript
export interface AggregatedUsage {
  tenantId: string;           // user_id
  licenseNonce: string;
  featureKey: string;         // service_name + action (e.g., "heygen.createVideo")
  timestamp: number;
  consumedUnits: number;
  requestCount: number;
  tokensInput: number;
  tokensOutput: number;
  avgResponseTimeMs: number;
  errorCount: number;
}
```

**Gap Identified:**
- `featureKey` is constructed from `service.action` but NOT validated against entitlements
- No mechanism to check if license has access to specific features before usage

---

## 4. Quota Enforcement Analysis

### 4.1 Quota Limits Structure (`src/lib/usage-metering/aggregator.ts`)

```typescript
export const QUOTA_LIMITS: Record<string, QuotaLimit> = {
  BASIC: {
    tier: 'BASIC',
    dailyCredits: 100,
    hourlyCredits: 20,
    dailyRequests: 500,
    monthlyCredits: 2000,
  },
  PREMIUM: { ... },
  ENTERPRISE: { ... },
  MASTER: { ... },
};
```

### 4.2 Quota Checker (`src/lib/quota/quota-checker.ts`)

**Cache Key Format:**
```
quota:{userId}:{licenseNonce}
```

**KV Storage:**
```typescript
export interface CachedQuota {
  hourly: number;
  daily: number;
  monthly: number;
  requests: number;
  timestamp?: number;
}
```

**Gap Identified:**
- No feature-level quota tracking (only aggregate credits)
- No KV cache for feature entitlements

### 4.3 Custom Quota Limits (`quota_limits` table)

```sql
-- Allows per-license customization
CREATE TABLE quota_limits (
  license_nonce TEXT PRIMARY KEY,
  custom_daily_credits INTEGER,
  custom_hourly_credits INTEGER,
  custom_monthly_credits INTEGER,
  custom_daily_requests INTEGER
);
```

**Recommendation:** Add `feature_entitlements JSONB` column for per-feature limits.

---

## 5. Cloudflare Worker Context

### 5.1 Worker Configuration (`wrangler.toml`)

```toml
name = "raas-gateway-worker"
main = "src/worker/index.ts"

[[kv_namespaces]]
binding = "KV_KV"
id = "<KV_NAMESPACE_ID>"

[[queues.producers]]
queue = "usage-events"
binding = "USAGE_QUEUE"
```

### 5.2 KV Client Access (`src/lib/quota/quota-checker.ts`)

```typescript
declare global {
  var KV_KV: {
    get: (key: string) => Promise<CachedQuota | null>;
    set: (key: string, value: CachedQuota, options?: { expirationTtl?: number }) => Promise<void>;
  } | undefined;
}
```

**Gap Identified:**
- KV only stores quota counters, not feature entitlements
- No KV namespace for license-feature mapping

---

## 6. Gateway Instrumentation

### 6.1 Usage Event Emission (`src/lib/usage-metering/gateway-instrumentation.ts`)

```typescript
export async function emitUsageEvent(
  request: NextRequest,
  response: { status: number; headers?: Headers },
  context?: Partial<GatewayContext>
): Promise<void>
```

**Service Detection:**
```typescript
function determineServiceFromPath(pathname: string): AiService {
  // Extract from /api/{service}/... pattern
  const match = pathname.match(/^\/api\/([^/]+)/);
  // Maps to 'heygen' | 'elevenlabs' | 'openrouter'
}
```

**Gap Identified:**
- No pre-request feature entitlement check
- Events emitted post-request (after usage already occurred)
- No blocking mechanism for unauthorized feature access

---

## 7. Database Schema Summary

### 7.1 Key Tables

| Table | Key Columns | Feature Metering Support |
|-------|-------------|--------------------------|
| `raas_licenses` | nonce, tier, created_by, metadata | `product_context` added, no `feature_entitlements` |
| `raas_api_keys` | key_id, key_hash, owner_id, permissions[] | permissions are action-based, not feature-based |
| `usage_events` | license_nonce, user_id, service, credits_used | `feature_name` column added but not populated |
| `overage_events` | license_nonce, exceeded_type, overage_count | No feature attribution |
| `quota_limits` | license_nonce, custom_* columns | No feature-level limits |

### 7.2 Tenant Attribution (Migration 260309-1400)

All tables now have:
- `tenant_id UUID` - Direct user reference
- `agency_id TEXT` - Agency/organization grouping
- `product_context TEXT` - Product/module identification (usage_events, raas_licenses, raas_api_keys)

---

## 8. Identified Gaps

### 8.1 JWT Claims Gaps

| Missing Claim | Purpose | Priority |
|---------------|---------|----------|
| `license_nonce` | Direct license identifier | P0 |
| `tier` | User tier for quota lookup | P0 |
| `agency_id` | Multi-tenant isolation | P0 |
| `feature_entitlements` | Array of accessible features | P0 |
| `quota_remaining` | Real-time quota status | P1 |
| `jti` | Nonce for replay prevention | ✅ Implemented |

### 8.2 Feature Metering Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| No feature entitlement validation | Users can access features beyond their tier | P0 |
| `feature_name` column not populated | Cannot track feature-level usage | P0 |
| No per-feature quota limits | Cannot limit specific features | P1 |
| No KV cache for entitlements | DB lookup on every request | P1 |
| Post-request tracking only | Cannot block unauthorized usage | P0 |

### 8.3 API Key Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| Permissions are action-based | Cannot scope to features like `heygen.createVideo` | P1 |
| No feature_entitlements column | API keys cannot grant feature access | P1 |
| No tenant attribution enforcement | Cross-tenant API key usage possible | P0 |

---

## 9. Recommended Enriched Claims Schema

### 9.1 Enhanced JWT Payload

```typescript
export interface EnrichedJwtPayload {
  // Standard claims
  sub: string;                    // user_id
  iat: number;
  exp: number;
  jti: string;                    // Nonce for replay prevention
  iss: string;
  aud: string;

  // RaaS-specific claims
  agency_id: string;              // Multi-tenant isolation
  license_nonce: string;          // License identifier
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

  // Feature entitlements
  feature_entitlements: string[]; // ['heygen.createVideo', 'elevenlabs.synthesize', ...]
  feature_limits: {               // Per-feature limits
    [featureKey: string]: {
      daily_limit?: number;
      monthly_limit?: number;
      max_tokens?: number;
    }
  };

  // Quota status (optional, may be stale)
  quota_remaining?: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
  };
}
```

### 9.2 Recommended Database Schema Extensions

```sql
-- Add feature entitlements to raas_licenses
ALTER TABLE raas_licenses
  ADD COLUMN feature_entitlements JSONB DEFAULT '[]'::jsonb;

-- Add per-feature limits to quota_limits
ALTER TABLE quota_limits
  ADD COLUMN feature_limits JSONB DEFAULT '{}'::jsonb;

-- Create feature entitlements lookup table (optional, for complex scenarios)
CREATE TABLE raas_feature_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce),
  feature_key TEXT NOT NULL,          -- e.g., "heygen.createVideo"
  daily_limit INTEGER,
  monthly_limit INTEGER,
  max_tokens INTEGER,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(license_nonce, feature_key)
);

CREATE INDEX idx_raas_feature_entitlements_license
  ON raas_feature_entitlements(license_nonce);
```

### 9.3 Recommended Usage Event Schema Extensions

```typescript
export interface EnrichedUsageEventInput {
  // Existing fields
  userId: string;
  licenseNonce: string;
  service: AiService;
  action: string;
  creditsUsed: number;
  tierAtRequest: string;

  // NEW: Feature tracking
  featureKey: string;               // "service.action" format
  featureEntitlementChecked: boolean; // true if entitlement validation passed
  quotaRemaining?: {
    dailyCredits: number;
    hourlyCredits: number;
    featureDailyRemaining?: number;
  };

  // Tenant attribution
  tenantId: string;
  agencyId?: string;
  productContext?: string;

  // Response details
  statusCode: number;
  responseTimeMs?: number;
  tokensInput?: number;
  tokensOutput?: number;

  // Idempotency
  idempotencyKey: string;
  requestId: string;
}
```

---

## 10. Implementation Recommendations

### 10.1 Phase 1: JWT Claims Enrichment Service

**File:** `src/lib/auth/jwt-claims-enrichment.ts`

```typescript
/**
 * Enrich JWT claims with feature entitlements
 * Called after Supabase Auth JWT generation
 */
export async function enrichJwtClaims(
  userId: string,
  licenseNonce: string
): Promise<EnrichedJwtClaims> {
  const supabase = createAdminClient();

  // Fetch license with entitlements
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('tier, feature_entitlements, metadata')
    .eq('nonce', licenseNonce)
    .single();

  // Fetch custom limits
  const { data: limits } = await supabase
    .from('quota_limits')
    .select('feature_limits')
    .eq('license_nonce', licenseNonce)
    .single();

  return {
    license_nonce: licenseNonce,
    tier: license.tier,
    feature_entitlements: license.feature_entitlements || getDefaultEntitlements(license.tier),
    feature_limits: limits?.feature_limits || {},
  };
}
```

### 10.2 Phase 2: Feature Entitlement Checker

**File:** `src/lib/feature/feature-entitlement-checker.ts`

```typescript
export interface FeatureCheckResult {
  allowed: boolean;
  reason?: 'not_entitled' | 'quota_exceeded' | 'feature_disabled';
  featureKey: string;
  remaining?: number;
}

export async function checkFeatureEntitlement(
  licenseNonce: string,
  featureKey: string,
  userId: string
): Promise<FeatureCheckResult> {
  const supabase = createAdminClient();

  // Check if feature is entitled
  const { data: entitlement } = await supabase
    .from('raas_feature_entitlements')
    .select('daily_limit, monthly_limit, enabled')
    .eq('license_nonce', licenseNonce)
    .eq('feature_key', featureKey)
    .single();

  if (!entitlement || !entitlement.enabled) {
    return { allowed: false, reason: 'not_entitled', featureKey };
  }

  // Check daily usage
  const dayStart = Math.floor(Date.now() / 86400) * 86400;
  const { data: usage } = await supabase
    .from('usage_events')
    .select('usage_count')
    .eq('license_nonce', licenseNonce)
    .eq('feature_name', featureKey)
    .gte('event_timestamp', dayStart);

  const dailyUsage = usage?.reduce((sum, u) => sum + (u.usage_count || 0), 0) || 0;

  if (entitlement.daily_limit && dailyUsage >= entitlement.daily_limit) {
    return {
      allowed: false,
      reason: 'quota_exceeded',
      featureKey,
      remaining: entitlement.daily_limit - dailyUsage
    };
  }

  return {
    allowed: true,
    featureKey,
    remaining: entitlement.daily_limit ? entitlement.daily_limit - dailyUsage : undefined
  };
}
```

### 10.3 Phase 3: KV Cache for Feature Entitlements

**File:** `src/lib/feature/entitlement-cache.ts`

```typescript
export interface CachedEntitlements {
  features: string[];
  limits: Record<string, FeatureLimit>;
  timestamp: number;
  ttl: number;
}

export async function getEntitlementsFromCache(
  licenseNonce: string
): Promise<CachedEntitlements | null> {
  const kv = getKvClient();
  if (!kv) return null;

  const key = `entitlements:${licenseNonce}`;
  return await kv.get(key);
}

export async function cacheEntitlements(
  licenseNonce: string,
  entitlements: CachedEntitlements
): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  const key = `entitlements:${licenseNonce}`;
  await kv.set(key, entitlements, { expirationTtl: entitlements.ttl });
}
```

### 10.4 Phase 4: RaaS Gateway Feature Gate

**File:** `src/lib/raas-gateway-feature.ts`

```typescript
export async function raasFeatureGate(
  request: NextRequest,
  requiredFeature: string
): Promise<{ valid: boolean; response?: NextResponse }> {
  // Extract license context
  const licenseKey = extractLicenseKey(request);
  const { valid, license } = await validateLicenseKey(licenseKey);

  if (!valid) {
    return {
      valid: false,
      response: createForbiddenResponse('invalid-license')
    };
  }

  // Check feature entitlement
  const result = await checkFeatureEntitlement(
    license.nonce,
    requiredFeature,
    license.userId
  );

  if (!result.allowed) {
    // Log entitlement denial for audit
    await logEntitlementDenial({
      licenseNonce: license.nonce,
      feature: requiredFeature,
      reason: result.reason,
      path: request.nextUrl.pathname,
    });

    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'Feature Access Denied',
          code: result.reason,
          feature: requiredFeature,
        },
        { status: 403 }
      )
    };
  }

  return { valid: true };
}
```

---

## 11. Default Feature Entitlements by Tier

```typescript
export const DEFAULT_FEATURE_ENTITLEMENTS: Record<string, string[]> = {
  BASIC: [
    'heygen.createVideo',
    'elevenlabs.synthesize',
    'openrouter.chat',
  ],
  PREMIUM: [
    'heygen.createVideo',
    'heygen.translateVideo',
    'elevenlabs.synthesize',
    'elevenlabs.voiceCloning',
    'openrouter.chat',
    'openrouter.completions',
  ],
  ENTERPRISE: [
    'heygen.createVideo',
    'heygen.translateVideo',
    'heygen.batchRender',
    'elevenlabs.synthesize',
    'elevenlabs.voiceCloning',
    'elevenlabs.projects',
    'openrouter.chat',
    'openrouter.completions',
    'openrouter.embeddings',
  ],
  MASTER: [
    // All features unlimited
    '*',
  ],
};
```

---

## 12. Migration Script (Recommended)

```sql
-- Migration: Add Feature Entitlements Support
-- Date: 2026-03-09

-- 1. Add feature_entitlements column to raas_licenses
ALTER TABLE raas_licenses
  ADD COLUMN IF NOT EXISTS feature_entitlements JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN raas_licenses.feature_entitlements IS 'Array of feature keys entitled to this license';

-- 2. Create feature entitlements lookup table
CREATE TABLE IF NOT EXISTS raas_feature_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce TEXT NOT NULL REFERENCES raas_licenses(nonce) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  daily_limit INTEGER,
  monthly_limit INTEGER,
  max_tokens INTEGER,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(license_nonce, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_raas_feature_entitlements_license
  ON raas_feature_entitlements(license_nonce, feature_key);

COMMENT ON TABLE raas_feature_entitlements IS 'Per-feature entitlements and limits for RaaS licenses';

-- 3. Add feature_limits to quota_limits
ALTER TABLE quota_limits
  ADD COLUMN IF NOT EXISTS feature_limits JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN quota_limits.feature_limits IS 'Per-feature limits: {"heygen.createVideo": {"daily": 10, "monthly": 300}}';

-- 4. Update usage_events to ensure feature_name is populated
-- (Add trigger or application-level enforcement)
CREATE OR REPLACE FUNCTION ensure_feature_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.feature_name IS NULL THEN
    NEW.feature_name := COALESCE(NEW.service, 'unknown') || '.' || COALESCE(NEW.endpoint, 'unknown');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_feature_name ON usage_events;
CREATE TRIGGER trg_ensure_feature_name
  BEFORE INSERT OR UPDATE ON usage_events
  FOR EACH ROW
  EXECUTE FUNCTION ensure_feature_name();
```

---

## 13. Testing Recommendations

### 13.1 Unit Tests

```typescript
// src/lib/feature/feature-entitlement-checker.test.ts
describe('checkFeatureEntitlement', () => {
  it('should allow access for entitled feature', async () => {
    const result = await checkFeatureEntitlement(
      'license_123',
      'heygen.createVideo',
      'user_456'
    );
    expect(result.allowed).toBe(true);
  });

  it('should deny access for non-entitled feature', async () => {
    const result = await checkFeatureEntitlement(
      'license_789',
      'heygen.batchRender',  // Enterprise-only feature
      'user_012'  // BASIC tier user
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_entitled');
  });

  it('should deny access when daily quota exceeded', async () => {
    const result = await checkFeatureEntitlement(
      'license_345',
      'heygen.createVideo',
      'user_678'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('quota_exceeded');
  });
});
```

### 13.2 Integration Tests

```typescript
// src/lib/raas-gateway-feature.test.ts
describe('raasFeatureGate', () => {
  it('should block requests to premium features for BASIC tier', async () => {
    const request = createMockRequest({
      licenseKey: 'raas_basic_license_key',
      path: '/api/heygen/batchRender',
    });

    const result = await raasFeatureGate(request, 'heygen.batchRender');

    expect(result.valid).toBe(false);
    expect(result.response?.status).toBe(403);
  });

  it('should allow requests to entitled features', async () => {
    const request = createMockRequest({
      licenseKey: 'raas_enterprise_license_key',
      path: '/api/heygen/batchRender',
    });

    const result = await raasFeatureGate(request, 'heygen.batchRender');

    expect(result.valid).toBe(true);
  });
});
```

---

## 14. Summary & Next Steps

### 14.1 Priority Actions

| Priority | Action | Files to Create/Modify |
|----------|--------|------------------------|
| P0 | Add `feature_entitlements` to `raas_licenses` | `260309-1600-add-feature-entitlements.sql` |
| P0 | Create JWT claims enrichment service | `src/lib/auth/jwt-claims-enrichment.ts` |
| P0 | Implement feature entitlement checker | `src/lib/feature/feature-entitlement-checker.ts` |
| P0 | Update `usage_events.feature_name` population | `src/lib/usage-metering/tracker.ts` |
| P1 | Add KV cache for entitlements | `src/lib/feature/entitlement-cache.ts` |
| P1 | Create RaaS feature gate middleware | `src/lib/raas-gateway-feature.ts` |
| P1 | Add per-feature limits to quota system | `src/lib/quota/quota-checker.ts` |

### 14.2 Unresolved Questions

1. **JWT Generation:** Should feature entitlements be embedded directly in Supabase JWT or added as a separate claim enrichment step?

2. **Backward Compatibility:** How to handle existing licenses without `feature_entitlements`? (Recommendation: Default entitlements by tier)

3. **Feature Key Naming Convention:** Should we use `service.action` format or a more hierarchical `product.feature.action` format?

4. **Rate Limiting:** Should feature-level rate limiting be separate from or in addition to aggregate credit rate limiting?

5. **KV Namespace:** Should feature entitlements use the same KV namespace as quota or a separate namespace for better isolation?

---

## Appendix: Related Files

### Files Analyzed
- `src/lib/security/jwt-validator.ts`
- `src/lib/security/api-key-validator.ts`
- `src/lib/raas-gateway-enhanced.ts`
- `src/lib/usage-metering/types.ts`
- `src/lib/usage-metering/aggregator.ts`
- `src/lib/usage-metering/gateway-instrumentation.ts`
- `src/lib/quota/quota-checker.ts`
- `src/lib/analytics/roi-calculator.ts`
- `src/middleware/agency-isolation.ts`
- `src/middleware/tenant-isolation.ts`

### Migrations Analyzed
- `supabase/migrations/260309-0931-create-usage-events-table.sql`
- `supabase/migrations/260309-0932-update-overage-events-add-billing-columns.sql`
- `supabase/migrations/260309-1400-add-tenant-attribution-columns.sql`
- `supabase/migrations/20260308130000_create_raas_api_keys_table.sql`
- `supabase/migrations/260308-1800-create-overage-events-table.sql`
- `supabase/migrations/260308-1801-create-quota-limits-table.sql`

### Configuration Files
- `wrangler.toml`
- `worker-configuration.d.ts`

---

**Report Generated:** 2026-03-09 16:00
**Status:** Ready for implementation planning
