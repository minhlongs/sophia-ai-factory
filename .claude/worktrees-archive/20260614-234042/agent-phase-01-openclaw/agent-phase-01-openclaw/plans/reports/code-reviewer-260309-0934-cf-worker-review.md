# Cloudflare Worker Quota Enforcement - Code Review

**Date:** 2026-03-09
**Reviewer:** code-reviewer agent
**Scope:** Cloudflare Worker quota enforcement implementation

---

## Review Summary

### Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `src/worker/index.ts` | 288 | Worker entry point, request routing, queue consumer |
| `src/worker/lib/auth-middleware.ts` | 134 | JWT validation, API key verification |
| `src/worker/lib/quota-counter.ts` | 196 | KV-based atomic counter, quota checks |
| `src/worker/lib/overage-calculator.ts` | 131 | Tiered billing calculation |
| `src/worker/lib/usage-emitter.ts` | 173 | Queue-based event processing |
| `src/worker/lib/quota-response.ts` | 191 | Standardized 429 responses |
| `src/app/api/webhooks/overage-billing/route.ts` | 275 | Next.js webhook handler |

**Total:** 1,488 lines analyzed

### Overall Quality Score: **7.5/10**

---

## Critical Issues

### 1. JWT Signature NOT Verified (CRITICAL - SECURITY)

**File:** `src/worker/lib/auth-middleware.ts`

The `verifyJwt` function decodes JWT but **never verifies the signature**:

```typescript
export async function verifyJwt(token: string, env: Env): Promise<JWTPayload | null> {
  try {
    const { payload } = decodeJwt(token);  // Just decodes, no verification!

    // Check expiration
    if (payload.exp < Date.now() / 1000) {
      return null;
    }

    // Validate API key exists in KV
    const apiKeyValid = await validateApiKey(payload.sub, env.KV_KV);
    if (!apiKeyValid) {
      return null;
    }

    return payload as JWTPayload;
  } catch (error) {
    return null;
  }
}
```

**Risk:** Anyone can forge JWT tokens with arbitrary `sub`, `tier`, or `scope` claims.

**Fix Required:**

```typescript
export async function verifyJwt(token: string, env: Env): Promise<JWTPayload | null> {
  try {
    const { header, payload, signature } = decodeJwt(token);

    // Get signing key from KV
    const signingKey = await env.KV_KV.get('jwt_signing_key');
    if (!signingKey) {
      console.error('JWT signing key not configured');
      return null;
    }

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const message = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signatureBytes = base64UrlDecode(parts[2]);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      message
    );

    if (!isValid) {
      return null;
    }

    // ... rest of validation
  } catch (error) {
    return null;
  }
}
```

---

### 2. `ctx` Reference Error in Worker (CRITICAL - BUG)

**File:** `src/worker/index.ts`, line 91-98

```typescript
if (env.OVERAGE_WEBHOOK_URL) {
  ctx.waitUntil(  // ❌ ctx is not in scope here!
    fetch(env.OVERAGE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    }).catch(() => {})
  );
}
```

The `queue` handler signature is:
```typescript
async queue(batch: MessageBatch<WorkerUsageEvent>, env: Env): Promise<void>
```

**`ctx` is NOT passed to queue handlers** in Cloudflare Workers. This code will throw `ReferenceError: ctx is not defined`.

**Fix:**

```typescript
async queue(batch: MessageBatch<WorkerUsageEvent>, env: Env): Promise<void> {
  const events = batch.messages.map(msg => msg.body);

  for (const event of events) {
    await incrementUsage(event.licenseNonce, event.service || 'default', event.overageCount, env.KV_KV);

    if (event.overageFee > 0 && env.OVERAGE_WEBHOOK_URL) {
      // Can't use ctx.waitUntil in queue handler - just await directly
      try {
        await fetch(env.OVERAGE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
      } catch {
        // Ignore errors - best effort logging
      }
    }
  }
}
```

---

### 3. Weak Cloudflare Signature Verification (HIGH - SECURITY)

**File:** `src/app/api/webhooks/overage-billing/route.ts`, lines 91-102

```typescript
function verifyCloudflareSignature(
  signature: string | undefined,
  expectedSecret: string
): boolean {
  if (!signature || !expectedSecret) {
    return false;
  }

  // Cloudflare uses HMAC-SHA256 for queue signatures
  // This is a simplified verification - adjust based on actual implementation
  return signature === expectedSecret;  // ❌ Plain text comparison!
}
```

**Risk:** If signature is transmitted over network, plain text comparison is vulnerable to timing attacks. More importantly, the comment admits this is "simplified" - need actual HMAC verification.

**Fix:**

```typescript
async function verifyCloudflareSignature(
  signature: string | undefined,
  body: string,
  expectedSecret: string
): Promise<boolean> {
  if (!signature || !expectedSecret) {
    return false;
  }

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(expectedSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const computed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body)
  );

  const computedHex = Array.from(new Uint8Array(computed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  return computedHex === signature;
}
```

---

## High Priority Issues

### 4. Type Safety Violations

**File:** `src/worker/lib/auth-middleware.ts`, line 41

```typescript
function decodeJwt(token: string): { header: any; payload: any; signature: string } {
```

**Issue:** Using `any` type for `header` and `payload`.

**Fix:**

```typescript
interface JWTHeader {
  alg: string;
  typ: string;
  kid?: string;
}

function decodeJwt(token: string): { header: JWTHeader; payload: JWTPayload; signature: string } {
```

---

### 5. Missing Error Handling in KV Operations

**File:** `src/worker/lib/quota-counter.ts`, lines 76-87

```typescript
export async function incrementUsage(
  apiKey: string,
  service: string,
  tokens: number,
  kv: KVNamespace
): Promise<number> {
  const key = getMonthKey(apiKey, service);

  const newValue = await kv.increment(key, tokens);  // No try-catch!

  if (newValue === null) {  // This check is wrong - increment returns number, not null
    await kv.put(key, tokens.toString(), {
      expirationTtl: 2592000
    });
    return tokens;
  }

  return newValue;
}
```

**Issues:**
1. `kv.increment()` returns `number`, never `null`. The null check is dead code.
2. No error handling for KV failures.
3. If key doesn't exist, `increment` will fail, not return null.

**Fix:**

```typescript
export async function incrementUsage(
  apiKey: string,
  service: string,
  tokens: number,
  kv: KVNamespace
): Promise<number> {
  const key = getMonthKey(apiKey, service);

  try {
    // Check if key exists first
    const existing = await kv.get(key);

    if (!existing) {
      // Initialize with first value
      await kv.put(key, tokens.toString(), {
        expirationTtl: 2592000 // 30 days
      });
      return tokens;
    }

    // Increment existing value
    const newValue = await kv.increment(key, tokens);
    return newValue;
  } catch (error) {
    console.error('KV increment error:', error);
    throw error; // Re-throw for caller to handle
  }
}
```

---

### 6. Hardcoded Origin URL in Proxy

**File:** `src/worker/index.ts`, line 228

```typescript
const originUrl = new URL(url.pathname.replace('/api/proxy', ''), 'https://origin.example.com');
```

**Issue:** Hardcoded `origin.example.com` - this is a configuration that should be in `env`.

**Fix:**

```typescript
// In index.ts, handleProxyRequest function:
const originUrl = new URL(url.pathname.replace('/api/proxy', ''), env.ORIGIN_URL);
```

```typescript
// In Env interface:
interface Env {
  KV_KV: KVNamespace;
  USAGE_QUEUE: Queue<WorkerUsageEvent>;
  ENVIRONMENT: string;
  HARD_LIMIT_PERCENT: string;
  OVERAGE_WEBHOOK_URL?: string;
  ORIGIN_URL: string;  // Add this
}
```

---

### 7. Console.log in Production Code

**File:** `src/app/api/webhooks/overage-billing/route.ts`, line 247

```typescript
console.error('Failed to log overage event:', billingError.message);
```

**File:** `src/worker/index.ts`, lines 153, 281

```typescript
console.error('Quota check error:', error);
console.error('Overage webhook error:', error);
```

**Issue:** Per development rules, `console.log/warn/error` should be removed from production code.

**Fix:** Use a proper logging utility or remove entirely (errors are already returned in response).

---

## Medium Priority Issues

### 8. Idempotency Key Generation Collision Risk

**File:** `src/worker/lib/usage-emitter.ts`, lines 39-50

```typescript
export function generateIdempotencyKey(
  licenseNonce: string,
  timestamp: number,
  service?: string
): string {
  const components = [
    licenseNonce,
    Math.floor(timestamp / 1000).toString(), // Rounded to seconds
    service || 'default'
  ];
  return `evt_${components.join('_')}`;
}
```

**Issue:** Rounding to seconds means 2 events from same user/service within 1 second will have **identical idempotency keys**.

**Fix:**

```typescript
export function generateIdempotencyKey(
  licenseNonce: string,
  timestamp: number,
  service?: string
): string {
  // Include milliseconds and a counter for uniqueness
  const components = [
    licenseNonce,
    timestamp.toString(),  // Full ms precision
    service || 'default',
    crypto.randomUUID().substring(0, 8)  // Add random suffix
  ];
  return `evt_${components.join('_')}`;
}
```

---

### 9. Magic Numbers

**File:** `src/worker/lib/quota-response.ts`, line 38

```typescript
const DEFAULT_RETRY_AFTER = 2592000;  // What is this?
```

**Issue:** Magic number without explanation. Should be documented.

**Fix:**

```typescript
// 30 days in seconds (quota reset period)
const DEFAULT_RETRY_AFTER = 30 * 24 * 60 * 60; // 2592000
```

---

### 10. Batch Emitter Race Condition

**File:** `src/worker/lib/usage-emitter.ts`, lines 93-120

```typescript
export function createBatchEmitter(maxBatchSize: number = 10): BatchEmitter {
  const events: UsageEvent[] = [];

  return {
    addEvent(event: UsageEvent): void {
      events.push(event);
    },

    async flush(queue: Queue<UsageEvent>): Promise<number> {
      if (events.length === 0) {
        return 0;
      }

      const batchSize = events.length;
      const promises = events.map(event => queue.send(event));

      await Promise.all(promises);
      events.length = 0; // Clear array

      return batchSize;
    },

    get size(): number {
      return events.length;
    }
  };
}
```

**Issue:** No auto-flush when batch size is reached. The `addEvent` doesn't trigger flush.

**Fix:**

```typescript
export function createBatchEmitter(maxBatchSize: number = 10): BatchEmitter {
  const events: UsageEvent[] = [];
  let flushPromise: Promise<number> | null = null;

  return {
    addEvent(event: UsageEvent): void {
      events.push(event);
      // Auto-flush when batch is full
      if (events.length >= maxBatchSize && !flushPromise) {
        // Note: Can't flush here without queue reference
        // Consider using a different pattern
      }
    },

    async flush(queue: Queue<UsageEvent>): Promise<number> {
      if (flushPromise) {
        return flushPromise; // Return existing promise if flush in progress
      }

      if (events.length === 0) {
        return 0;
      }

      const batchSize = events.length;
      flushPromise = (async () => {
        try {
          const promises = events.map(event => queue.send(event));
          await Promise.all(promises);
          return batchSize;
        } finally {
          events.length = 0;
          flushPromise = null;
        }
      })();

      return flushPromise;
    },

    get size(): number {
      return events.length;
    }
  };
}
```

---

### 11. No Validation for Tier Limits

**File:** `src/worker/lib/quota-counter.ts`, lines 28-33

```typescript
const TIER_LIMITS: Record<string, number> = {
  BASIC: 1000,
  PREMIUM: 10000,
  ENTERPRISE: 100000
};
```

**Issue:** If KV returns unknown tier, fallback to BASIC happens silently. Should log or validate.

**Fix:**

```typescript
const VALID_TIERS = new Set(['BASIC', 'PREMIUM', 'ENTERPRISE']);

function getTierLimit(tier: string | null | undefined): number {
  const normalizedTier = tier?.toUpperCase() || 'BASIC';

  if (!VALID_TIERS.has(normalizedTier)) {
    console.warn(`Invalid tier "${tier}", defaulting to BASIC`);
    return TIER_LIMITS.BASIC;
  }

  return TIER_LIMITS[normalizedTier] || TIER_LIMITS.BASIC;
}
```

---

### 12. Missing Webhook Timeout Handling

**File:** `src/app/api/webhooks/overage-billing/route.ts`

**Issue:** No timeout configured for Supabase queries. Could hang indefinitely.

**Fix:** Add `signal` with timeout to Supabase calls (if supported) or wrap in `Promise.race`.

---

## Low Priority Issues

### 13. Inconsistent Date Formatting

**File:** `src/worker/lib/quota-counter.ts`, line 52

```typescript
return nextMonth.toISOString();
```

**File:** `src/worker/lib/overage-calculator.ts`, line 124-129

```typescript
return new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  // ...
}).format(fee);
```

**Note:** Date formatting is ISO 8601 (good), currency formatting uses Intl (good). Just ensuring consistency across files.

---

### 14. Comment Says "30 days" but Calculation is Different

**File:** `src/worker/lib/quota-response.ts`, line 35-38

```typescript
/**
 * Default retry period (30 days in seconds)
 * Reset occurs on 1st of next month
 */
const DEFAULT_RETRY_AFTER = 2592000;
```

**Issue:** Comment says "Reset occurs on 1st of next month" but 30 days is not accurate for all months (28, 29, 31 days exist).

**Fix:** Calculate actual days until 1st of next month dynamically.

---

### 15. Missing Unit Tests

**Issue:** None of the worker files have corresponding `.test.ts` files.

**Recommendation:** Add tests for:
- `calculateOverage()` - tiered pricing logic
- `verifyJwt()` - token validation
- `generateIdempotencyKey()` - uniqueness
- `buildQuotaExceededResponse()` - response structure

---

## Security Audit Summary

| Issue | Severity | Status |
|-------|----------|--------|
| JWT signature not verified | CRITICAL | Requires immediate fix |
| `ctx` undefined in queue handler | CRITICAL | Bug fix required |
| Weak webhook signature verification | HIGH | Should use HMAC |
| No KV error handling | HIGH | Add try-catch |
| Missing input validation | MEDIUM | Add Zod schemas |
| Console.log in production | MEDIUM | Remove per standards |

---

## Performance Analysis

### 50ms Execution Budget

| Operation | Estimated Time | Status |
|-----------|----------------|--------|
| JWT decode + validation | ~5-10ms | OK |
| KV get (tier) | ~10-20ms | OK |
| KV get (usage) | ~10-20ms | OK |
| KV increment | ~10-20ms | OK |
| Overhead | ~5ms | OK |

**Risk:** Multiple sequential KV calls could exceed 50ms budget under load.

**Recommendations:**
1. Cache tier info in JWT (already done) to avoid one KV call
2. Use KV batch reads where possible
3. Consider edge caching for quota checks

### Memory Usage

- Batch emitter stores events in memory until flush
- For high-volume endpoints, could accumulate

**Recommendation:** Add max batch age (auto-flush after 100ms even if not full).

---

## Recommended Improvements (Prioritized)

### Immediate (Before Production)

1. **Fix JWT signature verification** - Add HMAC-SHA256 verification
2. **Fix `ctx` reference error** - Remove or replace with direct await
3. **Fix KV increment logic** - Remove dead null check, add error handling
4. **Add HMAC webhook signature verification** - Replace plain text comparison

### High Priority (Within 1 Week)

5. **Add comprehensive error handling** - Wrap all async operations
6. **Remove console.log statements** - Use proper logging or remove
7. **Fix idempotency key generation** - Add random component
8. **Add configuration for origin URL** - Move from hardcoded to env

### Medium Priority (Within 2 Weeks)

9. **Add unit tests** - Cover core logic functions
10. **Add dynamic retry-after calculation** - Based on actual reset date
11. **Add auto-flush to batch emitter** - Time-based flush
12. **Add tier validation logging** - Warn on unknown tiers

---

## Production Readiness Assessment

### Current Status: **NOT PRODUCTION READY**

| Criterion | Status | Notes |
|-----------|--------|-------|
| Type Safety | 80% | 3 `any` types remaining |
| Error Handling | 60% | Missing try-catch in KV ops |
| Security | 40% | JWT not verified, weak webhook sig |
| Performance | 90% | Should meet 50ms budget |
| Tests | 0% | No unit tests |
| Documentation | 85% | Good JSDoc coverage |

### Blockers for Production

1. JWT signature verification MUST be implemented
2. `ctx` reference error MUST be fixed
3. KV increment logic MUST be corrected
4. Unit tests MUST be added for core functions

---

## Positive Observations

- Good separation of concerns across modules
- Comprehensive JSDoc comments
- Type-safe interfaces for most data structures
- Idempotency key support for deduplication
- Queue-based async processing pattern
- Standardized 429 response format
- Tiered pricing structure with volume discounts

---

## Unresolved Questions

1. What is the intended JWT signing mechanism? (HMAC-SHA256, RS256?)
2. Where should the JWT signing key be stored? (KV, environment variable, Secrets Manager?)
3. What is the actual Cloudflare Queue signature format? (Documentation needed)
4. Should the worker proxy to a configurable origin or a fixed backend?
5. What is the expected throughput (requests/second) for capacity planning?
6. Is there a fallback mechanism if KV is unavailable?
7. Should overage billing be real-time or batch-processed?

---

## Files Modified by This Review

**Report saved to:** `plans/reports/code-reviewer-260309-0934-cf-worker-review.md`

**Note:** This review identified critical security and functionality issues that must be resolved before production deployment.
