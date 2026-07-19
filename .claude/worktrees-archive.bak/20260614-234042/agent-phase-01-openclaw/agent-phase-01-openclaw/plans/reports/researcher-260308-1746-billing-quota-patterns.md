# Billing & Quota Patterns Research Report
> Researcher: 260308-1746 | Target: Stripe/Polar Usage Patterns

---

## 1. STRIPE BILLING API - USAGE RECORDS & METERED BILLING

### Current Status: NOT INTEGRATED

**Finding:** Project uses Stripe webhook handlers but NO usage-based metered billing.

#### Existent Stripe Integration
```
File: src/app/api/webhooks/stripe/route.ts
- webhook: POST /api/webhooks/stripe
- Events handled:
  * checkout.session.completed
  * customer.subscription.created
  * customer.subscription.updated
  * customer.subscription.deleted
  * invoice.paid
  * invoice.payment_failed
- Customer ID linking: user_profiles.stripe_customer_id
- Subscription ID linking: user_profiles.stripe_subscription_id
```

#### Gap: Stripe Metered Billing Missing
Stripe's Usage-Based Billing requires:
- `POST /v1/usage_records` - Record usage for subscription
- `POST /v1/subscription_items/{id}/usage_record_summaries` - Record usage summary
- `price_data` with `usage_type=metered`

**Pattern for Metered Billing (Stripe):**
```typescript
// 1. Create metered price
const price = await stripe.prices.create({
  product: 'prod_xyz',
  unit_amount: 1000, // $10.00
  currency: 'usd',
  recurring: { interval: 'month' },
  usage_type: 'metered',
});

// 2. Subscription item with metered price
const subscription = await stripe.subscriptions.create({
  customer: 'cus_xyz',
  items: [{ price: 'price_xyz', quantity: 0 }], // quantity ignored for metered
});

// 3. Record usage
await stripe.subscriptionItems.createUsageRecord(
  'si_xyz',
  {
    quantity: Math.ceil(tokensUsed / 1000),
    timestamp: 'now',
    action: 'increment',
  }
);
```

#### Project Implementation Recommendation
```typescript
// apps/sophia-ai-factory/src/lib/payments/stripe-metered.ts
export async function recordStripeUsage(
  stripeCustomerId: string,
  featureKey: string,
  quantity: number
): Promise<void> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-19.acacia',
  });

  // Get subscription item ID for this feature
  const subscription = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
  });

  if (!subscription.data.length) return;

  const(itemId) = subscription.data[0].items.data.find(
    item => item.price.metadata?.feature === featureKey
  )?.id;

  await stripe.subscriptionItems.createUsageRecord(itemId, {
    quantity,
    timestamp: 'now',
    action: 'increment',
  });
}
```

---

## 2. POLAR.SH WEBHOOKS - ENTITLEMENTS & USAGE LIMITS

### Current Status: STORAGE-BASED, NO USAGE TRACKING

**Finding:** Polar webhooks update `raas_licenses` with customer IDs but do NOT track usage.

#### Polar Event Flow (Current)
```
checkout.success → Polar Webhook
  → raas_licenses insert with polar_customer_id
  → raas_licenses.metadata.stripe_customer_id
  → user_profiles.subscription_tier updated
```

#### Polar Usage Entitlement Pattern
Polar supports per-tier usage limits via:
- **Subscription attributes** - Custom metadata per subscription
- **Entitlement features** - Enable/disable features programmatically

**Pattern for Polar Usage Limits:**
```typescript
// When checkout created, embed tier limits
{
  "metadata": {
    "tier": "PREMIUM",
    "limits": {
      "daily_credits": 500,
      "hourly_credits": 100,
      "daily_requests": 2500,
      "monthly_credits": 10000
    }
  }
}
```

#### Project Recommendation: Usage Envelope
```typescript
// apps/sophia-ai-factory/src/lib/payments/polar-entitlements.ts
export interface TierUsageEnvelope {
  daily: { credits: number; requests: number };
  hourly: { credits: number; requests: number };
  monthly: { credits: number; requests: number };
}

export function getTierUsageEnvelope(tier: Tier): TierUsageEnvelope {
  const envelopes: Record<Tier, TierUsageEnvelope> = {
    BASIC: {
      daily: { credits: 100, requests: 500 },
      hourly: { credits: 20, requests: 100 },
      monthly: { credits: 2000, requests: 10000 },
    },
    PREMIUM: {
      daily: { credits: 500, requests: 2500 },
      hourly: { credits: 100, requests: 500 },
      monthly: { credits: 10000, requests: 50000 },
    },
    ENTERPRISE: {
      daily: { credits: 2000, requests: 10000 },
      hourly: { credits: 500, requests: 2500 },
      monthly: { credits: 50000, requests: 250000 },
    },
    MASTER: {
      daily: { credits: 10000, requests: 50000 },
      hourly: { credits: 2000, requests: 10000 },
      monthly: { credits: 200000, requests: 1000000 },
    },
  };
  return envelopes[tier];
}
```

---

## 3. RATE LIMITING PATTERNS

### Current Status: SQL-BASED SLIDING WINDOW

**Finding:** Project uses Supabase PostgreSQL for rate limiting (already production-grade).

#### Existing Implementation
```
File: src/lib/security/sql-rate-limiter.ts
Method: Sliding window via PostgreSQL RPC function
Function: increment_rate_limit(p_identifier, p_window_seconds)
```

#### Rate Limit Configurations (Current)
```typescript
export const RATE_LIMITS = {
  api: { maxRequests: 100, windowSeconds: 60, identifier: 'api' },
  webhook: { maxRequests: 1000, windowSeconds: 60, identifier: 'webhook' },
  auth: { maxRequests: 10, windowSeconds: 60, identifier: 'auth' },
  admin: { maxRequests: 50, windowSeconds: 60, identifier: 'admin' },
} as const;
```

#### Token Bucket vs Sliding Window Comparison

| Pattern | Memory | Accuracy | Use Case |
|---------|--------|----------|----------|
| **Token Bucket** | Low | Best-effort | Rate limiting Requests/sec |
| **Sliding Window** | High | Precise | Quota tracking per minute |
| **Fixed Window** | Low | Gapped | Simple rate limiting |

#### Project Recommendation: Hybrid Approach
```typescript
// apps/sophia-ai-factory/src/lib/security/hybrid-rate-limiter.ts
export async function checkQuotaWithRateLimit(
  identifier: string,
  quotaLimit: number,
  rateLimit: number
): Promise<RateLimitResult> {
  // Check quota (daily/hourly)
  const quotaResult = await checkQuota(identifier);
  if (!quotaResult.allowed) {
    return { success: false, reason: 'quota_exceeded' };
  }

  // Check rate limit (per-minute)
  const rateResult = await checkRateLimit(identifier, rateLimit);
  if (!rateResult.success) {
    return { success: false, reason: 'rate_limited' };
  }

  return { success: true };
}
```

---

## 4. KV STORAGE FOR AUDIT LOGS

### Current Status: POSTGRESQL ONLY

**Finding:** Audit logs stored in Supabase `raas_audit_logs` table, NO KV tier.

#### Current Audit Schema
```sql
CREATE TABLE raas_audit_logs (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL,
  license_id UUID,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at INTEGER
);
CREATE INDEX idx_audit_created_at ON raas_audit_logs(created_at DESC);
```

#### KV Storage Options

##### Cloudflare KV (Edge-placed)
```
Name: sophia-audit-logs
Pattern: audit:{userId}:{timestamp}
Value: JSON audit entry
TTL: 24-48 hours (recent logs only)
```

##### Supabase Realtime (Public channels)
```typescript
// Listen to audit events in real-time
const channel = supabase
  .channel('audit-logs')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'raas_audit_logs',
  }, payload => {
    console.log('New audit log:', payload.new);
  })
  .subscribe();
```

#### Project Recommendation: Hybrid Storage

| Layer | Storage | TTL | Use Case |
|-------|---------|-----|----------|
| **Real-time** | Supabase Realtime | 1 hr | Dashboard live updates |
| **Recent** | Cloudflare KV | 24 hr | Fast recent lookups |
| **Archive** | Supabase Table | 1 year | Full audit trail |
| **Backup** | S3/Vercel Blob | 7 years | Compliance archive |

**Pattern:**
```typescript
// apps/sophia-ai-factory/src/lib/audit/kv-audit.ts
export async function logAuditWithKV(
  userId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  const entry = {
    userId,
    action,
    details,
    timestamp: Date.now(),
  };

  // 1. Write to Supabase (persistent)
  await supabase.from('raas_audit_logs').insert({ ...entry, created_at: Math.floor(Date.now() / 1000) });

  // 2. Write to Cloudflare KV (recent, fast)
  if (process.env.CLOUDFLARE_KV_NAMESPACE_ID) {
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}/values/audit:${userId}:${Date.now()}`,
      {
        method: 'PUT',
        body: JSON.stringify(entry),
        headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      }
    );
  }

  // 3. Broadcast via Supabase Realtime
  await supabase.from('raas_audit_logs').select('*').eq('user_id', userId).limit(1).then(({ data }) => {
    supabase.channel('audit-broadcast').broadcast({ type: 'new_audit', data });
  });
}
```

---

## 5. COMPREHENSIVE INTEGRATION RECOMMENDATIONS

### A. Metered Billing Architecture
```
┌─────────────────────────────────────────────────────────┐
│                   API REQUEST                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Rate Limit Check                           │
│              (SQL Sliding Window)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Usage Metering                             │
│              - Track credits                            │
│              - Increment counters                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              SLICED QUOTA ENFORCEMENT                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Tier Envelope:                                  │  │
│  │  - Daily: 500 credits / 2500 requests            │  │
│  │  - Hourly: 100 credits / 500 requests            │  │
│  │  - Monthly: 10000 credits / 50000 requests       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              External Billing Sync                      │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │  Stripe Usage      │      │  Polar Entitlements  │  │
│  │  - Usage Records   │      │  - Feature Toggles   │  │
│  │  - Metered Prices  │      │  - Usage Alerts      │  │
│  └────────────────────┘      └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### B. Implementation Priority

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| **1** | Polar tier usage envelope (config only) | Low | Medium |
| **2** | Stripe usage record sync | Medium | High |
| **3** | Cloudflare KV for recent audit logs | Medium | High |
| **4** | Real-time quota dashboard widget | Low | Medium |
| **5** | Overage billing webhook handler | High | High |

### C. Database Schema Additions
```sql
-- usage_limits table (tier envelopes)
CREATE TABLE usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE,
  daily_credits INTEGER NOT NULL,
  daily_requests INTEGER NOT NULL,
  hourly_credits INTEGER NOT NULL,
  hourly_requests INTEGER NOT NULL,
  monthly_credits INTEGER NOT NULL,
  monthly_requests INTEGER NOT NULL,
  overage_rate_cents INTEGER DEFAULT 100, -- $1.00 per extra credit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- current_usage tracking (aggregated, not raw events)
CREATE TABLE current_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  license_nonce TEXT NOT NULL,
  window_type TEXT NOT NULL CHECK (window_type IN ('daily', 'hourly', 'monthly')),
  window_start INTEGER NOT NULL,
  credits_used INTEGER DEFAULT 0,
  requests_used INTEGER DEFAULT 0,
  last_reset INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, window_type, window_start)
);

-- overage charges tracking
CREATE TABLE overage_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  license_nonce TEXT NOT NULL,
  credits_overage INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'failed')),
  stripe_invoice_id TEXT,
  polar_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. UNRESOLVED QUESTIONS

1. **Stripe vs Polar primary billing provider?** Currently both active - which is canonical source of truth?

2. **Usage aggregation frequency?** Should hourly/daily rollups run via cron (every 5min/15min) or real-time increment?

3. **Overage billing method?** Should overages be:
   - Automatic charge on next invoice (Stripe/Polar)?
   - Manual invoice generated?
   - Blocked at 100% usage (hard limit)?

4. **Audit log retention policy?** Current RAAS_AUDIT_LOGS retention period undefined - should KV tier be included?

5. **Multi-tier overlapping windows?** If user upgrades mid-month, how to handle:
   - Daily/hourly quota reset?
   - Monthly quota proration?
   - Overage liability?

---

**Report Generated:** 2026-03-08 17:46
**Researcher:** a6062ce37f733aefb
**Status:** Analysis Complete
**Next:** Implementation planning based on priority
