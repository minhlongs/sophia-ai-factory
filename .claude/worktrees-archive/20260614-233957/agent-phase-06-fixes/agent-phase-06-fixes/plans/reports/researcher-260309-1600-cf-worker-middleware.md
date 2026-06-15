# Cloudflare Worker Middleware Patterns for RaaS License Validation

**Date:** 2026-03-09
**Author:** Researcher Agent
**Work Context:** /Users/macbookprom1/mekong-cli/apps/sophia-ai-factory

---

## Executive Summary

Sophia AI Factory đã implement một hệ thống RaaS (Revenue-as-a-Service) Gateway hoàn chỉnh sử dụng Cloudflare Workers cho edge quota enforcement, với tích hợp Polar.sh metered billing, JWT-based license validation, và multi-tenant isolation. Hệ thống hỗ trợ 3 tier (BASIC/PREMIUM/ENTERPRISE) với overage billing tự động.

**Key Findings:**
- Worker entry point: `src/worker/index.ts` - handle proxy requests với quota enforcement
- JWT validation: HMAC-SHA256 signature verification với Web Crypto API
- KV cache: License data cached 5 phút cho fast claims enrichment
- Quota enforcement: Hard block tại 150% overage, soft warning tại 80%
- Polar integration: Usage records synced làm source of truth
- Dunning workflow: Suspended accounts blocked trước khi check quota

---

## 1. Cloudflare Worker Architecture

### 1.1 Entry Point (`src/worker/index.ts`)

**Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/quota/check` | POST | Quota status check |
| `/api/proxy/:service` | ALL | Proxy với quota enforcement |
| `/api/webhooks/overage` | POST | Next.js billing events |

**Request Flow:**
```
Client Request
    ↓
Extract Bearer Token
    ↓
verifyJwt() → Validate signature + expiration
    ↓
getCurrentUsage() → KV counter
    ↓
calculateOverage() → Check 150% hard limit
    ↓
[IF OVER HARD LIMIT] → Return 429
    ↓
[IF ALLOWED] → Forward to origin + increment usage
    ↓
Queue usage event → Async billing processing
```

**Code Pattern:**
```typescript
async function handleProxyRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.substring(7); // Remove 'Bearer '

  // Verify JWT
  const payload = await verifyJwt(token, env);
  if (!payload) {
    return json({ error: 'Invalid token' }, { status: 401 });
  }

  // Get usage & check quota
  const currentUsage = await getCurrentUsage(apiKey, service, env.KV_KV);
  const overage = calculateOverage(currentUsage, tier);

  // Hard block at 150%
  if (overage.isOverHardLimit) {
    return buildQuotaExceededResponse(overage);
  }

  // Increment usage
  const newUsage = await incrementUsage(apiKey, service, 1, env.KV_KV);

  // Queue billing event if overage
  if (updatedOverage.overageCount > 0) {
    const usageEvent = createUsageEvent(apiKey, userId, tier, newUsage, service);
    ctx.waitUntil(env.USAGE_QUEUE.send(usageEvent));
  }

  // Forward to origin
  return fetch(originUrl);
}
```

### 1.2 Worker Configuration

**wrangler.toml:**
```toml
name = "sophia-raas-gateway"
main = "src/worker/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "KV_KV"
id = "YOUR_KV_NAMESPACE_ID"

[[queues.producers]]
queue = "usage-events"
binding = "USAGE_QUEUE"

[vars]
ENVIRONMENT = "production"
HARD_LIMIT_PERCENT = "150"
```

**tsconfig.worker.json:**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021"],
    "types": ["@cloudflare/workers-types"]
  }
}
```

---

## 2. Authentication Middleware Patterns

### 2.1 JWT Validation (`src/worker/lib/auth-middleware.ts`)

**Key Features:**
- HMAC-SHA256 signature verification với Web Crypto API
- Edge-compatible (không dùng Node.js crypto)
- API key existence check trong KV
- Expiration validation

**Implementation:**
```typescript
async function verifyJwtSignature(
  token: string,
  secret: string
): Promise<boolean> {
  const parts = token.split('.');
  const [headerB64, payloadB64, signatureB64] = parts;
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // Import key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Verify signature
  const signatureBytes = base64UrlDecode(signatureB64);
  return await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes.buffer as ArrayBuffer,
    data
  );
}

export async function verifyJwt(
  token: string,
  env: Env
): Promise<JWTPayload | null> {
  // 1. Verify signature
  if (env.JWT_SECRET=REDACTED && !await verifyJwtSignature(token, env.JWT_SECRET=REDACTED)) {
    return null;
  }

  // 2. Check expiration
  const { payload } = decodeJwt(token);
  if (payload.exp < Date.now() / 1000) {
    return null;
  }

  // 3. Validate API key exists in KV
  const apiKeyValid = await validateApiKey(payload.sub, env.KV_KV);
  if (!apiKeyValid) {
    return null;
  }

  return payload;
}
```

**JWT Payload Structure:**
```typescript
interface JWTPayload {
  sub: string;          // API key ID
  iss: string;          // Issuer
  aud: string;          // Audience
  exp: number;          // Expiration
  iat: number;          // Issued at
  scope?: string;       // Permission scope
  tier?: string;        // BASIC/PREMIUM/ENTERPRISE
  agency_id?: string;   // Multi-tenant isolation
  license_nonce?: string;
  feature_entitlements?: string[];
  billing_status?: 'active' | 'past_due' | 'suspended';
}
```

### 2.2 API Key Validator (`src/lib/security/api-key-validator.ts`)

**Format:** `mk_{keyId}_{hmacSignature}`
- keyId: 16 hex chars (8 bytes)
- Signature: HMAC-SHA256 (64 hex chars)

**Validation Flow:**
```typescript
export async function validateApiKey(apiKey: string): Promise<ValidationResult> {
  // 1. Format validation
  if (!validateApiKeyFormat(apiKey)) {
    return { valid: false, error: 'invalid-format' };
  }

  // 2. Extract keyId and signature
  const { keyId, signature } = extractKeyIdAndSignature(apiKey);

  // 3. Verify signature locally (fast path)
  const expectedSignature = computeSignature(keyId);
  if (!timingSafeEqual(signature, expectedSignature)) {
    return { valid: false, error: 'invalid-format' };
  }

  // 4. Database lookup
  const { data } = await supabase
    .from('raas_api_keys')
    .select('*')
    .eq('key_id', keyId)
    .single();

  // 5. Check revoked/expired
  if (data.revoked_at || data.expires_at < now) {
    return { valid: false, error: 'revoked' | 'expired' };
  }

  // 6. Update last_used_at
  await updateLastUsed(data.id);

  return { valid: true, apiKey: data };
}
```

---

## 3. License Cache Pattern (`src/worker/lib/kv-license-cache.ts`)

**Cache Structure:**
```typescript
interface LicenseCacheData {
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  agencyId?: string;
  polarCustomerId?: string;
  polarSubscriptionStatus?: string;
  expiresAt?: number;
  createdAt: number;
  featureEntitlements: string[];
  featureLimits: Record<string, FeatureLimit>;
  dunningState: 'ok' | 'grace_period' | 'suspended' | 'delinquent';
  cachedAt: number;
}
```

**TTL:** 300 seconds (5 minutes)

**Operations:**
```typescript
const CACHE_CONFIG = {
  licenseTtlSeconds: 300,
  keyPrefix: 'license:',
};

export async function getLicenseFromCache(
  licenseNonce: string,
  kv: KVNamespace
): Promise<LicenseCacheData | null> {
  const key = `license:${licenseNonce}`;
  const cached = await kv.get<LicenseCacheData>(key);

  if (!cached) return null;

  // Defensive TTL check
  const maxAge = Date.now() - cached.cachedAt;
  if (maxAge > CACHE_CONFIG.licenseTtlSeconds * 1000) {
    await kv.delete(key);
    return null;
  }

  return cached;
}

export async function cacheLicense(
  licenseNonce: string,
  data: LicenseCacheData,
  kv: KVNamespace
): Promise<boolean> {
  const key = `license:${licenseNonce}`;
  await kv.put(key, JSON.stringify({
    ...data,
    cachedAt: Date.now()
  }), {
    expirationTtl: CACHE_CONFIG.licenseTtlSeconds
  });
  return true;
}
```

---

## 4. Quota Enforcement Patterns

### 4.1 Quota Checker (`src/lib/quota/quota-checker.ts`)

**Config:**
```typescript
interface QuotaConfig {
  softWarningThreshold: 0.8;   // 80% warning
  enableOverageBilling: false; // false = block on exceeded
  failClosed: true;            // true = block on exceeded
}
```

**Tier Defaults:**
```typescript
const QUOTA_LIMITS = {
  BASIC: {
    hourlyCredits: 100,
    dailyCredits: 1000,
    monthlyCredits: 10000,
    dailyRequests: 500
  },
  PREMIUM: { /* higher limits */ },
  ENTERPRISE: { /* highest limits */ }
};
```

**Check Flow:**
```typescript
export async function checkQuotaWithOverage(
  context: QuotaCheckContext,
  config: QuotaConfig = DEFAULT_CONFIG
): Promise<EnhancedQuotaCheckResult> {
  // 1. Get effective limits (DB override or defaults)
  const limits = await getEffectiveQuotaLimits(licenseNonce, tier);

  // 2. Try KV cache first
  let cached = await getCachedUsage(userId, licenseNonce);
  if (!cached) {
    cached = await calculateCurrentUsage(userId, licenseNonce);
    updateCachedUsage(userId, licenseNonce, cached); // fire-and-forget
  }

  // 3. Check warning thresholds (80%)
  let warningThreshold = false;
  for (const check of checks) {
    if (check.current >= check.limit * 0.8 && check.current < check.limit) {
      warningThreshold = true;
    }
  }

  // 4. Check hard limits (100%)
  for (const check of checks) {
    const usageAfter = check.current + requestedCredits;
    if (usageAfter > check.limit) {
      // Log overage event
      await logOverageEvent({ ...context, exceededType: check.type });

      // Block if fail-closed
      if (config.failClosed && !config.enableOverageBilling) {
        return { allowed: false, exceeded: { type: check.type, ... } };
      }
    }
  }

  return { allowed: true, remaining, warningThreshold };
}
```

### 4.2 Quota Enforcer (`src/lib/quota/quota-enforcer.ts`)

**Key Pattern: Dunning Check First**
```typescript
export async function enforceQuota(
  context: QuotaCheckContext
): Promise<{ allowed: true } | { allowed: false; response: QuotaExceededResponse }> {
  // 1. Check dunning state FIRST
  const dunningCheck = await canAccessApi(licenseNonce);
  if (!dunningCheck.allowed) {
    return {
      allowed: false,
      response: createDunningBlockResponse(dunningCheck)
    };
  }

  // 2. Sync from Polar (source of truth)
  if (polarCustomerId) {
    await syncQuotaFromPolar(licenseNonce, polarCustomerId);
  }

  // 3. Check quota
  const quotaResult = await checkQuotaWithOverage(context);

  // 4. Hard block if exceeded
  if (!quotaResult.allowed && quotaResult.exceeded) {
    return {
      allowed: false,
      response: createQuotaExceededResponse(quotaResult, context)
    };
  }

  return { allowed: true, result: quotaResult };
}
```

**429 Response Format:**
```typescript
interface QuotaExceededResponse {
  error: 'quota_exceeded' | 'account_suspended';
  code: string;
  message: string;
  exceeded: {
    type: string;
    limit: number;
    current: number;
    requested: number;
  };
  remaining: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };
  retryAfter: number;  // seconds until reset
  upgradeUrl: string;
  dunningState?: 'ok' | 'grace_period' | 'suspended' | 'delinquent';
}
```

---

## 5. Polar.sh Integration

### 5.1 Metered Billing (`src/lib/billing/polar-metered-billing.ts`)

**Usage Recording:**
```typescript
export async function recordPolarUsage(
  input: PolarUsageRecordInput,
  config: PolarMeteredConfig
): Promise<PolarUsageRecordResult> {
  const polar = getPolarClient();

  // Rate limit handling with exponential backoff
  const result = await withRetry(
    async () => {
      return await polar.customerMeters.createUsage({
        customerId: input.customerId,
        body: {
          meter_slug: input.meterSlug,
          quantity: input.quantity,
          idempotency_key: input.idempotencyKey,
          timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
        },
      });
    },
    config,
    'recordUsage'
  );

  return {
    success: true,
    recordId: input.idempotencyKey,
    message: `Recorded ${input.quantity} units`
  };
}
```

**Idempotency Key Pattern:**
```typescript
export function generatePolarIdempotencyKey(
  customerId: string,
  meterSlug: string,
  timestamp: number,
  sequence?: number
): string {
  return `polar_usage_${customerId}_${meterSlug}_${timestamp}_${sequence || 0}`;
}
```

### 5.2 Webhook Handler (`src/lib/payments/polar-webhook-handler.ts`)

**Event Routing:**
```typescript
async function handleEventByType(event: PolarWebhookEvent): Promise<void> {
  switch (event.type) {
    case 'checkout.updated':
      if (event.data.status === 'succeeded') {
        await handleCheckoutSuccess(event.data);
      } else if (event.data.status === 'failed') {
        await handleCheckoutFailed(event.data); // Trigger dunning
      }
      break;

    case 'subscription.created':
      await handleSubscriptionCreated(event.data);
      break;

    case 'subscription.active':
      await handleSubscriptionActive(event.data); // Reactivate license
      break;

    case 'subscription.past_due':
      await handleSubscriptionPastDue(event.data); // Trigger dunning
      break;

    case 'subscription.expired':
      await handleSubscriptionExpired(event.data); // Full revoke
      break;

    case 'order.paid':
      await handleOrderPaid(event.data);
      break;
  }
}
```

**License Auto-Generation:**
```typescript
async function generateLicenseOnPayment(params: {
  userId: string;
  tier: Tier;
  polarSubscriptionId?: string;
  polarCustomerId?: string;
}): Promise<{ nonce: string; keyHash: string } | null> {
  // Generate license key
  const licenseKey = generateLicenseKey(tier, expiresDate, secret);
  const nonce = parts[3];
  const keyHash = createHash('sha256').update(licenseKey).digest('hex');

  // Store in database
  await createLicense({
    tier,
    nonce,
    keyHash,
    expiresAt: expiresTimestamp,
    metadata: {
      polarSubscriptionId,
      polarCustomerId,
      source: 'auto-generated'
    }
  });

  return { nonce, keyHash };
}
```

---

## 6. Multi-Tenant Isolation

### 6.1 Agency Isolation Middleware (`src/middleware/agency-isolation.ts`)

**Extraction Priority:**
1. `X-RaaS-Agency-ID` header (from RaaS Gateway)
2. JWT token `agency_id` claim
3. API key lookup

```typescript
async function extractAndValidateAgencyId(request: NextRequest): Promise<string | null> {
  // 1. Check header first
  let agencyId = request.headers.get('x-raas-agency-id');
  if (agencyId) return agencyId;

  // 2. Extract from JWT
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.split('.').length === 3) {
      const verified = await jwtVerify(token, secret);
      const jwtAgencyId = verified.payload.agency_id as string;
      if (jwtAgencyId) return jwtAgencyId;
    }
  }

  return null;
}
```

### 6.2 Tenant Isolation Validator (`src/middleware/tenant-isolation.ts`)

**Resource Access Validation:**
```typescript
async function validateResourceAccess(
  agencyId: string,
  resourceType: string,
  resourceId: string | null
): Promise<boolean> {
  switch(resourceType) {
    case 'usage_event':
      const { data } = await supabase
        .from('usage_events')
        .select('user_id')
        .eq('id', resourceId)
        .single();
      return data?.user_id === agencyId;

    case 'license':
      const { data: license } = await supabase
        .from('raas_licenses')
        .select('created_by')
        .eq('nonce', resourceId)
        .single();
      return license?.created_by === agencyId;

    default:
      return false; // Deny by default
  }
}
```

---

## 7. Usage Event Queue Pattern

### 7.1 Event Emitter (`src/worker/lib/usage-emitter.ts`)

**Event Structure:**
```typescript
interface UsageEvent {
  licenseNonce: string;
  userId: string;
  tier: string;
  usageCount: number;
  overageCount: number;
  overageFee: number;
  timestamp: number;
  idempotencyKey: string;
  service?: string;
  billingPeriod?: string;
}
```

**Batch Emitter:**
```typescript
export function createBatchEmitter(maxBatchSize = 10): BatchEmitter {
  const events: UsageEvent[] = [];

  return {
    addEvent(event: UsageEvent): void {
      events.push(event);
    },

    async flush(queue: Queue<UsageEvent>): Promise<number> {
      if (events.length === 0) return 0;

      const batchSize = events.length;
      await Promise.all(events.map(event => queue.send(event)));
      events.length = 0;

      return batchSize;
    },

    get size(): number {
      return events.length;
    }
  };
}
```

### 7.2 Queue Consumer (`src/worker/index.ts`)

```typescript
async queue(
  batch: MessageBatch<UsageEvent>,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const events = batch.messages.map(msg => msg.body);

  for (const event of events) {
    // Update KV counter
    await incrementUsage(event.licenseNonce, event.service, event.overageCount, env.KV_KV);

    // Forward to webhook for persistent storage
    if (event.overageFee > 0 && env.OVERAGE_WEBHOOK_URL) {
      ctx.waitUntil(
        fetch(env.OVERAGE_WEBHOOK_URL, {
          method: 'POST',
          body: JSON.stringify(event)
        })
      );
    }
  }
}
```

---

## 8. Security Patterns

### 8.1 Rate Limiter (`src/middleware/rate-limiter.ts`)

**Sliding Window Implementation:**
```typescript
async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const now = Date.now();
  const key = `rate:${identifier}`;
  const windowStart = now - windowMs;

  // Remove old entries
  await kv.delete(key);

  // Get current window count
  const count = await kv.get(key) || 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0, reset: now + windowMs };
  }

  // Increment
  await kv.put(key, (count + 1).toString(), {
    expirationTtl: Math.ceil(windowMs / 1000)
  });

  return { allowed: true, remaining: limit - count, reset: now + windowMs };
}
```

### 8.2 Circuit Breaker (`src/lib/usage-metering/realtime-tracker.ts`)

```typescript
interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

async function hasEmergencyBypass(userId: string): Promise<boolean> {
  // Allow bypass during circuit open state
  const state = await getCircuitState(userId);
  return state.state === 'open';
}

async function recordCircuitFailure(userId: string): Promise<void> {
  // Increment failure count, open circuit after threshold
}

async function recordCircuitSuccess(userId: string): Promise<void> {
  // Reset failure count, close circuit
}
```

---

## 9. Dunning Workflow Integration

### 9.1 Dunning States (`src/lib/billing/dunning-workflow.ts`)

| State | Description | API Access |
|-------|-------------|------------|
| `ok` | Active, paying | Full |
| `grace_period` | Past due, < 7 days | Full + warning |
| `suspended` | Past due, 7-30 days | Read-only |
| `delinquent` | > 30 days unpaid | Blocked |

**Access Check:**
```typescript
export async function canAccessApi(
  licenseNonce: string
): Promise<{ allowed: boolean; state: DunningState; reason?: string }> {
  const { data } = await supabase
    .from('raas_licenses')
    .select('metadata->>dunningState')
    .eq('nonce', licenseNonce)
    .single();

  const dunningState = data?.dunningState || 'ok';

  switch (dunningState) {
    case 'ok':
    case 'grace_period':
      return { allowed: true, state: dunningState };

    case 'suspended':
      return {
        allowed: false,
        state: 'suspended',
        reason: 'Account suspended - payment required'
      };

    case 'delinquent':
      return {
        allowed: false,
        state: 'delinquent',
        reason: 'Account delinquent - contact support'
      };

    default:
      return { allowed: true, state: 'ok' };
  }
}
```

---

## 10. Recommendations & Gaps

### Existing Strengths:
1. **Edge-first architecture** - KV caching cho sub-ms quota checks
2. **Idempotency** - Usage events có unique keys cho deduplication
3. **Dunning integration** - Payment failure tự động trigger suspension
4. **Multi-tenant isolation** - Agency ID validation ở middleware layer
5. **Audit logging** - Receipt-based logging với compliance tracking

### Identified Gaps:
1. **Missing: License revocation on cancellation** - Cần thêm webhook handler cho `subscription.cancelled` để revoke license ngay lập tức
2. **Missing: Usage anomaly detection** - Không có alert cho sudden usage spikes (có thể abuse)
3. **Missing: KV cache invalidation on subscription change** - Cache 5 phút có thể stale khi user upgrade/downgrade
4. **Missing: Rate limit headers** - Nên thêm `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
5. **Missing: Graceful degradation** - Khi KV unavailable, không có fallback mode

### Suggested Improvements:
```typescript
// 1. Add cache invalidation on webhook
async function handleSubscriptionUpdated(event: PolarWebhookEvent) {
  // ... update database ...

  // Invalidate KV cache
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('nonce')
    .eq('metadata->>polarSubscriptionId', event.data.id)
    .single();

  if (license) {
    await invalidateLicense(license.nonce, env.KV_KV);
  }
}

// 2. Add rate limit headers
function buildQuotaInfoHeaders(overage: OverageResult): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', overage.baseLimit.toString());
  headers.set('X-RateLimit-Remaining', overage.remaining.toString());
  headers.set('X-RateLimit-Reset', getResetDate());
  return headers;
}

// 3. Add anomaly detection
async function detectUsageAnomaly(
  userId: string,
  currentUsage: number
): Promise<boolean> {
  const avgUsage = await getAverageDailyUsage(userId);
  const spikeThreshold = avgUsage * 5; // 5x normal usage
  return currentUsage > spikeThreshold;
}
```

---

## 11. File Reference Map

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Worker Entry | `src/worker/index.ts` | Main request handler |
| Auth Middleware | `src/worker/lib/auth-middleware.ts` | JWT verification |
| License Cache | `src/worker/lib/kv-license-cache.ts` | 5-min TTL cache |
| Quota Counter | `src/worker/lib/quota-counter.ts` | KV-based counter |
| Overage Calculator | `src/worker/lib/overage-calculator.ts` | Tiered pricing |
| Usage Emitter | `src/worker/lib/usage-emitter.ts` | Queue events |
| Quota Checker | `src/lib/quota/quota-checker.ts` | Soft/hard thresholds |
| Quota Enforcer | `src/lib/quota/quota-enforcer.ts` | Hard blocking |
| Polar Metered | `src/lib/billing/polar-metered-billing.ts` | Usage API client |
| Polar Webhook | `src/lib/payments/polar-webhook-handler.ts` | Event routing |
| Agency Isolation | `src/middleware/agency-isolation.ts` | Multi-tenant |
| Tenant Isolation | `src/middleware/tenant-isolation.ts` | Resource access |
| API Key Validator | `src/lib/security/api-key-validator.ts` | mk_ key format |
| JWT Validator | `src/lib/security/jwt-validator.ts` | Supabase JWKS |

---

## 12. Deployment Checklist

```yaml
Pre-deploy:
  - [ ] Set KV_KV binding in wrangler.toml
  - [ ] Create USAGE_QUEUE in Cloudflare Dashboard
  - [ ] Configure ENVIRONMENT and HARD_LIMIT_PERCENT vars
  - [ ] Set JWT_SECRET=REDACTED in environment

Post-deploy:
  - [ ] Test /health endpoint
  - [ ] Verify JWT validation with test token
  - [ ] Confirm KV counter increments
  - [ ] Test 429 response at hard limit
  - [ ] Validate webhook signature

Monitoring:
  - [ ] Set up Worker analytics dashboard
  - [ ] Configure error alerting
  - [ ] Track KV read/write operations
  - [ ] Monitor queue depth
```

---

## Unresolved Questions

1. **Worker deployment target** - Chưa rõ Worker đang deploy ở môi trường nào (dev/staging/production)?
2. **KV namespace ID** - Cần cập nhật wrangler.toml với actual KV namespace ID
3. **Polar meter slugs** - Chưa confirm meter slugs đã được tạo trong Polar dashboard chưa?
4. **JWT nonce table** - `raas_jwt_nonces` table đã có migration chưa?
5. **Dunning state column** - `raas_licenses.metadata->>dunningState` có index chưa cho query performance?
