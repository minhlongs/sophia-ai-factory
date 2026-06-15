# Sophia AI Factory - Usage Metering Best Practices

**Date:** 2026-03-07
**Report:** Usage metering schema, patterns, and integration analysis

---

## Executive Summary

Comprehensive analysis of Sophia AI Factory's usage metering system. Existing implementation covers most requirements with gaps in time-series optimization and Polar.sh usage-based billing integration.

**Key Finding:** The system is **production-grade** for operational metering but needs architecture improvements for scale and billing reconciliation.

---

## 1. Schema Design Recommendations

### Current Schema (`usage_events` table)

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  license_key_hash TEXT NOT NULL,
  license_nonce TEXT NOT NULL,
  service_name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  action TEXT NOT NULL,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 1,
  request_id TEXT,
  model_name TEXT,
  tier_at_request TEXT NOT NULL,
  status_code INTEGER,
  error_message TEXT,
  response_time_ms INTEGER,
  created_at BIGINT NOT NULL,
  -- NEW FIELDS NEEDED:
  idempotency_key TEXT UNIQUE,
  external_customer_id TEXT,
  resource_type TEXT
);
```

### Recommended Schema Enhancements

**Add `idempotency_key` column** (already tracked in type definitions but missing from migration):

```sql
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_idempotency ON usage_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

**Add `external_customer_id` column** (already exists in code but not in migration):

```sql
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS external_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_usage_events_external_customer ON usage_events(external_customer_id);
```

**Add time-series columns for partitioning**:

```sql
-- Hour bucket (for partition pruning)
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS hour_bucket BIGINT;
UPDATE usage_events SET hour_bucket = created_at - (created_at % 3600);

-- Day bucket (for partition pruning)
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS day_bucket BIGINT;
UPDATE usage_events SET day_bucket = created_at - (created_at % 86400);

CREATE INDEX idx_usage_events_hour_bucket ON usage_events(hour_bucket DESC);
CREATE INDEX idx_usage_events_day_bucket ON usage_events(day_bucket DESC);
```

---

## 2. Idempotency Pattern Implementation

### Current Implementation (`idempotency.ts`)

```typescript
export function generateIdempotencyKey(event: {
  requestId?: string;
  userId: string;
  licenseNonce: string;
  service: string;
  action: string;
  timestamp: number;
}): string {
  // Priority 1: Client-provided request_id
  if (event.requestId) {
    return `req_${event.requestId}`;
  }

  // Priority 2: Deterministic hash
  const hash = createHash('sha256')
    .update(`${event.userId}:${event.licenseNonce}:${event.service}:${event.action}:${Math.floor(event.timestamp / 1000)}`)
    .digest('hex');

  return `gen_${hash}`;
}
```

### Recommended: Database-Level Idempotency

Currently uses `SELECT THEN INSERT` pattern → race condition vulnerability. Fix with `INSERT ... ON CONFLICT DO NOTHING`:

```sql
-- Create unique constraint for idempotency
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_events_idempotency
  ON usage_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Atomic insert with conflict handling
INSERT INTO usage_events (...)
VALUES (...)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING id;
```

### Code Pattern (Already Implemented in `tracker.ts`)

```typescript
const { data, error } = await supabase
  .from('usage_events')
  .insert(dbEvent)
  .select('id')
  .single();

if (error && error.code === '23505') {
  return { success: false, reason: 'duplicate', existingRecordId: String(error.details) };
}
```

---

## 3. Time-Series Data Optimization

### Current Indexing Strategy

```sql
-- User lookups
CREATE INDEX idx_usage_events_user ON usage_events(user_id);
CREATE INDEX idx_usage_events_user_created ON usage_events(user_id, created_at DESC);

-- License lookups
CREATE INDEX idx_usage_events_license_nonce ON usage_events(license_nonce);

-- Service/endpoint queries
CREATE INDEX idx_usage_events_service ON usage_events(service_name);
CREATE INDEX idx_usage_events_billing ON usage_events(license_nonce, created_at, service_name);

-- Time-based queries
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at DESC);
```

### Recommended Index Optimization for Large Scale (1M+ events)

```sql
-- Composite index for common query pattern (license + date range + service)
CREATE INDEX idx_usage_events_license_period_service
  ON usage_events(license_nonce, created_at DESC, service_name)
  INCLUDE (credits_used, tokens_input, tokens_output);

-- Covering index for hourly rollup queries
CREATE INDEX idx_usage_events_rollup
  ON usage_events(hour_bucket, user_id, license_nonce)
  INCLUDE (service_name, credits_used, tokens_input, tokens_output, status_code, response_time_ms);

-- Expression index for tier queries
CREATE INDEX idx_usage_events_tier ON usage_events(tier_at_request);
```

### Time-Series Partitioning Strategy

**Pattern:** Range partitioning by day (PostgreSQL 14+)

```sql
-- Create partition template
CREATE TABLE usage_events_2026_03_07 (LIKE usage_events INCLUDING ALL);
ALTER TABLE usage_events_2026_03_07 ADD CONSTRAINT pk_usage_events_2026_03_07 PRIMARY KEY (id);

-- Attach partition
ALTER TABLE usage_events ATTACH PARTITION usage_events_2026_03_07
  FOR VALUES FROM (1741392000) TO (1741478400);

-- Auto-partitioning function (trigger-based)
CREATE OR REPLACE FUNCTION partition_usage_events()
RETURNS TRIGGER AS $$
DECLARE
  partition_name TEXT;
  start_ts BIGINT;
  end_ts BIGINT;
BEGIN
  partition_name := 'usage_events_' || to_char(to_timestamp(NEW.created_at), 'yyyy_MM_dd');
  start_ts := NEW.created_at - (NEW.created_at % 86400);
  end_ts := start_ts + 86400;

  -- Check partition exists, create if not
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I (LIKE usage_events INCLUDING ALL)',
      partition_name
    );
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT pk_%I PRIMARY KEY (id)',
      partition_name, partition_name
    );
    EXECUTE format(
      'ALTER TABLE usage_events ATTACH PARTITION %I FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_ts, end_ts
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usage_events_partition
  BEFORE INSERT ON usage_events
  FOR EACH ROW EXECUTE FUNCTION partition_usage_events();
```

### Partition Maintenance Schedule

```sql
-- Daily job: Create next day's partition
-- Weekly job: Archive old partitions to cold storage
-- Monthly job: Merge small partitions if needed
```

---

## 4. Internal API Security for `/internal/usage/report`

### Current Implementation (`internal/usage/query/route.ts`)

**Authentication:** `X-Internal-Secret` header matching `INTERNAL_WEBHOOK_SECRET`

```typescript
function validateInternalSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-secret');
  const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!expectedSecret) return false;
  if (!secret || secret !== expectedSecret) return false;
  return true;
}
```

### Security Recommendations

**1. Hash the secret in database:**

```sql
-- Store hash instead of raw secret
ALTER TABLE internal_webhook_secrets ADD COLUMN secret_hash TEXT;
UPDATE internal_webhook_secrets SET secret_hash = encode(sha256(secret::bytea), 'hex');

-- Verify hashed during auth
```

**2. Add rate limiting per secret:**

```sql
CREATE TABLE internal_webhook_rate_limits (
  secret_id UUID REFERENCES internal_webhook_secrets(id),
  window_start TIMESTAMPTZ,
  request_count INTEGER,
  UNIQUE(secret_id, window_start)
);
```

**3. Add geographic IP restrictions (optional):**

```sql
-- Track source IPs for audit
ALTER TABLE internal_webhook_events ADD COLUMN source_ip INET;

-- Create allowlist
CREATE TABLE internal_webhook_ip_allowlist (
  ip INET,
  description TEXT
);
```

**4. Log all internal queries:**

```sql
CREATE TABLE internal_webhook_audit_logs (
  id UUID PRIMARY KEY,
  secret_id UUID,
  query_params JSONB,
  response_size INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

###マイナス: Add logging trigger to usage_events

```sql
CREATE OR REPLACE FUNCTION log_internal_query()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO internal_webhook_audit_logs (secret_id, query_params, response_size, duration_ms)
  VALUES (
    get_secret_id_from_header(),
    row_to_json(NEW),
    octet_length(NEW::text),
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Polar.sh Integration Patterns

### Current Integration (`polar-webhook-handler.ts`)

**Event Flow:**
```
Polar Webhook → Signature Verification → processWebhookEvent()
  → Check idempotency (payment_events table)
  → Update license metadata
  → Emit success
```

### Usage Metering Integration Points

**1. Link usage events to Polar customer:**

```typescript
// In tracker.ts - resolveExternalCustomerId()
export async function resolveExternalCustomerId(licenseNonce: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('metadata')
    .eq('nonce', licenseNonce)
    .single();

  const metadata = license.metadata as Record<string, any>;
  return metadata.polar_customer_id || metadata.stripe_customer_id || null;
}
```

**2. Sync usage data to Polar (for consumption metering):**

```typescript
// New endpoint: /api/internal/usage/billing-sync
export async function syncUsageToPolar(licenseNonce: string, period: { start: number; end: number }) {
  const usage = await getAggregatedSummary(tenantId, start, end, licenseNonce);

  // Send to Polar Usage API
  const summary = {
    usage_records: [
      {
        timestamp: period.end,
        quantity: usage.totalCredits,
        source: 'sophia-ai-factory',
        metadata: { licenseNonce }
      }
    ]
  };

  await polarClient.post('/usage_records', summary);
}
```

**3. Usage-based pricing webhook handler:**

```typescript
// Add to polar-webhook-handler.ts
async function handleUsageReportRequested(data: Record<string, unknown>) {
  const { customer_id, period_start, period_end } = data;

  // Find license by polar_customer_id
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('nonce, tier')
    .eq('metadata->>polar_customer_id', customer_id)
    .single();

  if (!license) {
    logger.warn('[Usage Reporting] No license found for customer', { customer_id });
    return;
  }

  // Calculate usage
  const start = Math.floor(new Date(period_start).getTime() / 1000);
  const end = Math.floor(new Date(period_end).getTime() / 1000);

  const usage = await getAggregatedSummary(
    license.tier,
    start,
    end,
    license.nonce
  );

  // Submit usage report
  await polarClient.post('/usage_reports', {
    license_nonce: license.nonce,
    period: { start, end },
    totals: {
      totalRequests: usage.totalRequests,
      totalCredits: usage.totalCredits,
      totalTokensInput: usage.totalTokensInput,
    }
  });
}
```

### Usage-Based Billing Schema (PostgreSQL)

```sql
-- Track usage records submitted to Polar
CREATE TABLE polar_usage_reported (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_nonce TEXT REFERENCES raas_licenses(nonce),
  polar_customer_id TEXT,
  period_start BIGINT NOT NULL,
  period_end BIGINT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  total_tokens_input INTEGER NOT NULL DEFAULT 0,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',  -- pending | submitted | confirmed
  polar_report_id TEXT
);

CREATE INDEX idx_polar_usage_reported_license ON polar_usage_reported(license_nonce);
CREATE INDEX idx_polar_usage_reported_period ON polar_usage_reported(period_start, period_end);
CREATE INDEX idx_polar_usage_reported_status ON polar_usage_reported(status);
```

---

## 6. Middleware Implementation Patterns

### Gateway Instrumentation (`gateway-instrumentation.ts`)

**Current Implementation:**

```typescript
export async function emitUsageEvent(
  request: NextRequest,
  response: { status: number; headers?: Headers }
): Promise<void> {
  // Extract license info from headers
  const licenseInfo = extractLicenseInfo(request);

  // Calculate credits
  const creditsUsed = calculateCredits(service, action, undefined, tier);

  // Build usage event
  const event: UsageEventInput = {
    userId,
    licenseNonce,
    licenseKeyHash,
    service,
    action,
    endpoint: pathname,
    creditsUsed,
    statusCode: response.status,
    responseTimeMs,
    tierAtRequest: tier,
    resourceType: response.status === 429 ? 'rate_limited' : 'api_call',
  };

  // Track usage (async, non-blocking)
  await trackUsage(event);
}
```

### Recommended Improvements

**1. Batch emissions for high-throughput:**

```typescript
// Usage-metering/batch-emitter.ts
export class UsageEventBatcher {
  private buffer: UsageEventInput[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(private maxSize = 100, private flushMs = 5000) {
    this.flushInterval = setInterval(() => this.flush(), flushMs);
  }

  emit(event: UsageEventInput) {
    this.buffer.push(event);
    if (this.buffer.length >= this.maxSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const events = this.buffer;
    this.buffer = [];

    try {
      await supabase
        .from('usage_events')
        .insert(events.map(toDbFormat));
    } catch (error) {
      logger.error('[Batch Emitter] Failed to flush', error);
    }
  }
}
```

**2. Sampling configuration:**

```typescript
export function getSamplingRate(pathname: string): number {
  // Sample high-volume endpoints at 10%
  const highVolumeEndpoints = ['/api/chat', '/api/completions', '/api/stream'];

  if (highVolumeEndpoints.some(ep => pathname.startsWith(ep))) {
    return 0.1;
  }

  return 1.0;
}

// Configurable via env
USAGE_METERING_SAMPLE_RATE=0.1
USAGE_METERING_SAMPLE_ENDPOINTS=/api/chat,/api/stream
```

---

## 7. Quota Enforcement

### Current Quota Limits

```typescript
export const QUOTA_LIMITS = {
  BASIC: {
    dailyCredits: 100,
    hourlyCredits: 20,
    dailyRequests: 500,
    monthlyCredits: 2000,
  },
  PREMIUM: { dailyCredits: 500, hourlyCredits: 100, ... },
  ENTERPRISE: { dailyCredits: 2000, hourlyCredits: 500, ... },
  MASTER: { dailyCredits: 10000, hourlyCredits: 2000, ... },
};
```

### Recommended Improvements

**1. Move quota limits to database:**

```sql
CREATE TABLE quota_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT UNIQUE NOT NULL,
  daily_credits INTEGER NOT NULL,
  hourly_credits INTEGER NOT NULL,
  daily_requests INTEGER NOT NULL,
  monthly_credits INTEGER NOT NULL,
  reset_hour INTEGER DEFAULT 0,  -- UTC hour for reset
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO quota_limits (tier, daily_credits, hourly_credits, daily_requests, monthly_credits)
VALUES
  ('BASIC', 100, 20, 500, 2000),
  ('PREMIUM', 500, 100, 2500, 10000),
  ('ENTERPRISE', 2000, 500, 10000, 50000),
  ('MASTER', 10000, 2000, 50000, 200000);
```

**2. Add hourly bucket tracking:**

```sql
CREATE TABLE usage_hourly_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  license_nonce TEXT NOT NULL,
  hour_bucket BIGINT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  requests_used INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, license_nonce, hour_bucket)
);

CREATE INDEX idx_usage_hourly_quota_hour ON usage_hourly_quota(hour_bucket DESC);
```

**3. Atomic quota check and increment:**

```sql
CREATE OR REPLACE FUNCTION check_and_increment_quota(
  p_user_id UUID,
  p_license_nonce TEXT,
  p_credits_required INTEGER,
  p_hourly_credits_limit INTEGER,
  p_daily_credits_limit INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_hourly INTEGER,
  remaining_daily INTEGER
) AS $$
DECLARE
  v_hour_start BIGINT;
  v_hour_used INTEGER;
  v_day_start BIGINT;
  v_day_used INTEGER;
BEGIN
  v_hour_start := EXTRACT(EPOCH FROM date_trunc('hour', NOW()))::BIGINT;
  v_day_start := EXTRACT(EPOCH FROM date_trunc('day', NOW()))::BIGINT;

  -- Get current usage
  SELECT COALESCE(SUM(credits_used), 0) INTO v_hour_used
  FROM usage_hourly_quota
  WHERE user_id = p_user_id
    AND license_nonce = p_license_nonce
    AND hour_bucket = v_hour_start;

  -- Check hourly limit
  IF v_hour_used + p_credits_required > p_hourly_credits_limit THEN
    RETURN QUERY SELECT false, p_hourly_credits_limit - v_hour_used, 0;
    RETURN;
  END IF;

  -- Get daily usage (simplified - could aggregate from hourly table)
  SELECT COALESCE(SUM(credits_used), 0) INTO v_day_used
  FROM usage_hourly_quota
  WHERE user_id = p_user_id
    AND license_nonce = p_license_nonce
    AND hour_bucket >= v_day_start;

  -- Check daily limit
  IF v_day_used + p_credits_required > p_daily_credits_limit THEN
    RETURN QUERY SELECT false, p_hourly_credits_limit - v_hour_used, p_daily_credits_limit - v_day_used;
    RETURN;
  END IF;

  -- Atomic increment
  INSERT INTO usage_hourly_quota (user_id, license_nonce, hour_bucket, credits_used, requests_used)
  VALUES (p_user_id, p_license_nonce, v_hour_start, p_credits_required, 1)
  ON CONFLICT (user_id, license_nonce, hour_bucket)
  DO UPDATE SET
    credits_used = usage_hourly_quota.credits_used + p_credits_required,
    requests_used = usage_hourly_quota.requests_used + 1;

  RETURN QUERY SELECT true, p_hourly_credits_limit - v_hour_used - p_credits_required, p_daily_credits_limit - v_day_used - p_credits_required;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 8. Migration Checklist

### Database Migrations Required

```bash
# 1. Add missing columns (idempotency_key, external_customer_id)
psql "$(npx supabase db url)" -f apps/sophia-ai-factory/migrations/20260307-add-idempotency-columns.sql

# 2. Add time-series columns
psql "$(npx supabase db url)" -f apps/sophia-ai-factory/migrations/20260307-add-time-columns.sql

# 3. Create indexes for optimization
psql "$(npx supabase db url)" -f apps/sophia-ai-factory/migrations/20260307-add-indexes.sql

# 4. Add quota tracking tables
psql "$(npx supabase db url)" -f apps/sophia-ai-factory/migrations/20260307-add-quota-tables.sql

# 5. Add Polar usage reporting schema
psql "$(npx supabase db url)" -f apps/sophia-ai-factory/migrations/20260307-add-polar-usage-schema.sql
```

---

## 9. immediate Action Items

### High Priority

| Priority | Task | File to Update |
|----------|------|----------------|
| 1 | Add `idempotency_key` unique index | Migration: `20260307-add-idempotency-columns.sql` |
| 2 | Fix schema migration to include external_customer_id | `usage-events-schema.sql` |
| 3 | Implement atomic quota check function | `quota-functions.sql` |
| 4 | Add Polar usage reporting schema | `polar-usage-schema.sql` |

### Medium Priority

| Priority | Task | File to Update |
|----------|------|----------------|
| 5 | Add time-series columns for partitioning | `20260307-add-time-columns.sql` |
| 6 | Implement batch event emitter | `lib/usage-metering/batch-emitter.ts` |
| 7 | Move quota limits to database | `migration + constants.ts` |

### Low Priority

| Priority | Task | File to Update |
|----------|------|----------------|
| 8 | Add internal webhook IP allowlist | `internal-webhook-acl.sql` |
| 9 | Implement hourly rollup job | `cron-hourly-rollup.ts` |
| 10 | Add daily rollup job | `cron-daily-rollup.ts` |

---

## 10. Unresolved Questions

### Technical

1. **Partition vs Index?** For 1M+ events, should we use partitioning or rely on composite indexes?

2. **Real-time vs Batch?** Should we track 429 rate-limited requests separately or include in main table?

3. **Token billing precision?** For OpenRouter, should we bill per 1K tokens or actual tokens (would require decimal storage)?

4. **Rollup frequency?** Hourly rollup is sufficient, but do we need minute-level precision for analytics?

### Business

5. **Polar Usage API** - Does Polar support incremental usage reports, or must we send full period summaries?

6. **Grace period?** Should expired licenses get 24-hour grace period before quota enforcement?

7. **Usage carryover?** Should unused hourly credits roll over (e.g., unused 20/hr = 480/day carryover)?

8. **Free tier usage?** Should BASIC tier have different tracking (e.g., fewer metrics stored)?

---

## Appendix A: Schema Migration Summary

```sql
-- Complete migration script
-- File: apps/sophia-ai-factory/migrations/20260307-comprehensive-usage-metering.sql

-- 1. Add missing columns
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS external_customer_id TEXT;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS hour_bucket BIGINT;
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS day_bucket BIGINT;

-- 2. Populate existing data
UPDATE usage_events SET hour_bucket = created_at - (created_at % 3600);
UPDATE usage_events SET day_bucket = created_at - (created_at % 86400);

-- 3. Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_idempotency
  ON usage_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_external_customer
  ON usage_events(external_customer_id);

CREATE INDEX IF NOT EXISTS idx_usage_events_hour_bucket
  ON usage_events(hour_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_day_bucket
  ON usage_events(day_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_license_period_service
  ON usage_events(license_nonce, created_at DESC, service_name)
  INCLUDE (credits_used, tokens_input, tokens_output);

-- 4. Create quota tracking tables
-- (see Section 7 for full DDL)

-- 5. Create Polar usage reporting tables
-- (see Section 5 for full DDL)
```

---

## Appendix B: Testing Strategy

```typescript
// Usage Metering Tests
describe('Usage Metering', () => {
  describe('Idempotency', () => {
    it('should deduplicate with same idempotency key', async () => {
      // Test duplicate detection
    });

    it('should handle request_id from client', async () => {
      // Test client-provided ID priority
    });
  });

  describe('Quota Enforcement', () => {
    it('should reject requests exceeding hourly limit', async () => {
      // Test hourly quota
    });

    it('should accept requests after quota reset', async () => {
      // Test reset logic
    });
  });

  describe('Polar Integration', () => {
    it('should resolve external_customer_id from license metadata', async () => {
      // Test customer ID resolution
    });

    it('should sync usage to Polar webhook endpoint', async () => {
      // Test usage sync
    });
  });
});
```

---

## Sources

- `apps/sophia-ai-factory/src/lib/usage-metering/` (type definitions, aggregator, tracker)
- `apps/sophia-ai-factory/docs/migrations/usage-events-schema.sql`
- `apps/sophia-ai-factory/docs/migrations/raas-licenses-schema.sql`
- `apps/sophia-ai-factory/src/lib/payments/polar-webhook-handler.ts`
- `apps/sophia-ai-factory/src/app/api/v1/usage/batch/route.ts`
- `apps/sophia-ai-factory/src/app/api/internal/usage/query/route.ts`

---

**End of Report**
