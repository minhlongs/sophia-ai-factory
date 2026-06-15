# Research Report: Cloudflare Worker Infrastructure for RaaS Gateway Quota Enforcement

**Date:** 2026-03-09
**Author:** Researcher Agent
**Work Context:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory`

---

## Executive Summary

**Status:** NO Cloudflare Worker deployment exists. KV caching is **coded but not configured**.

**Key Findings:**
- ❌ No `wrangler.toml` or CF Worker deployment
- ❌ No KV namespace bindings configured
- ✅ KV client code exists in `quota-checker.ts` and `realtime-tracker.ts`
- ✅ Uses Upstash Redis as current caching layer (not CF KV)
- ✅ RaaS Gateway (`raas-gate.ts`) has quota enforcement hooks ready
- ✅ Polar billing integration complete (`polar-metered-billing.ts`)

**Gap:** CF Worker infrastructure needs to be created from scratch.

---

## 1. Existing CF Worker Setup

### Deployment Status: NOT DEPLOYED

| Item | Status |
|------|--------|
| `wrangler.toml` | ❌ Not found |
| CF Worker routes | ❌ Not configured |
| KV namespace bindings | ❌ Not configured |
| CF account ID | ❌ Not in `.env.example` |
| CF API token | ❌ Not in `.env.example` |

### Current Architecture

```
Next.js App (Vercel)
├── RaaS Gate Middleware (src/lib/raas-gate.ts)
│   ├── JWT/mk_ API key validation
│   ├── Polar subscription check
│   └── Quota enforcement via enforceQuota()
├── Quota Enforcer (src/lib/quota/quota-enforcer.ts)
│   ├── Sync from Polar API
│   ├── checkQuotaWithOverage()
│   └── 429 response generation
└── Quota Checker (src/lib/quota/quota-checker.ts)
    ├── KV caching (CODE ONLY - NOT CONFIGURED)
    ├── Supabase DB fallback
    └── getEffectiveQuotaLimits()
```

---

## 2. Rate Limiting KV Usage

### Current Implementation: Upstash Redis (NOT CF KV)

**File:** `src/lib/redis.ts`
```typescript
import { Redis } from '@upstash/redis'
// Uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
```

**File:** `src/lib/security/sql-rate-limiter.ts`
- SQL-based rate limiting via Supabase `increment_rate_limit` RPC function
- Tables: `rate_limits`, `telegram_rate_limits`
- Config: `RATE_LIMITS` object (api: 100/min, webhook: 1000/min, auth: 10/min)

### KV Client Code (Prepared but Not Configured)

**File:** `src/lib/quota/quota-checker.ts` (lines 40-99)

```typescript
declare global {
  var KV_KV: {
    get: (key: string) => Promise<CachedQuota | null>;
    set: (key: string, value: CachedQuota, options?: { expirationTtl?: number }) => Promise<void>;
  } | undefined;
}

function getKvClient() {
  if (typeof globalThis !== 'undefined' && (globalThis as any).KV_KV) {
    return (globalThis as any).KV_KV;
  }
  return null; // Fallback: No KV
}
```

**Key Format:** `quota:${userId}:${licenseNonce}`
**TTL:** 3600 seconds (1 hour)

**File:** `src/lib/usage-metering/realtime-tracker.ts`
- Circuit breaker state caching
- Real-time usage counters
- Key format: `usage:${userId}:${licenseNonce}`, `circuit:${licenseNonce}`

### Gap Analysis: Current vs CF KV

| Feature | Current (Upstash/SQL) | CF KV Target |
|---------|----------------------|--------------|
| Latency | ~50-100ms (Upstash) | ~5-10ms (edge) |
| TTL Support | ✅ Yes | ✅ Yes |
| Atomic Incr | ✅ SQL function | ❌ No (use Queue/Queue) |
| Global Repl | ✅ Upstash | ✅ CF KV |
| Binding | Env vars | `kv_namespace` in wrangler.toml |

---

## 3. RaaS Gateway Integration

### Current Auth Flow (`raas-gate.ts`)

```
1. extractLicenseKey() → X-RaaS-License-Key header or Bearer token
2. validateLicenseKey() → HMAC-SHA256 via raas-service.ts
3. checkPolarSubscriptionStatus() → Polar API check
4. enforceQuota() → Quota enforcement with circuit breaker
5. Allow/block with 403/429 response
```

### Integration Points for CF Worker

| Point | Current | CF Worker Target |
|-------|---------|-----------------|
| Auth middleware | Next.js middleware | CF Worker `fetch()` handler |
| JWT validation | `jose` library | Same (edge-compatible) |
| API key validation | Supabase query | CF D1 or KV lookup |
| Quota check | `checkQuotaWithOverage()` | CF KV `get()` + atomic incr |
| 429 response | `createQuotaExceededResponse()` | Same JSON structure |

### Performance Budget

**Current:** 50-150ms (Supabase queries + Upstash)
**Target CF Worker:** <50ms (KV edge caching)

**50ms breakdown:**
- JWT validation: ~5ms
- KV cache lookup: ~5ms
- KV atomic increment: ~5ms
- Polar subscription (cached): ~10ms
- Response generation: ~5ms
- **Buffer:** 20ms

---

## 4. Billing Integration

### Current Polar Integration (`polar-metered-billing.ts`)

**Functions:**
- `recordPolarUsage()` - Metered usage tracking
- `getPolarCustomerMeterBalance()` - Balance lookup
- `checkPolarSubscriptionStatus()` - Active subscription check
- `createPolarInvoiceItem()` - One-time charges

**Webhooks:**
- Path: `/api/webhooks/polar` (excluded from RaaS gate)
- Uses standardwebhooks library
- Secret-based authentication

### Usage Event Flow

```
RaaS Gate → enforceQuota() → checkQuotaWithOverage()
    ↓
logOverageEvent() → Supabase overage_events table
    ↓
[Manual/Batch] → recordPolarUsage() → Polar API
    ↓
Polar Invoice → Customer checkout
```

### CF Worker Integration Pattern

```typescript
// Worker fetch() handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. JWT/mk_ validation
    const authResult = await validateApiKey(request, env);
    if (!authResult.valid) return authResult.response;

    // 2. KV quota check (< 50ms)
    const quotaResult = await checkQuotaKV(env.KV_KV, authResult.userId);
    if (!quotaResult.allowed) {
      return new Response(JSON.stringify(quotaResult.response), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Record usage (async, don't await)
    env.QUEUE.sendRequest({ type: 'usage', ...quotaResult });

    // 4. Proxy to Next.js
    return fetch(request);
  }
}
```

---

## 5. Gap Analysis

### What's Missing for CF Worker Quota Enforcement

| Component | Status | Action Needed |
|-----------|--------|---------------|
| `wrangler.toml` | ❌ Missing | Create with KV bindings |
| CF Worker script | ❌ Missing | Create edge worker |
| KV namespace | ❌ Not provisioned | Create via CF dashboard/CLI |
| Queue for async usage | ❌ Missing | Create CF Queue for usage batching |
| D1 database (optional) | ❌ Missing | For API key storage |
| Environment bindings | ❌ Missing | Add to `.env.example` |

### What Needs to Be Created vs Reused

**Create New:**
1. `wrangler.toml` - CF Worker configuration
2. `src/worker/index.ts` - Edge worker entry point
3. `src/worker/handlers/quota-handler.ts` - KV quota logic
4. `src/worker/handlers/auth-handler.ts` - JWT/mk_ validation
5. CF Queue for async usage event batching
6. GitHub Actions workflow for CF Worker deploy

**Reuse Existing:**
1. `src/lib/raas-gate.ts` - Auth logic (adapt for edge)
2. `src/lib/quota/quota-checker.ts` - KV client pattern
3. `src/lib/quota/quota-enforcer.ts` - Quota enforcement logic
4. `src/lib/payments/polar-metered-billing.ts` - Polar API calls
5. `src/lib/audit/` - Audit logging utilities

### Performance Constraints (50ms Budget)

| Operation | Estimated Time | Optimization |
|-----------|---------------|--------------|
| JWT validation | 5-10ms | Edge-compatible `jose` |
| KV cache lookup | 5-10ms | CF KV edge caching |
| KV atomic check+incr | 10-15ms | Use CF Queue for atomic ops |
| Polar subscription (cached) | 10-20ms | Cache in KV, refresh every 5min |
| Response generation | 5ms | Pre-built templates |
| **Total** | **35-60ms** | May exceed 50ms without caching |

**Recommendation:** Use tiered caching
- L1: In-memory cache (worker instance)
- L2: CF KV (edge distributed)
- L3: Supabase DB (source of truth, batched sync)

---

## 6. Recommended Implementation Approach

### Phase 1: Infrastructure Setup (Week 1)

1. **Create CF Worker Project**
   ```bash
   npx wrangler login
   npx wrangler init raas-gateway-worker
   ```

2. **Provision KV Namespace**
   ```bash
   npx wrangler kv:namespace create "KV_KV"
   # Output: id = "xxx" → add to wrangler.toml
   ```

3. **Create Queue for Async Usage**
   ```bash
   npx wrangler queues create quota-usage-queue
   ```

4. **Configure wrangler.toml**
   ```toml
   name = "raas-gateway-worker"
   main = "src/worker/index.ts"
   compatibility_date = "2026-03-01"

   [vars]
   NODE_ENV = "production"

   [[kv_namespaces]]
   binding = "KV_KV"
   id = "xxx"

   [[queues.producers]]
   queue = "quota-usage-queue"
   binding = "QUEUE"
   ```

### Phase 2: Worker Implementation (Week 2)

1. **Create Worker Entry Point**
   - `src/worker/index.ts` with `fetch()` handler
   - Route matching for `/api/*` paths

2. **Implement Auth Handler**
   - JWT validation with `jose` (edge-compatible)
   - mk_ API key lookup from D1 or KV
   - HMAC signature validation

3. **Implement Quota Handler**
   - KV lookup for cached usage
   - Atomic increment for rate limiting
   - 429 response generation

4. **Implement Async Usage Batcher**
   - Queue consumer for usage events
   - Batch write to Supabase (every 100 events or 30s)
   - Polar sync trigger

### Phase 3: Integration Testing (Week 3)

1. **Unit Tests**
   - KV cache logic
   - JWT validation
   - 429 response format

2. **Integration Tests**
   - End-to-end quota flow
   - Polar sync verification
   - Circuit breaker behavior

3. **Load Testing**
   - 1000 RPS target
   - <50ms p99 latency
   - Zero error rate

### Phase 4: Production Deployment (Week 4)

1. **GitHub Actions Workflow**
   ```yaml
   name: Deploy CF Worker
   on: push to main
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout
         - uses: cloudflare/wrangler-action@v3
   ```

2. **Route Configuration**
   - `api.sophia.agencyos.network/*` → Worker
   - Fallback to Next.js for non-API routes

3. **Monitoring Setup**
   - CF Analytics
   - Error alerting (Slack webhook)
   - Latency dashboards

---

## 7. File Structure Recommendation

```
apps/sophia-ai-factory/
├── wrangler.toml                          # NEW - CF Worker config
├── src/
│   ├── worker/                            # NEW - CF Worker code
│   │   ├── index.ts                       # Entry point (fetch handler)
│   │   ├── handlers/
│   │   │   ├── auth-handler.ts            # JWT/mk_ validation
│   │   │   ├── quota-handler.ts           # KV quota checks
│   │   │   └── proxy-handler.ts           # Proxy to Next.js
│   │   ├── utils/
│   │   │   ├── kv-client.ts               # KV wrapper
│   │   │   └── response-builder.ts        # 429/403 responses
│   │   └── types/
│   │       └── worker-env.d.ts            # Env type definitions
│   └── lib/                               # EXISTING - Reuse
│       ├── raas-gate.ts                   # Adapt for edge
│       ├── quota/
│       │   ├── quota-checker.ts           # KV pattern
│       │   └── quota-enforcer.ts          # Enforcement logic
│       └── payments/
│           └── polar-metered-billing.ts   # Polar API
├── .github/workflows/
│   └── cf-worker-deploy.yml               # NEW - Deploy workflow
└── .env.example                           # UPDATE - Add CF vars
```

---

## 8. Environment Variables Required

Add to `.env.example`:

```bash
# Cloudflare Worker
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_API_TOKEN=xxx
CF_WORKER_NAME=raas-gateway-worker

# CF KV (auto-bound via wrangler.toml, dev only)
KV_KV=local-kv-namespace-id

# CF Queue (auto-bound, dev only)
QUEUE=local-queue-name
```

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| KV eventual consistency | Stale quota data | Use optimistic locking + DB fallback |
| CF Worker cold start | >50ms latency on first request | Use always-on + provisioned concurrency |
| Polar API rate limits | Quota sync failures | Batch updates + exponential backoff |
| D1 write limits | API key lookup failures | Cache in KV with TTL |
| Queue backlog | Usage event delays | Scale consumer workers |

---

## 10. Unresolved Questions

1. **D1 vs KV for API key storage?**
   - D1: Better for relational data, ACID transactions
   - KV: Faster reads, simpler key-value
   - **Recommendation:** KV for API keys (simple lookup)

2. **How to handle atomic increments in KV?**
   - CF KV doesn't support atomic operations
   - **Options:** CF Queue, D1 transactions, or Supabase fallback
   - **Recommendation:** Use Queue for batched atomic writes

3. **Should CF Worker replace or sit in front of Next.js?**
   - Option A: Replace entirely (full migration)
   - Option B: Sit in front (API gateway pattern)
   - **Recommendation:** Option B initially, migrate gradually

4. **How to sync Supabase DB with CF KV?**
   - Real-time sync (complex, potential race conditions)
   - Batch sync every N seconds (simpler, slight staleness)
   - **Recommendation:** Batch sync every 30s via Queue consumer

---

## Appendix: Current File Locations

| File | Path | Purpose |
|------|------|---------|
| `raas-gate.ts` | `apps/sophia-ai-factory/src/lib/raas-gate.ts` | RaaS middleware |
| `quota-enforcer.ts` | `apps/sophia-ai-factory/src/lib/quota/quota-enforcer.ts` | Hard quota blocking |
| `quota-checker.ts` | `apps/sophia-ai-factory/src/lib/quota/quota-checker.ts` | KV cache + DB fallback |
| `polar-metered-billing.ts` | `apps/sophia-ai-factory/src/lib/payments/polar-metered-billing.ts` | Polar API client |
| `sql-rate-limiter.ts` | `apps/sophia-ai-factory/src/lib/security/sql-rate-limiter.ts` | SQL rate limiting |
| `realtime-tracker.ts` | `apps/sophia-ai-factory/src/lib/usage-metering/realtime-tracker.ts` | Circuit breaker + Redis |
| `redis.ts` | `apps/sophia-ai-factory/src/lib/redis.ts` | Upstash Redis client |
| `vercel.json` | `apps/sophia-ai-factory/vercel.json` | Vercel config (no CF) |

---

**Next Steps:**
1. Create `wrangler.toml` and provision CF resources
2. Implement CF Worker entry point
3. Test KV caching and quota enforcement
4. Deploy to staging environment
5. Run load tests and verify <50ms latency
