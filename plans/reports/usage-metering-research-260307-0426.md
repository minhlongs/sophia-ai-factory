# Usage Metering Patterns Research Report

**Date:** 2026-03-07
**Report ID:** researcher-260307-0426
**Project:** Sophia AI Factory

---

## Executive Summary

Research on usage metering patterns across 4 major dimensions:
1. Time-series data storage (PostgreSQL with TimescaleDB vs InfluxDB)
2. Usage metering architectures (middleware, batch, real-time)
3. Rate limiting and quota enforcement (soft vs hard limits, tiers)
4. Integration patterns (license keys, Stripe/Polar webhooks)

Key findings:
- **Current stack is PostgreSQL-based with summary tables** - well-suited for the existing architecture
- **Batch ingestion with idempotency** is production-verified and effective
- **Rollup-based aggregation** provides cost-effective analytics without real-time overhead
- **License-key-based tracking** integrated with Stripe/Polar billing is production-ready

---

## 1. Time-Series Data Storage Patterns

### 1.1 PostgreSQL with TimescaleDB vs InfluxDB

| Aspect | PostgreSQL/TimescaleDB | InfluxDB |
|--------|----------------------|----------|
| **Embedding** | Single database (no vendor lock) | Separate time-series DB |
| ** Queries** | Standard SQL,JOINs with other tables | Flux query language |
| **Tooling** | pgAdmin, DBeaver, Supabase dashboard | Telegraf, Chronograf |
| **Cost** | Lower (existing infra) | Higher (separate service) |
| **Scale** | Billion+ rows (with proper tuning) | 100M+ rows (optimized) |

**Recommendation for Sophia:** PostgreSQL/TimescaleDB

**Rationale:**
- Sophia already uses Supabase (PostgreSQL backend)
- No need for separate InfluxDB infrastructure
- SQL JOINs enable rich analytics (e.g., "usage by tier + subscription status")
- TimescaleDB provides time-series optimizations (Compression, Retention, Continuous Aggregates)

### 1.2 Schema Design for Usage Events

**Current Schema (Production, 2026-03-07):**
```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  license_key_hash TEXT NOT NULL,
  license_nonce TEXT NOT NULL,
  external_customer_id TEXT,  -- Stripe/Polar linkage
  service_name TEXT NOT NULL,  -- heygen, elevenlabs, openrouter
  endpoint TEXT NOT NULL,
  action TEXT NOT NULL,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  credits_used INTEGER NOT NULL,
  request_id TEXT,
  model_name TEXT,
  tier_at_request TEXT NOT NULL,
  status_code INTEGER,
  error_message TEXT,
  response_time_ms INTEGER,
  created_at INTEGER NOT NULL,
  idempotency_key TEXT  -- v2.1+
);
```

**Indexes for Efficient Querying:**
```sql
CREATE INDEX idx_usage_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_license ON usage_events(license_nonce);
CREATE INDEX idx_usage_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_user_time ON usage_events(user_id, created_at);
CREATE INDEX idx_usage_service_time ON usage_events(service_name, created_at);
CREATE INDEX idx_usage_tier_time ON usage_events(tier_at_request, created_at);
CREATE INDEX idx_usage_events_idempotency_key
  ON usage_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_usage_events_external_customer
  ON usage_events(external_customer_id) WHERE external_customer_id IS NOT NULL;
```

### 1.3 Indexing Strategy

| Index | Purpose | Should Exist |
|-------|---------|--------------|
| `(user_id, created_at)` | Query by tenant + time range | ✅ Yes |
| `(license_nonce)` | License-based tracking | ✅ Yes |
| `(service_name, created_at)` | Service usage analytics | ✅ Yes |
| `(tier_at_request, created_at)` | Tier-based usage analysis | ✅ Yes |
| `(external_customer_id)` | Billing reconciliation | ✅ Yes (v2.1) |
| `idempotency_key` | Prevent duplicates | ✅ Yes (v2.1) |

### 1.4 TimescaleDB Optimization (Future)

If usage grows beyond current capacity:
```sql
-- Convert to hypertable for time-series optimization
SELECT create_hypertable('usage_events', 'created_at');

-- Add compression for data older than 7 days
SELECT add_compression_policy('usage_events', interval '7 days');

-- Add retention policy (optional)
SELECT add_retention_policy('usage_events', interval '90 days');

-- Continuous aggregate for hour-level sums
CREATE MATERIALIZED VIEW hourly_usage_agg
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', created_at) AS hour,
  user_id,
  license_nonce,
  service_name,
  SUM(credits_used) AS credits,
  COUNT(*) AS requests
FROM usage_events
GROUP BY hour, user_id, license_nonce, service_name;
```

---

## 2. Usage Metering Architectures

### 2.1 Middleware-Based Tracking

**Pattern:** Track each request as it passes through middleware.

```typescript
// Example: Express middleware
app.use('/api/*', async (req, res, next) => {
  const startTime = Date.now();
  const licenseNonce = extractLicenseFromHeader(req.headers);

  // Pre-request: Get current quota
  const quota = await checkQuota(licenseNonce);

  if (!quota.allowed) {
    return res.status(429).json({ error: 'Quota exceeded' });
  }

  // Execute request
  next();

  // Post-response: Record usage
  const elapsed = Date.now() - startTime;
  trackUsage({
    userId: req.user.id,
    licenseNonce,
    service: req.service,
    action: req.action,
    creditsUsed: calculateCredits(req.service, req.action),
    responseTimeMs: elapsed,
  });
});

// Example: Next.js middleware (current pattern)
// Usage: src/middleware.ts or per-API-route tracking
```

**Pros:**
- Real-time tracking (no batching delay)
- Easy to implement with global middleware
- Error handling at request level

**Cons:**
- per-request database write overhead
- Can slow down high-throughput APIs
- Harder to batch for efficiency

### 2.2 Batch Ingestion (Current Implementation) ✅

**Pattern:** Buffer usage events and ingest in batches.

```typescript
// BatchBuffer from batch-buffer.ts
class UsageBatchBuffer {
  private buffer: Map<string, UsageEventInput> = new Map();
  private maxBatchSize = 100;
  private flushDelayMs = 5000; // Auto-flush every 5s

  public add(event: UsageEventInput): boolean {
    const key = event.idempotencyKey || generateIdempotencyKey(event);
    if (this.buffer.has(key)) return false; // Dedupe
    this.buffer.set(key, event);
    if (this.buffer.size >= this.maxBatchSize) this.flush();
  }

  public async flush(): Promise<void> {
    const events = Array.from(this.buffer.values());
    this.buffer.clear();
    // Insert all events in single transaction
  }
}
```

**Current API Endpoint:** `POST /api/v1/usage`
- Accepts up to 1000 records per batch
- Validates each record
- Enforces quotas per license
- Returns summary of accepted/rejected records

**Vercel Cron Configuration:**
```json
{
  "crons": [
    {
      "path": "/api/cron/hourly-rollup",
      "schedule": "5 * * * *",
      "comment": "Aggregate usage events into hourly summaries"
    },
    {
      "path": "/api/cron/daily-rollup",
      "schedule": "5 1 * * *",
      "comment": "Aggregate hourly summaries into daily summaries"
    }
  ]
}
```

**Pros:**
- Database write amplification reduced by 10-100x
- Batch-level validation (cheaper than per-request)
- Idempotent (recoverable from failures)
- Auto-flush handles slow rate gracefully

**Cons:**
- Data not immediately available (up to 5s delay)
- Requires retry logic for failed batches

### 2.3 Real-Time Event Emission

**Options:**
1. **WebSocket** - Full-duplex, bi-directional
2. **Server-Sent Events (SSE)** - One-way server-to-client
3. **Redis Pub/Sub** - Internal event bus
4. **Kafka/Pulsar** - Distributed streaming (heavyweight)

**When to use real-time:**
- Live dashboards needing instant updates
-警报 hệ thống khi vượt ngưỡng
- Real-time analytics (not billing)

**Sophia recommendation:** Batch + Rollup is sufficient for now.

**Why not real-time billing:**
- Billing reconciliation can tolerate 5s delay
- Rollup provides pre-aggregated data cheaper
- Real-time would require separate infrastructure (Redis/Kafka)

---

## 3. Rate Limiting & Quota Enforcement

### 3.1 Soft Limits vs Hard Limits

| Approach | Behavior | Use Case |
|----------|----------|----------|
| **Soft Limit** | Warn user, allow panic overages | Free tier, testing |
| **Hard Limit** | Block immediately at threshold | Paid tiers, abuse prevention |

**Current Implementation (aggregator.ts - QUOTA_LIMITS):**
```typescript
export const QUOTA_LIMITS: Record<string, QuotaLimit> = {
  BASIC: {
    tier: 'BASIC',
    dailyCredits: 100,
    hourlyCredits: 20,      // Hard limit
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

**Quota Check Logic (checkQuota function):**
```typescript
export async function checkQuota(
  tenantId: string,
  licenseNonce: string,
  tier: string,
  requestedCredits: number = 1
): Promise<QuotaCheckResult> {
  // Query usage for last hour, day, month
  // Compare against tier limits
  // Return: { allowed: boolean, remaining: {}, exceeded: {} }
}
```

### 3.2 Window-Based Counting

**Supported Windows:**
- **Hourly:** For burst protection (prevent API abuse)
- **Daily:** Standard usage quota
- **Monthly:** For billing reconciliation

**Current Implementation:**
```typescript
// From aggregator.ts
const hourStart = Math.floor(now / 3600) * 3600;  // Start of current hour
const dayStart = Math.floor(now / 86400) * 86400;  // Start of current day
const monthStart = Math.floor(new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
).getTime() / 1000);  // Start of current month

// Query each window separately
//Aggregate usage per window
//Compare to limits
```

### 3.3 Quota Exhaustion Handling

```typescript
// Response structure
{
  allowed: false,
  remaining: {
    dailyCredits: 0,
    hourlyCredits: 0,
    dailyRequests: 10,
    monthlyCredits: 500,
  },
  exceeded: {
    type: 'hourly_credits',
    limit: 100,
    current: 102,
  },
}
```

**Options when quota exceeded:**
1. **Return 429 Too Many Requests** - Immediately block
2. **Return 200 with warning** - Track but allow (soft limit)
3. **Defer billing** - Allow, add to next invoice (enterprise only)

Sophia currently uses **Hard Limits** (429 response).

---

## 4. Integration with Existing Systems

### 4.1 License Key Resolution

**Current Flow (tracker.ts - resolveExternalCustomerId):**
```typescript
export async function resolveExternalCustomerId(licenseNonce: string): Promise<string | null> {
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('metadata')
    .eq('nonce', licenseNonce)
    .single();

  const metadata = license.metadata as Record<string, any>;
  // Priority: polar_customer_id > stripe_customer_id
  return metadata.polar_customer_id || metadata.stripe_customer_id || null;
}
```

**License Metadata Structure:**
```json
{
  "customerEmail": "user@example.com",
  "polarSubscriptionId": "sub_123456",
  "polarCustomerId": "cust_abcdef",
  "stripeCustomerId": "cus_789xyz",
  "source": "auto-generated",
  "generatedAt": "2026-03-07T10:30:00.000Z"
}
```

### 4.2 Stripe/Polar Webhook Reconciliation

**Polar Webhook Handler (polar-webhook-handler.ts):**
```typescript
// On checkout.success / subscription.created
async function generateLicenseOnPayment(params: {
  userId: string,
  tier: Tier,
  polarCustomerId?: string,
  polarSubscriptionId?: string,
}) {
  // 1. Generate license key
  const licenseKey = generateLicenseKey(tier, expiresAt, secret);
  const nonce = extractNonce(licenseKey);

  // 2. Store license with customer ID in metadata
  await createLicense({
    tier,
    nonce,
    keyHash,
    metadata: {
      polarCustomerId,
      polarSubscriptionId,
      customerEmail,
      source: 'polar-webhook',
    }
  });
}
```

**Webhook Flow:**
```
User Payment → Polar Webhook → Process Event
                         ↓
                  Generate License
                         ↓
            Store polar_customer_id in metadata
                         ↓
                    Track Usage (automatically links)
```

**Stripe Webhook (stripe-webhook-handler.ts):**
- Similar pattern but Stripe API specific
- Uses stripe-signature header for verification
- Official Stripe SDK for signature verification

### 4.3 External Customer ID Mapping

**CSV Export with Customer Linkage:**
```typescript
export function generateCsvRows(events: Array<{...}>): CsvExportRow[] {
  return events.map(event => ({
    tenant_id: event.user_id,
    feature_key: `${event.service_name}.${event.action}`,
    timestamp: event.created_at,
    consumed_units: event.credits_used,
    license_nonce: event.license_nonce,
    service: event.service_name,
    action: event.action,
    status: event.statusCode >= 400 ? 'error' : 'success',
    external_customer_id: event.external_customer_id || null,  // ← Billing linkage
  }));
}
```

**CSV Output Example:**
```
tenant_id,feature_key,timestamp,consumed_units,license_nonce,service,action,status,external_customer_id
user-uuid,heygen.createVideo,1709251200,10,abc123,heygen,createVideo,success,cust_123456
```

---

## 5. Implementation Recommendations

### 5.1 Time-Series Database Choice

**Current:** PostgreSQL (Supabase)
**Verdict:** ✅ **Maintain current approach**

**Reasoning:**
1. Sophia uses Supabase as primary database
2. TimescaleDB extension available (can add later)
3. PostgreSQL sufficient for <10M events/month scale
4. SQL JOINs enable rich analytics without data duplication

**If scaling beyond 100M events/month:**
- Consider TimescaleDB hypertable migration
- Or InfluxDB for dedicated time-series workload

### 5.2 Data Retention Strategy

**Recommended Policy:**
| Data Type | Retention | Aggregation |
|-----------|-----------|-------------|
| Raw events | 30 days | Daily summaries |
| Hourly summaries | 1 year | No further aggregation |
| Daily summaries | Forever | Analytics archive |

**Implementation:**
```sql
-- Purge raw events older than 30 days
DELETE FROM usage_events
WHERE created_at < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')::INTEGER;

-- Weekly cleanup (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_usage_events()
RETURNS void AS $$
BEGIN
  DELETE FROM usage_events
  WHERE created_at < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')::INTEGER;
END;
$$ LANGUAGE plpgsql;
```

### 5.3 Future Enhancements

**Priority 1 (High Value, Low Effort):**
1. Add timescaleDB continuous aggregates for hourly rolls
2. Add compression policy for 7-day-old data
3. Add exponential backoff retry for failed batch ingestions

**Priority 2 (Medium Value, Medium Effort):**
1. Add Redis cache for recent quota state (reduce DB load)
2. Add websocket stream for admin real-time dashboard
3. Add anomaly detection (abuse patterns)

**Priority 3 (Low Value, High Effort):**
1. Migrate to dedicated time-series database
2. Implement distributed rate limiting (Redis Cluster)
3. Add multi-region redundancy

---

## 6. Code Examples from Existing Implementation

### 6.1 Batch Ingestion API (v1/usage)

```typescript
// POST /api/v1/usage
export async function POST(req: NextRequest) {
  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Parse and validate batch
  const { records } = await req.json();
  const parseResult = batchIngestSchema.safeParse({ records });

  // 3. Validate each record
  for (const record of records) {
    // Check license exists and is active
    // Check quota for this license
    // Validate format
  }

  // 4. Insert accepted records (batch)
  await supabase.from('usage_events').insert(acceptedRecords);

  // 5. Return results
  return NextResponse.json({
    total: records.length,
    accepted: accepted.length,
    rejected: rejected.length,
    results: ingestionResults,
  });
}
```

### 6.2 Rollup Service (Hourly/Daily)

```typescript
// Hourly rollup calculation
export async function calculateHourlyRollup(hourTimestamp: number) {
  // Get all events for this hour
  const { data: events } = await supabase
    .from('usage_events')
    .select('user_id, license_nonce, service_name, credits_used, ...')
    .gte('created_at', hourTimestamp)
    .lt('created_at', hourTimestamp + 3600);

  // Group by user + license
  const grouped = new Map();
  for (const event of events) {
    const key = `${event.user_id}:${event.license_nonce}`;
    const group = grouped.get(key) || { requests: 0, credits: 0, ... };
    group.requests += 1;
    group.credits += event.credits_used;
    grouped.set(key, group);
  }

  // Convert to summary records
  const summaries = Array.from(grouped.values());

  // Insert/Update hourly summary table
  for (const summary of summaries) {
    await upsertHourlySummary(summary);
  }
}
```

### 6.3 Quota Check with Tier Support

```typescript
export async function checkQuota(
  tenantId: string,
  licenseNonce: string,
  tier: string,
  requestedCredits: number = 1
) {
  const limit = QUOTA_LIMITS[tier];

  // Get current usage
  const hourStart = Math.floor(Date.now() / 3600) * 3600;
  const { data: hourlyData } = await supabase
    .from('usage_events')
    .select('credits_used')
    .eq('user_id', tenantId)
    .eq('license_nonce', licenseNonce)
    .gte('created_at', hourStart)
    .lt('created_at', hourStart + 3600);

  const hourlyUsed = hourlyData.reduce((sum, r) => sum + r.credits_used, 0);

  // Check if request would exceed limit
  if (hourlyUsed + requestedCredits > limit.hourlyCredits) {
    return {
      allowed: false,
      exceeded: { type: 'hourly_credits', limit: limit.hourlyCredits, current: hourlyUsed },
      remaining: { hourlyCredits: limit.hourlyCredits - hourlyUsed, ... },
    };
  }

  return { allowed: true, remaining: { ... } };
}
```

---

## 7. Unresolved Questions

| Question | Impact |建议 |
|----------|--------|------|
| **Should we add Redis cache for quota state?** | Medium - reduces DB load at high traffic | Monitor DB load first; add if latency degrades |
| **Need real-time alerts for quota exhaustion?** | Low - users get error on next request | Add if customer support reports confusion |
| **Should we add InfluxDB for future scale?** | Medium - 6-12 month horizon | Wait until 100M+ events/month threshold |
| **Need multi-tenant isolation for rollups?** | Low - tenant_id already in all tables | Verify RLS policies are active |
| **Should we add usage forecast based on trends?** | Low - nice to have | Add after stable analytics are working |

---

## 8. References

### Code Files Examined
- `/src/lib/usage-metering/aggregator.ts` - Quota enforcement, aggregation
- `/src/lib/usage-metering/tracker.ts` - Event tracking, idempotency
- `/src/lib/usage-metering/rollup-service.ts` - Hourly/daily summaries
- `/src/lib/usage-metering/batch-buffer.ts` - In-memory buffering
- `/src/lib/usage-metering/idempotency.ts` - Deduplication logic
- `/src/lib/payments/polar-webhook-handler.ts` - Pricing integration

### Database Migrations
- `20260307-create-usage-summary-tables.sql` - Hourly/daily summary tables
- `20260307-usage-metering-schema-updates.sql` - Idempotency, customer linkage

### API Endpoints
- `POST /api/v1/usage` - Batch ingestion
- `GET /api/cron/hourly-rollup` - Hourly aggregation (cron trigger)
- `GET /api/cron/daily-rollup` - Daily aggregation (cron trigger)
- `GET /api/usage/summary` - Summary view
- `GET /api/usage/export` - CSV export

---

**Report completed:** 2026-03-07
**Next steps:** Review with development team, prioritize recommendations
