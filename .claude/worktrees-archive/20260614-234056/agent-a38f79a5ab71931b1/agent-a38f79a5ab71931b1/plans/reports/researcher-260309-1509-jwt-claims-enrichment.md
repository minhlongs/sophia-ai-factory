# Research Report: JWT Claims Enrichment for Phase 6

**Date:** 2026-03-09
**Author:** Researcher Agent
**Work Context:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory`

---

## Executive Summary

This report analyzes the current JWT validation, license management, and quota enforcement systems to enable **Phase 6: JWT Claims Enrichment**. The system currently uses a dual-authentication model (Supabase JWT for user auth + RaaS license keys for billing tier). The enrichment strategy should embed license tier and quota metadata into JWT claims for efficient Cloudflare Worker enforcement.

---

## 1. Current JWT Claims Structure

### 1.1 Supabase Auth JWT (User Authentication)

**File:** `src/lib/security/jwt-validator.ts`

```typescript
export interface JwtPayload {
  sub: string;           // user_id
  iat: number;           // issued at (seconds)
  exp: number;           // expiration (seconds)
  permissions?: string[]; // optional permissions array
  aud?: string;          // audience (e.g., "authenticated", "supabase")
  iss?: string;          // issuer (Supabase URL)
}
```

**Validation Flow:**
1. Uses Supabase JWKS endpoint: `{SUPABASE_URL}/auth/v1/jwks`
2. Verifies signature, expiration, issuer, audience
3. Uses `jose.jwtVerify()` with remote JWKSet
4. Cached JWKSet with 1-minute cooldown

**Key Functions:**
- `validateJwt(authHeader)` - Full JWT validation
- `decodeJwt(token)` - Debug decode without verification
- `extractUserIdFromJwt(authHeader)` - Extract user_id

### 1.2 RaaS Gateway JWT (Tenant Isolation)

**Files:** `src/lib/raas-gateway-enhanced.ts`, `src/middleware/tenant-isolation.ts`

The RaaS Gateway uses a separate JWT for agency/tenant isolation:

```typescript
// Expected claims in RaaS Gateway JWT
{
  agency_id: string;  // Tenant identifier for multi-tenant isolation
  // Possibly signed with RAAS_JWT_SECRET
}
```

**Verification:**
```typescript
const verified = await jwtVerify(token, secret);
const agencyId = verified.payload.agency_id as string;
```

---

## 2. License Management System

### 2.1 License Key Format (RaaS Service)

**File:** `src/lib/raas-service.ts`

```
Format: raas_{tier}_{timestamp}_{nonce}_{hmac}
Example: raas_premium_1735689600_a1b2c3d4e5f6_e3b0c44298fc1c149...
```

**Components:**
| Component | Description |
|-----------|-------------|
| `tier` | `basic`, `premium`, `enterprise`, `master` |
| `timestamp` | Unix timestamp for expiration (master tier = perpetual) |
| `nonce` | 32-char hex random value (replay prevention) |
| `hmac` | SHA256 signature of `tier:timestamp:nonce` |

**Validation Flow:**
1. Parse key format (regex pattern)
2. Verify HMAC signature (timing-safe)
3. Check expiration (skip for master tier)
4. Check nonce in Redis (replay attack prevention)
5. Check revocation list in Redis

### 2.2 License Tiers & Quotas

**File:** `src/lib/usage-metering/aggregator.ts`

```typescript
export const QUOTA_LIMITS: Record<string, QuotaLimit> = {
  BASIC: {
    tier: 'BASIC',
    dailyCredits: 100,
    hourlyCredits: 20,
    dailyRequests: 500,
    monthlyCredits: 2000,
  },
  PREMIUM: {
    tier: 'PREMIUM',
    dailyCredits: 500,
    hourlyCredits: 100,
    dailyRequests: 2500,
    monthlyCredits: 10000,
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    dailyCredits: 2000,
    hourlyCredits: 500,
    dailyRequests: 10000,
    monthlyCredits: 50000,
  },
  MASTER: {
    tier: 'MASTER',
    dailyCredits: 10000,
    hourlyCredits: 2000,
    dailyRequests: 50000,
    monthlyCredits: 200000,
  },
};
```

### 2.3 Database Schema

**Key Tables:**
- `raas_licenses` - License key metadata (nonce, tier, polar_customer_id, created_by)
- `raas_api_keys` - API keys (mk_ format) with permissions
- `quota_limits` - Custom per-license quota overrides
- `usage_events` - Rolling window usage tracking
- `overage_events` - Exceeded quota events for billing

---

## 3. Cloudflare Worker Context

### 3.1 Worker Configuration

**File:** `wrangler.toml`

```toml
name = "raas-gateway-worker"
main = "src/worker/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# KV Storage for quota counters
[[kv_namespaces]]
binding = "KV_KV"
id = "<KV_NAMESPACE_ID>"

# Queue for async usage event processing
[[queues.producers]]
queue = "usage-events"
binding = "USAGE_QUEUE"

[[queues.consumers]]
queue = "usage-events"
max_batch_size = 10
max_wait_ms = 5000

[vars]
ENVIRONMENT = "production"
HARD_LIMIT_PERCENT = "150"
```

### 3.2 Worker Environment Types

**File:** `worker-configuration.d.ts`

```typescript
interface Env {
  KV_KV: KVNamespace;      // Quota caching
  USAGE_QUEUE: Queue;      // Async event processing
  ENVIRONMENT: "production";
  HARD_LIMIT_PERCENT: "150";
  VERCEL_OIDC_TOKEN: string;
}
```

---

## 4. Rate Limiter Integration

### 4.1 Current Rate Limiting

**File:** `src/lib/security/rate-limiter.ts`

```typescript
export async function checkRateLimit(
  apiKeyId: string,
  limit: number = 100
): Promise<RateLimitResult> {
  const identifier = `api-key:${apiKeyId}`;
  const windowSeconds = 60; // 1 minute

  // Uses SQL-based rate limiting (Redis fallback)
  const config: RateLimitConfig = {
    maxRequests: limit,
    windowSeconds,
    identifier,
  };

  return {
    allowed: sqlResult.success,
    remaining: sqlResult.remaining,
    resetAt: sqlResult.reset,
    retryAfter: !sqlResult.success ? calculated : undefined,
  };
}
```

### 4.2 Quota Enforcement Flow

**File:** `src/lib/quota/quota-enforcer.ts`

```typescript
export async function enforceQuota(
  context: QuotaCheckContext,
  config = DEFAULT_CONFIG
): Promise<{ allowed: true; result: EnhancedQuotaCheckResult } | { allowed: false; response: QuotaExceededResponse }> {

  // 1. Check dunning state FIRST (block suspended accounts)
  const dunningCheck = await canAccessApi(licenseNonce);
  if (!dunningCheck.allowed) {
    return { allowed: false, response: createDunningBlockResponse(dunningCheck) };
  }

  // 2. Sync from Polar (source of truth)
  if (polarCustomerId) {
    await syncQuotaFromPolar(licenseNonce, polarCustomerId);
  }

  // 3. Check quota with overage handling
  const quotaResult = await checkQuotaWithOverage(context, config);

  // 4. Hard block if exceeded
  if (!quotaResult.allowed && quotaResult.exceeded) {
    return { allowed: false, response: createQuotaExceededResponse(...) };
  }

  return { allowed: true, result: quotaResult };
}
```

### 4.3 KV Caching for Quota Checks

**File:** `src/lib/quota/quota-checker.ts`

```typescript
export interface CachedQuota {
  hourly: number;
  daily: number;
  monthly: number;
  requests: number;
  timestamp?: number;
}

// Cache key format
const key = `quota:${userId}:${licenseNonce}`;

// KV client (lazy init for Cloudflare Workers)
function getKvClient() {
  if (typeof globalThis !== 'undefined' && (globalThis as any).KV_KV) {
    return (globalThis as any).KV_KV;
  }
  return null;
}
```

---

## 5. Recommended Enriched JWT Claims Schema

### 5.1 Proposed Claims Structure

For Phase 6, we recommend **embedding license metadata directly into JWT claims** to enable fast Worker enforcement without DB lookups:

```typescript
export interface EnrichedJwtPayload {
  // Standard claims
  sub: string;           // user_id
  iat: number;           // issued at
  exp: number;           // expiration

  // RaaS License claims (NEW)
  license_nonce: string;  // License identifier
  license_tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  license_issued_at: number;
  license_expires_at?: number;  // undefined for master tier

  // Quota claims (cached at issuance time)
  quota: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };

  // Tenant isolation
  agency_id?: string;    // For multi-tenant isolation

  // Polar billing
  polar_customer_id?: string;
  polar_subscription_status?: 'active' | 'inactive' | 'past_due';

  // Dunning state (cached)
  dunning_state?: 'ok' | ' grace_period' | 'suspended' | 'delinquent';
}
```

### 5.2 JWT Issuance Flow

```typescript
// When user authenticates (login or API key exchange)
async function issueEnrichedJwt(
  userId: string,
  licenseNonce: string
): Promise<string> {
  // 1. Fetch license + quota + polar status from DB
  const license = await fetchLicenseWithMetadata(licenseNonce);

  // 2. Build enriched claims
  const claims: EnrichedJwtPayload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    license_nonce: license.nonce,
    license_tier: license.tier,
    license_issued_at: license.created_at,
    license_expires_at: license.expires_at,
    quota: {
      dailyCredits: license.quota.dailyCredits,
      hourlyCredits: license.quota.hourlyCredits,
      monthlyCredits: license.quota.monthlyCredits,
      dailyRequests: license.quota.dailyRequests,
    },
    polar_customer_id: license.polar_customer_id,
    polar_subscription_status: license.polar_status,
    agency_id: license.agency_id,
  };

  // 3. Sign JWT
  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret);

  return jwt;
}
```

---

## 6. Integration Points with Rate Limiting

### 6.1 Cloudflare Worker Enforcement

```typescript
// Worker middleware (src/worker/index.ts)
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // 1. Extract JWT from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 2. Verify JWT (fast - no DB lookup)
    const claims = await verifyEnrichedJwt(token, env.JWT_SECRET);
    if (!claims) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 3. Check quota from cached KV
    const cachedQuota = await env.KV_KV.get(`quota:${claims.sub}:${claims.license_nonce}`);

    // 4. Enforce rate limit
    const rateLimitKey = `rate:${claims.license_nonce}:${Math.floor(Date.now() / 60000)}`;
    const currentCount = await env.KV_KV.get(rateLimitKey) || 0;

    if (currentCount >= claims.quota.hourlyCredits) {
      return new Response('Rate limited', {
        status: 429,
        headers: { 'Retry-After': '60' }
      });
    }

    // 5. Increment counter
    await env.KV_KV.set(rateLimitKey, currentCount + 1, { expirationTtl: 3600 });

    // 6. Queue usage event for async processing
    await env.USAGE_QUEUE.send({
      userId: claims.sub,
      licenseNonce: claims.license_nonce,
      tier: claims.license_tier,
      timestamp: Date.now(),
    });

    // 7. Proceed to handler
    return handleRequest(request, claims);
  },
};
```

### 6.2 Token Refresh Strategy

Since enriched JWTs contain cached quota data, implement a **refresh strategy**:

```typescript
// Refresh token when:
// 1. JWT expires (1 hour TTL recommended)
// 2. Quota cache invalidated (after usage event)
// 3. Polar webhook updates subscription status

// Option A: Short-lived JWT (1 hour) + refresh on expiry
// Option B: Include quota_version claim, invalidate on quota change
```

---

## 7. Implementation Recommendations

### 7.1 Phase 6A: JWT Claims Schema (Week 1)

```typescript
// New file: src/lib/auth/enriched-jwt.ts
import { SignJWT, jwtVerify } from 'jose';

export interface EnrichedJwtPayload {
  sub: string;
  iat: number;
  exp: number;
  license_nonce: string;
  license_tier: string;
  quota: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };
  polar_customer_id?: string;
  agency_id?: string;
}

export async function createEnrichedJwt(
  payload: Omit<EnrichedJwtPayload, 'iat' | 'exp'>,
  ttlSeconds: number = 3600
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT(payload as EnrichedJwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

export async function verifyEnrichedJwt(
  token: string
): Promise<EnrichedJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    return payload as EnrichedJwtPayload;
  } catch {
    return null;
  }
}
```

### 7.2 Phase 6B: Worker Integration (Week 2)

```typescript
// Update: src/worker/index.ts
import { verifyEnrichedJwt } from '../lib/auth/enriched-jwt';

async function enforceRateLimit(
  claims: EnrichedJwtPayload,
  env: Env
): Promise<{ allowed: boolean; response?: Response }> {
  const minuteWindow = Math.floor(Date.now() / 60000);
  const key = `rate:${claims.license_nonce}:${minuteWindow}`;

  const current = await env.KV_KV.get<number>(key) || 0;
  const limit = claims.quota.hourlyCredits;

  if (current >= limit) {
    return {
      allowed: false,
      response: new Response('Rate limited', {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        },
      }),
    };
  }

  await env.KV_KV.set(key, current + 1, { expirationTtl: 3600 });

  return { allowed: true };
}
```

### 7.3 Phase 6C: Token Issuance on Auth (Week 2)

Update login flow and API key exchange to issue enriched JWTs:

```typescript
// Update: src/app/api/auth/token/route.ts
import { createEnrichedJwt } from '@/lib/auth/enriched-jwt';
import { getEffectiveQuotaLimits } from '@/lib/quota/quota-checker';

export async function POST(req: Request) {
  const { userId, licenseNonce } = await req.json();

  // Fetch license metadata
  const license = await fetchLicense(licenseNonce);
  const quota = await getEffectiveQuotaLimits(licenseNonce, license.tier);

  // Issue enriched JWT
  const token = await createEnrichedJwt({
    sub: userId,
    license_nonce: licenseNonce,
    license_tier: license.tier,
    quota,
    polar_customer_id: license.polar_customer_id,
    agency_id: license.agency_id,
  });

  return Response.json({ token, expires_in: 3600 });
}
```

---

## 8. Security Considerations

### 8.1 JWT Secret Management

```bash
# Environment variables required
JWT_SECRET=<strong-random-secret-min-32-bytes>
RAAS_JWT_SECRET=<separate-secret-for-raas-gateway-jwt>
```

### 8.2 Claims Integrity

- **Never trust client-provided claims** - always verify signature
- **Short TTL** (1 hour) to limit exposure from token theft
- **Include `iat` claim** to detect token age
- **Refresh on quota change** - invalidate when user upgrades tier

### 8.3 Replay Attack Prevention

```typescript
// Add jti (JWT ID) claim for one-time use tokens
const token = await new SignJWT({
  ...claims,
  jti: crypto.randomUUID(), // Unique per issuance
})
```

---

## 9. Open Questions

1. **Should we maintain dual JWT support?** (Supabase JWT for user auth + RaaS JWT for license) Or consolidate into single enriched JWT?

2. **What's the optimal JWT TTL?** 1 hour balances security vs. performance, but may cause latency for long sessions.

3. **How to handle quota cache invalidation?** Should we use a `quota_version` claim and increment on usage events?

4. **Should the Worker enforce hard blocks or soft warnings?** Current system uses `failClosed` config - should this continue?

---

## 10. Files Referenced

| File | Purpose |
|------|---------|
| `src/lib/security/jwt-validator.ts` | Supabase JWT validation |
| `src/lib/security/api-key-validator.ts` | mk_ API key management |
| `src/lib/raas-service.ts` | License key HMAC validation |
| `src/lib/raas-gate.ts` | RaaS gate middleware |
| `src/lib/raas-gateway-enhanced.ts` | Agency ID validation |
| `src/lib/quota/quota-checker.ts` | Quota caching & checking |
| `src/lib/quota/quota-enforcer.ts` | Hard quota enforcement |
| `src/lib/security/rate-limiter.ts` | SQL-based rate limiting |
| `src/lib/usage-metering/aggregator.ts` | QUOTA_LIMITS definition |
| `src/lib/usage-metering/types.ts` | Usage tracking types |
| `src/middleware/tenant-isolation.ts` | Tenant access control |
| `wrangler.toml` | Worker configuration |
| `worker-configuration.d.ts` | Worker environment types |

---

**Next Step:** Delegate to `planner` agent to create implementation plan for Phase 6 JWT Claims Enrichment based on these recommendations.
