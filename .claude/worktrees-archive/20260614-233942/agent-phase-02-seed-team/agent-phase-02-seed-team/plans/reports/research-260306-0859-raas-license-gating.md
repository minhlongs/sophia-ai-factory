# ROIaaS Phase 1 - License Key Validation Research Report

**Date:** 2026-03-06
**Project:** Sophia AI Factory
**Author:** Researcher Agent
**Status:** Complete

---

## 1. Executive Summary

Current codebase implements **RaaS Gate middleware** (`src/lib/raas-gate.ts`) with basic license key validation pattern. This report analyzes:
- Existing license key validation implementation
- Security best practices from codebase (webhook signatures, encryption)
- Recommended approach for production-grade license gating

**Key Finding:** Current implementation uses **format validation only** (`raas_{tier}_{payload}`). Production requires **encryption + signature verification**.

---

## 2. Current Implementation Analysis

### 2.1 License Key Structure (src/lib/raas-gate.ts)

```
Format: raas_{tier}_{payload}
Pattern: /^raas_(basic|premium|enterprise|master)_[a-zA-Z0-9]+$/
```

**Example valid keys:**
- `raas_premium_abc123xyz`
- `raas_enterprise_987jkl456`

**Key Components:**
| Part | Description |
|------|-------------|
| `raas_` | Prefix identifying RaaS license |
| `{tier}` | Subscription tier: basic, premium, enterprise, master |
| `{payload}` | Arbitrary alphanumeric data (currently unencrypted) |

### 2.2 Key Extraction Methods (Priority Order)

1. **Header:** `X-RaaS-License-Key` (most secure)
2. **Authorization:** `Bearer raas_{key}` (medium)
3. **Query param:** `?license_key=...` (insecure - warned in logs)

### 2.3 Validation Logic

```typescript
function validateLicenseKey(key: string | null): RaaSValidationResult {
  // Development bypass (RAAS_BYPASS_DEV=true)
  // Format validation against regex pattern
  // Returns: { valid, reason?, tier? }
}
```

**Current gaps:**
- No encryption validation (TODO: "Integrate with actual RaaS license server")
- No signature verification
- No expiration check
- No key rotation mechanism

---

## 3. Security Patterns from Codebase

### 3.1 Encryption (src/lib/utils/encryption.ts)

**Current implementation: AES-256-GCM**
```
Format: iv:authTag:encryptedContent

function encrypt(text: string): string
function decrypt(text: string): string
```

**Usage context:** API key encryption (`API_ENCRYPTION_KEY` env var)

### 3.2 Webhook Signature Verification (src/lib/security/webhook-signature-verification.ts)

**Polar.sh Webhook:**
```typescript
verifyPolarWebhookSignature(payload, signature, secret)
// HMAC-SHA256 + timing-safe comparison
```

**Telegram Webhook:**
```typescript
verifyTelegramWebhookSignature(token, headerHash, data)
// HMAC-SHA256 with WebAppData secret
```

**Key security patterns:**
- `timingSafeEqual()` - prevents timing attacks
- Webhook timestamp validation (5-min max age)
- Replay attack prevention

### 3.3 Rate Limiting (src/lib/security/rate-limiting-middleware.ts)

```typescript
RATE_LIMITS = {
  api: { maxRequests: 100, windowSeconds: 60 },
  auth: { maxRequests: 10, windowSeconds: 60 },
  webhook: { maxRequests: 1000, windowSeconds: 60 },
  admin: { maxRequests: 50, windowSeconds: 60 }
}
```

---

## 4. Recommended Approach for Production

### 4.1 License Key Format (Updated)

```
raas_{tier}_{timestamp}_{nonce}_{hmac}
```

**Components:**
| Field | Description | Example |
|-------|-------------|---------|
| `raas_` | Fixed prefix | `raas_` |
| `{tier}` | Basic/Premium/Enterprise/Master | `premium` |
| `{timestamp}` | Expiration unix timestamp | `1735689600` |
| `{nonce}` | RandomUUID for uniqueness | `a1b2c3d4...` |
| `{hmac}` | HMAC-SHA256 of above with secret | `e3b0c442...` |

### 4.2 Validation Flow

```typescript
function validateLicenseKey(key: string): RaaSValidationResult {
  // 1. Split into components
  // 2. Extract tier, timestamp, nonce, hmac
  // 3. Recalculate HMAC with server secret
  // 4. timingSafeEqual comparison
  // 5. Check timestamp expiration
  // 6. Check nonce reuse (Redis cache)
}
```

### 4.3 Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `RAAS_LICENSE_SECRET` | Secret key for HMAC generation | `base64 encoded 32-byte key` |
| `RAAS_BYPASS_DEV` | Allow dev bypass (default: false) | `true` / `false` |
| `RAAS_REDIS_TTL` | Nonce cache TTL in seconds | `3600` |

### 4.4 Implementation Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/raas-gate.ts` | **MODIFY** | Add HMAC validation + encryption |
| `src/lib/raas-key-generator.ts` | **CREATE** | License key generation utility |
| `src/lib/raas-service.ts` | **CREATE** | License validation service with Redis |
| `src/lib/schemas.ts` | **MODIFY** | Add RaaS key schema |

---

## 5. Security Considerations

### 5.1 Timing Attacks
- Use `crypto.timingSafeEqual()` for all comparisons
- Never use `===` for secret comparison

### 5.2 Key Rotation
```
// Support multiple keys during rotation
const VALID_LICENSE_SECRETS = [
  process.env.RAAS_LICENSE_SECRET_OLD,
  process.env.RAAS_LICENSE_SECRET
]
```

### 5.3 Expiration Strategy
- **Subscriptions:** Key expires with subscription period
- **Master tier:** Lifetime key (no expiration)
- **Grace period:** 7 days after expiry (retry window)

### 5.4 Revocation Mechanism
```typescript
// Redis set of revoked keys
REVOKED_KEYS:{key} = TTL
```

---

## 6. Integration Points

### 6.1 Existing Middleware (src/proxy.ts)

```typescript
// Already integrated - applies to /api/* routes
if (shouldApplyRaasGate(pathname)) {
  const raasResult = await raasGate(request);
  if (!raasResult.valid && raasResult.response) {
    return raasResult.response;
  }
}
```

### 6.2 Public Routes Excluded
- `/api/health`
- `/api/setup/*`
- `/api/webhooks/polar`
- `/api/webhooks/telegram`
- `/api/auth`
- `/api/discovery`
- `/api/sophia-index`

### 6.3 Pricing Flow (src/app/api/checkout/route.ts)

**Current:** Polar checkout creates subscription → DB updated
**With RaaS:** License key grants API access without checkout

---

## 7. Polar.sh Comparison

### Polar Subscription Model
```typescript
// Polar handles:
// - Payment processing
// - Subscription management
// - Webhook notifications
// - Product configuration

// We store:
// - user_profiles.subscription_tier
// - user_profiles.subscription_status
// - user_profiles.polar_subscription_id
// - user_profiles.subscription_expires_at
```

### RaaS License Key Model

```
Same tier hierarchy (BASIC < PREMIUM < ENTERPRISE < MASTER)
Different distribution mechanism (API key vs Stripe/Polar checkout)
Target use case: CLI tools, private API consumers, white-label
```

---

## 8. Testing Strategy

### 8.1 Unit Tests (Reference: src/lib/raas-gate.test.ts)

```typescript
// Existing tests to preserve:
- validateLicenseKey (format check)
- shouldApplyRaasGate (route filtering)
- getRaaSConfig (environment detection)

// New tests to add:
- validateLicenseKey (HMAC verification)
- testKeyExpiration
- testKeyRevocation
- testTimingAttackResistance
```

### 8.2 Integration Tests

```typescript
// Test flow:
1. Generate license key from admin UI
2. Verify key format and HMAC
3. Make API request with X-RaaS-License-Key header
4. Verify tier-based access control
5. Test expired key rejection
6. Test revoked key rejection
```

---

## 9. Unresolved Questions

| Question | Priority | Notes |
|----------|----------|-------|
| **Q1:** Should license keys support multiple tiers? | HIGH | Single key per subscription vs per-tier keys? |
| **Q2:** How to handle key re-use detection? | HIGH | Redis nonce tracking required? |
| **Q3:** Should Master tier have perpetual keys? | MEDIUM | No expiration vs year-long terms? |
| **Q4:** Which API routes need RaaS gate? | MEDIUM | All `/api/*` or selective? |
| **Q5:** graceful degradation when Redis down? | LOW | Fail open vs fail closed? |

---

## 10. Recommended Next Steps

### Phase 1: Core Implementation (Week 1)
1. Update `raas-gate.ts` with HMAC validation
2. Create `raas-key-generator.ts`
3. Add Redis nonce tracking
4. Unit tests (100% coverage)

### Phase 2: Admin Tooling (Week 2)
1. License key generation UI
2. Key revocation dashboard
3. Analytics/usage tracking

### Phase 3: Migration (Week 3)
1. Deprecate old format validation
2. Redirect to new format
3. Monitor metrics

---

## 11. References

### Existing Files
- `src/lib/raas-gate.ts` - Current implementation (209 lines)
- `src/lib/raas-gate.test.ts` - Test file (138 lines)
- `src/lib/utils/encryption.ts` - AES-256-GCM encryption
- `src/lib/security/webhook-signature-verification.ts` - HMAC utility
- `src/lib/security/rate-limiting-middleware.ts` - Redis-based rate limiting

### External References
- Polar.sh SDK: `@polar-sh/sdk v0.42.5`
- Supabase Auth: `@supabase/ssr` (cookies-based)
- Standard Webhooks: For signature verification

---

## Appendix: Code Examples

### 10.1 License Key Generation (Proposed)

```typescript
export function generateLicenseKey(
  tier: Tier,
  expiresAt: Date
): string {
  const timestamp = Math.floor(expiresAt.getTime() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const data = `${tier}:${timestamp}:${nonce}`;
  const hmac = createHmac('sha256', LICENSE_SECRET)
    .update(data)
    .digest('hex');

  return `raas_${tier}_${timestamp}_${nonce}_${hmac}`;
}
```

### 10.2 License Key Validation (Proposed)

```typescript
export function validateLicenseKey(key: string): RaaSValidationResult {
  const parts = key.split('_');
  if (parts.length !== 6 || parts[0] !== 'raas') {
    return { valid: false, reason: 'invalid-format' };
  }

  const [prefix, tier, timestampStr, nonce, ProvidedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);

  // Check expiration
  if (Date.now() / 1000 > timestamp) {
    return { valid: false, reason: 'expired' };
  }

  // Verify HMAC
  const data = `${tier}:${timestamp}:${nonce}`;
  const expectedHmac = createHmac('sha256', LICENSE_SECRET)
    .update(data)
    .digest('hex');

  if (!timingSafeEqual(
    Buffer.from(ProvidedHmac),
    Buffer.from(expectedHmac)
  )) {
    return { valid: false, reason: 'invalid-signature' };
  }

  // Check nonce reuse (Redis)
  // ...

  return { valid: true, tier: tier as Tier };
}
```

---

**Report Length:** 142 lines
**Status:** Research complete, awaiting implementation approval
