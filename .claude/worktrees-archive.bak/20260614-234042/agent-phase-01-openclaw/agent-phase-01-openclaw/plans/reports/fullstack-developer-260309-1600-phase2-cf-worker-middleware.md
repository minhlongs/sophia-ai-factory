# Phase 2: Cloudflare Worker RaaS Middleware Implementation

**Date:** 2026-03-09
**Status:** ✅ Completed
**Files Modified:** 5 new files + 1 updated worker index

---

## Summary

Implemented Cloudflare Worker middleware for RaaS license validation and feature-level access control. The middleware provides:

1. **Dual authentication** - Supports both `mk_` API keys and JWT tokens
2. **Feature-level access control** - Maps endpoints to feature entitlements
3. **Polar subscription integration** - Validates subscription status at the edge
4. **KV caching** - Caches license validation (5 min), subscription status (10 min), and entitlements (15 min)

---

## Files Created

### 1. `src/worker/middleware/raas-auth-middleware.ts` (288 lines)

Core authentication middleware with:
- `extractApiKey()` - Extract `mk_` API keys from `X-API-Key` header
- `extractJwt()` - Extract JWT from `Authorization: Bearer` header
- `validateLicense()` - Validate license and return auth context
- `checkFeatureAccess()` - Check if feature is entitled for user
- `createFeatureGuard()` - Create feature-gated middleware wrapper

**Auth Context returned:**
```typescript
interface AuthContext {
  userId: string;
  licenseNonce: string;
  tier: string;
  featureEntitlements: string[];
  agencyId?: string;
  polarSubscriptionStatus?: string;
  isPaid?: boolean;
}
```

### 2. `src/worker/middleware/feature-entitlement.ts` (385 lines)

Feature entitlement service with:
- `ENDPOINT_FEATURE_MAP` - 40+ endpoint-to-feature mappings
- `TIER_DEFAULT_FEATURES` - Default features for BASIC/PREMIUM/ENTERPRISE/MASTER tiers
- `getRequiredFeature()` - Get required feature for endpoint path
- `validateFeatureAccess()` - Validate feature against entitlements
- `isTierEligibleForOverage()` - Check overage billing eligibility

**Endpoint patterns:**
- `/api/heygen/*` → `heygen.createVideo`
- `/api/elevenlabs/*` → `elevenlabs.synthesize`
- `/api/openrouter/*` → `openrouter.chat`
- `/api/admin/*` → `admin.dashboard`
- `/api/analytics/*` → `analytics.basic` or `analytics.advanced`

### 3. `src/worker/middleware/polar-subscription.ts` (330 lines)

Polar subscription status service with:
- `getSubscriptionStatus()` - Fetch from KV cache
- `cacheSubscriptionStatus()` - Cache with TTL
- `getSubscriptionStatusWithFallback()` - Fetch from Polar API if cache miss
- `checkSubscriptionAccess()` - Build access decision
- `getDaysUntilRenewal()` - Calculate renewal countdown
- `isSubscriptionExpiringSoon()` - Check if expiring within threshold

### 4. `src/worker/middleware/index.ts` (40 lines)

Barrel exports for all middleware functions and types.

### 5. `src/worker/middleware/raas-middleware.test.ts` (420 lines)

45 comprehensive tests covering:
- API key extraction
- JWT extraction
- Feature access control
- Endpoint feature mapping
- Tier eligibility
- Polar subscription status checks

### 6. Updated `src/worker/index.ts`

Integrated middleware into proxy handler:
```typescript
async function handleProxyRequest(request, env, ctx) {
  // Step 1: RaaS Authentication
  const authResponse = await raasAuthMiddleware(request, env, ctx);
  if (authResponse) return authResponse;

  // Step 2: Get required feature for endpoint
  const requiredFeature = getRequiredFeature(`/api/proxy/${service}`);

  // Step 3: Check feature access
  const featureResult = await checkFeatureAccess(requiredFeature, authContext);
  if (!featureResult.allowed) return 403;

  // Step 4: Check Polar subscription status
  const subscription = await getSubscriptionStatus(...);
  if (subscription.status === 'canceled') return 403;

  // Step 5: Quota enforcement with overage
  // ... existing quota logic
}
```

---

## License Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Request arrives at Cloudflare Worker                     │
│    Headers: X-API-Key: mk_... OR Authorization: Bearer ...  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. raasAuthMiddleware() extracts credentials                │
│    - API key path: validateApiKey() → database lookup       │
│    - JWT path: validateJwt() → JWKS verification            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Fetch license context from KV cache                      │
│    Key: license:{licenseNonce}                              │
│    TTL: 5 minutes                                           │
│    Contains: tier, agencyId, featureEntitlements            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Check Polar subscription status (if available)           │
│    Key: polar:subscription:{customerId}                     │
│    TTL: 10 minutes                                          │
│    Returns: status, tier, features                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Feature access control                                   │
│    getRequiredFeature(pathname) → featureKey                │
│    checkFeatureAccess(featureKey, entitlements)             │
│    Returns: 403 if not entitled                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Quota enforcement (existing logic)                       │
│    getCurrentUsage() → calculateOverage()                   │
│    Returns: 429 if over hard limit                          │
└─────────────────────────────────────────────────────────────┘
```

---

## KV Cache Strategy

| Data Type | TTL | Key Pattern | Purpose |
|-----------|-----|-------------|---------|
| License validation | 5 min | `license:{nonce}` | Fast tier/entitlement lookup |
| Subscription status | 10 min | `polar:subscription:{customerId}` | Avoid Polar API calls |
| Feature entitlements | 15 min | `entitlements:{userId}` | Cache merged entitlements |

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication required: provide X-API-Key or Authorization header",
  "timestamp": "2026-03-09T16:30:00.000Z"
}
```

### 403 Forbidden (Feature access denied)
```json
{
  "error": "Feature access denied: not_entitled",
  "feature": "admin.dashboard",
  "tier": "BASIC"
}
```

### 403 Forbidden (Subscription inactive)
```json
{
  "error": "Subscription inactive",
  "status": "canceled",
  "message": "Please renew your subscription to continue using this service"
}
```

### 429 Too Many Requests
```json
{
  "error": "Quota exceeded",
  "message": "You have exceeded your BASIC tier quota. Please upgrade to continue.",
  "remaining": 0,
  "limit": 100
}
```

---

## Tests Status

- **Type check:** ✅ Pass (0 errors)
- **Unit tests:** ✅ Pass (45/45 tests)
  - RaaS Auth Middleware: 9 tests
  - Feature Entitlement: 17 tests
  - Polar Subscription: 19 tests

---

## Integration Points

### Environment Variables Required
```env
# Polar API (optional, for real-time subscription status)
POLAR_API_KEY=sk_...
POLAR_API_URL=https://api.polar.sh

# KV Namespace (already configured)
KV_KV=<kv-namespace-id>
```

### Worker Configuration (`wrangler.toml`)
```toml
[[kv_namespaces]]
binding = "KV_KV"
id = "xxxx"
```

---

## Next Steps

1. **Deploy Worker** - Push to Cloudflare Workers
2. **Test with real API keys** - Validate against production RaaS Gateway
3. **Monitor KV cache hit rate** - Ensure caching is effective
4. **Set up Polar webhook** - Invalidate cache on subscription changes

---

## Unresolved Questions

None. Implementation complete as specified.
