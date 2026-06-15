# Overage Billing & Quota Enforcement - Research Report

**Date:** 2026-03-08
**Project:** Sophia AI Factory (ROIaaS)
**Researcher:** Agent

---

## Executive Summary

This report analyzes the existing overage billing and quota enforcement implementation in Sophia AI Factory. The codebase demonstrates a comprehensive, production-ready system with:

1. **Multi-tier Quota Enforcement** - Hourly/Daily/Monthly credit and request limits
2. **Stripe/Polar Metered Billing** - Automatic overage charge integration
3. **API Gateway Instrumentation** - Per-request usage metering with 429 tracking
4. **HMAC-RAS License Gate** - mk_ API key validation with entitlement verification
5. **PostgreSQL-based Rate Limiting** - SQL triggers for ACID-compliant concurrent access

---

## 1. Stripe/Polar Overage Billing

### Current Implementation

**Stripe Metered Billing Integration:** `src/lib/payments/stripe-metered-billing.ts`

| Feature | Status | Notes |
|---------|--------|-------|
| Usage Records | ✅ Implemented | `recordUsageForBilling()` with idempotency |
| Batch Recording | ✅ Implemented | Rate-limited concurrent processing |
| Overage Sync | ✅ Implemented | `syncOverageToStripe()` for quota events |
| Price Mapping | ✅ Implemented | Tier→Price ID mapping (BASIC/PREMIUM/ENTERPRISE/MASTER) |
| Real-time Sync | ⚠️ Partial | Requires stripe_subscription_id in license metadata |

**Polar.sh Integration:**
- Uses `raas_licenses.metadata.polar_customer_id` for customer lookup
- Syncs from Polar via `syncQuotaFromPolar()` in quota-enforcer.ts
- Idempotent upsert using `idempotency_key` field

### Overage Billing Reconciler

**File:** `src/lib/billing/overage-billing-reconciler.ts`

```typescript
// Automatic reconciliation workflow:
scanUnbilledOverageEvents()      // Scan overage_events WHERE billable=false
  → calculateOverageCharges()    // Tier-based pricing
  → createStripeInvoiceItem()    // Stripe API integration
  → markEventsAsBilled()         // Update database
```

**Pricing Tiers:**
| Tier | Price/Credit | Currency |
|------|-------------|----------|
| BASIC | $0.10 | USD |
| PREMIUM | $0.05 | USD |
| ENTERPRISE | $0.03 | USD |
| MASTER | $0.02 | USD |

**Idempotency:** Uses key pattern `overage-{licenseNonce}-{periodStart}-{periodEnd}`

### Unresolved Questions

1. **Polar vs Stripe Priority** - Should Polar webhook trigger Stripe sync? Or use cron?
2. **Proration** - No partial month handling for mid-period upgrades/downgrades
3. **Tax Compliance** - No tax calculation (Stripe Tax integration omitted)

---

## 2. Quota Enforcement Patterns

### API Gateway Flow

```
Request → [Rate Limiter] → [RaaS Gate]
                      ↓
              [Quota Checker]
                      ↓
                [Band/Allow]
```

### Quota Checker Flow

**File:** `src/lib/quota/quota-checker.ts`

```typescript
// 1. Check KV cache (Cloudflare Workers - sub-ms)
// 2. Cache miss → DB query (parallel hourly/daily/monthly)
// 3. Soft threshold check (80%) → warning flag
// 4. Hard limit check (100%) → block or overage
// 5. Update cache (non-blocking)
```

**Rolling Windows:**
| Window | Reset | Use Case |
|--------|-------|----------|
| Hourly | Next hour start | Burst protection |
| Daily | Midnight UTC | Daily cap |
| Monthly | 1st of month | Subscription cycle |

### Enforced Quotas (BASIC Tier Example)

| Limit | Value | Exceeded Response |
|-------|-------|-------------------|
| Hourly Credits | 20 | 429 + "Hourly credit limit exceeded" |
| Daily Credits | 100 | 429 + "Daily credit limit exceeded" |
| Daily Requests | 500 | 429 + "Daily request limit exceeded" |
| Monthly Credits | 2,000 | 429 + "Monthly credit limit exceeded" |

### Hard Blocking Configuration

**File:** `src/lib/quota/quota-enforcer.ts`

```typescript
DEFAULT_CONFIG = {
  softWarningThreshold: 0.8,  // Show warning at 80%
  enableOverageBilling: false, // Default: block on exceed
  failClosed: true,            // Block on error
}
```

### Unresolved Questions

1. **Cross-API Quota** - Each API route has separate counter. Should credit pooling across services?
2. **Grace Period** - No grace period for burst traffic (e.g., 110% for 5 min)
3. **Rollback on Error** - No automatic quota reset if downstream API fails after usage event

---

## 3. Real-time Usage Metering

### Gateway Instrumentation

**File:** `src/lib/usage-metering/gateway-instrumentation.ts`

**Track Everything Pattern:**
```typescript
emitUsageEvent(request, response, context)
```

**Every API request:** Logs to `usage_events` table with:
- `user_id` (from license)
- `service` (extracted from path)
- `action` (extracted from path)
- `credits_used` (calculated per rules)
- `status_code` (200, 429, 403, etc.)
- `tier_at_request`
- `resource_type` (api_call, rate_limited, forbidden)
- `response_time_ms`

**Sampling Configuration:**
```env
USAGE_METERING_ENABLED=true
USAGE_METERING_EXCLUDED_ENDPOINTS=/api/health,/api/setup,/api/webhooks
USAGE_METERING_SAMPLE_RATE=0.1  # 10% for high-volume routes
```

### Credit Calculation Rules

**File:** `src/lib/usage-metering/constants.ts`

```typescript
CREDIT_RULES = {
  heygen: {
    createVideo: { type: 'per-call', credits: 50 },
    getVideoStatus: { type: 'per-call', credits: 1 },
  },
  elevenlabs: {
    textToSpeech: { type: 'per-1k-tokens', creditsPer1k: 10 },
  },
  openrouter: {
    chatCompletion: { type: 'per-1k-tokens', creditsPer1k: 5 },
  },
}
```

### Tier Multipliers

| Tier | Multiplier | Effect |
|------|-----------|--------|
| BASIC | 1.0x | Full price |
| PREMIUM | 0.8x | 20% discount |
| ENTERPRISE | 0.6x | 40% discount |
| MASTER | 0.5x | 50% discount |

### Unresolved Questions

1. **Time window calculation** - Current: database queries. Could use Cloudflare KV for global counter?
2. **Token tracking** - Input vs output tokens stored but not used for billing yet
3. **Monitoring dashboards** - No real-time usage alerting (Slack webhook integration missing)

---

## 4. License Entitlement Verification

### Authentication Stack

| Component | File | Purpose |
|-----------|------|---------|
| mk_ API Key | `api-key-validator.ts` | HMAC-SHA256 signed keys |
| JWT | `jwt-validator.ts` | Supabase Auth tokens |
| RaaS Gate | `raas-gate.ts` | combined auth + quota |

### mk_ API Key Format

```
mk_{keyId}_{hmacSignature}

Example: mk_a1b2c3d4e5f6g7h8_1a2b3c4d5e6f...
```

**Components:**
- `keyId` (16 hex chars) - Random identifier
- `hmacSignature` (64 hex chars) - HMAC-SHA256(keyId, secret)

**Database Storage:** `raas_api_keys` table
- Stores key hash (never plain key)
- Permissions array
- Rate limit per minute
- Expiration timestamp

### Entitlement Verification Flow

```
1. Extract license key from:
   - X-RaaS-License-Key header OR
   - Authorization: Bearer header OR
   - Query param (less secure, for testing)

2. Validate format:
   - mk_ prefix
   - Correct keyId length
   - Valid hex signatures

3. Verify signature:
   - Compute HMAC-SHA256
   - Timing-safe comparison

4. Check database:
   - Key not revoked
   - Not expired
   - Permissions match endpoint

5. Quota Check:
   - Get license → user_id, tier, polar_customer_id
   - run checkQuotaWithOverage()
   - Return 429 if exceeded
```

### RaaS Gate Integration

**File:** `src/lib/raas-gate.ts`

**Entitlement Check at 403/Grade:**
```typescript
// After license validation passes:
const license = db.query('raas_licenses')
  .select('nonce, tier, polar_customer_id')
  .where('key_hash = keyHash')
  .single()

const quotaResult = checkQuotaWithOverage({
  userId: license.created_by,
  licenseNonce: license.nonce,
  tier: license.tier,
  requestedCredits: 1,
})

if (!quotaResult.allowed) {
  return NextResponse.json({ error: 'Quota exceeded' }, { status: 429 })
}
```

### Unresolved Questions

1. **Concurrent Access** - What happens when 100 requests hit quota at same millisecond?
2. **License Key Rotation** - No key rotation mechanism (new key invalidates old)
3. **Multi-Tenant** - No support for API keys owned by organizations (Not just individual users)

---

## 5. Database Schema

### Tables Used

| Table | Purpose |
|-------|---------|
| `usage_events` | All API request tracking |
| `overage_events` | Quota exceeded events |
| `quota_limits` | Custom tier limits per license |
| `raas_licenses` | License metadata (tier, polar_customer_id) |
| `raas_api_keys` | mk_ API key storage (hash only) |

###关键指标

**Usage Events Schema:**
```sql
user_id TEXT
license_nonce TEXT
service_name TEXT
action TEXT
credits_used INTEGER
tokens_input INTEGER
tokens_output INTEGER
tier_at_request TEXT
status_code INTEGER
response_time_ms INTEGER
created_at TIMESTAMPTZ
idempotency_key TEXT UNIQUE
external_customer_id TEXT
is_polar_synced BOOLEAN
is_stripe_synced BOOLEAN
```

---

## 6. Integration Patterns Summary

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │   Rate       │  │   RaaS Gate  │  │  Usage Instrument    │   │
│  │   Limiter    │→ │  (Auth/Quota)│→ │   emitUsageEvent()   │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ SQL Rate     │  │   Quota      │  │   usage_events     │   │
│  │   Limiter    │  │  Checker     │  │   (async insert)   │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
│                                      │                  │       │
│                                      ▼                  ▼       │
│                              ┌──────────────┐  ┌──────────────┐ │
│                              │ Overage      │  │    KV Cache  │ │
│                              │  Logger      │  │  (optional)  │ │
│                              └──────────────┘  └──────────────┘ │
│                                      │                          │
│                                      ▼                          │
│                              ┌──────────────┐                   │
│                              │   Billing    │                   │
│                              │  Reconciler  │                   │
│                              └──────────────┘                   │
│                                      │                          │
│                  ┌───────────────────┼───────────────────┐      │
│                  ▼                   ▼                   ▼      │
│            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│            │   Stripe     │  │   Polar.sh   │  │   Cron Job   │ │
│            │   Billing    │  │   Metered    │  │   (hourly)   │ │
│            └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### recommended best practices

1. **Polar.sh First** - Use Polar webhook → metered billing API → sync to local DB
2. **Idempotency Everywhere** - All sync operations use `idempotency_key`
3. **Async Events** - Usage tracking should never block request latency
4. **Fail-Open on Error** - If tracking service down, allow request (audit trail in logs)
5. **Daily Reconciliation** - Run cron job to sync Polar usage → Stripe invoice items

---

## 7. Code Quality Assessment

| Area | Score | Notes |
|------|-------|-------|
| Type Safety | 9/10 | Zod validation on all inputs |
| Error Handling | 8/10 | Try-catch with fallbacks |
| Idempotency | 9/10 | DB unique constraints + app logic |
| Logging | 8/10 | Structured JSON logs |
| Test Coverage | 7/10 | Some areas covered |

---

## 8. Recommendations

### Priority 1: Critical Gaps

| Issue | Impact | Solution |
|-------|--------|----------|
| No Stripe webhook handling | Missed billing updates | Add `/api/webhooks/stripe` endpoint |
| Missing real-time alerting | User surprise at quota | Slack webhook integration |
| No license rotation | Security risk | Add key rotation API |

### Priority 2: Enhancements

| Issue | Impact | Solution |
|-------|--------|----------|
| KV cache not used in production | Higher DB load | Deploy KV namespace |
| No rolling window tracking | Inaccurate daily counts | Support sliding window queries |
| Missing analytics dashboard | No visibility | Add Grafana/Datadog integration |

### Priority 3: Nice-to-Have

| Issue | Impact | Solution |
|-------|--------|----------|
| No proration | User confusion | Mid-period upgrade/downgrade |
| No tax calculation | Compliance risk | Stripe Tax integration |
| No multi-tenant support | Enterprise sale blocker | Organization-level keys |

---

## 9. Unresolved Questions

### Technical

1. **Cloudflare KV Activation** - Is KV namespace provisioned for `KV_KV` binding?
2. **Stripe Webhook URL** - What's the configured webhook URL for metered billing?
3. **Polar Webhook Secret** - How are webhooks validated for authenticity?

### Business Logic

4. **Overage Billing Trigger** - Is billing reconciliation run automatically via cron?
5. **Grace Period** - Should overage be allowed for first X minutes of exceeded?
6. **Refund Policy** - No code for partial refunds when license downgrades mid-period

### Deployment

7. **Production DB** - Is `overage_events` table populated in prod?
8. **Stripe Test Mode** - Is Stripe in test mode for development?

---

## Appendix A: Key File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/proxy.ts` | Main middleware entry | ~280 |
| `src/lib/raas-gate.ts` | Auth + Quota gate | ~380 |
| `src/lib/quota/quota-checker.ts` | Quota validation | ~435 |
| `src/lib/quota/quota-enforcer.ts` | Hard blocking | ~335 |
| `src/lib/usage-metering/tracker.ts` | Usage event tracking | ~220 |
| `src/lib/billing/overage-billing-reconciler.ts` | Stripe billing sync | ~512 |
| `src/lib/payments/stripe-metered-billing.ts` | Stripe SDK abstraction | ~660 |

---

## Appendix B: Database Queries

### Hourly Usage Calculation
```sql
SELECT COALESCE(SUM(credits_used), 0)
FROM usage_events
WHERE user_id = :userId
  AND license_nonce = :licenseNonce
  AND created_at >= :hourStart
  AND created_at < :hourStart + 3600;
```

### Unbilled Overage Events
```sql
SELECT * FROM overage_events
WHERE billable = false
ORDER BY created_at ASC;
```

### License by Key Hash
```sql
SELECT nonce, tier, polar_customer_id, created_by
FROM raas_licenses
WHERE key_hash = :sha256(key);
```

---

Report generated: 2026-03-08 20:44 UTC
Researcher: ad98199c0201ddfa0
