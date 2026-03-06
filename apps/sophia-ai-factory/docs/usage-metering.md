# Usage Metering & Quota Management

> **Version:** 2.1.0 | **Status:** Production Ready | **Last Updated:** 2026-03-07

---

## Overview

Sophia AI Factory includes a comprehensive usage metering system that tracks AI service consumption (HeyGen, ElevenLabs, OpenRouter) with:
- **Real-time tracking** of API calls, tokens, and credits
- **Time-windowed aggregation** (hourly/daily summaries)
- **License-based quota enforcement** per tenant
- **Secure export** for billing and analytics
- **Idempotency protection** against duplicate billing
- **Customer linkage** for Stripe/Polar reconciliation
- **Debug tools** for development and testing

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Tracker    │────▶│  Aggregator  │────▶│   Export    │
│ (raw data)  │     │ (summaries)  │     │  (CSV/JSON) │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│usage_events │     │ hourly/daily │     │  Billing &  │
│   table     │     │  breakdown   │     │  Analytics  │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Components

| Module | File | Purpose |
|--------|------|---------|
| **Tracker** | `src/lib/usage-metering/tracker.ts` | Records raw usage events to database with idempotency and customer linkage |
| **Idempotency** | `src/lib/usage-metering/idempotency.ts` | Generates and validates idempotency keys |
| **Batch Buffer** | `src/lib/usage-metering/batch-buffer.ts` | In-memory batching with auto-flush (100 events or 5s) |
| **Aggregator** | `src/lib/usage-metering/aggregator.ts` | Aggregates events into hourly/daily windows, enforces quotas |
| **Export** | `src/lib/usage-metering/export.ts` | Generates CSV/JSON exports for billing |
| **Debug Logger** | `src/lib/usage-metering/debug-logger.ts` | Local debug logging for development |
| **Types** | `src/lib/usage-metering/types.ts` | TypeScript interfaces for all usage data |

---

## Quota Limits by Tier

Each license tier has specific quota limits that are enforced in real-time:

| Tier | Daily Credits | Hourly Credits | Daily Requests | Monthly Credits |
|------|---------------|----------------|----------------|-----------------|
| **BASIC** | 100 | 20 | 500 | 2,000 |
| **PREMIUM** | 500 | 100 | 2,500 | 10,000 |
| **ENTERPRISE** | 2,000 | 500 | 10,000 | 50,000 |
| **MASTER** | 10,000 | 2,000 | 50,000 | 200,000 |

### Quota Check Behavior

- **Fail-Open:** If database query fails, requests are allowed (prevents blocking legitimate users)
- **Per-License:** Quotas are tracked per `license_nonce`, not per user
- **Real-Time:** Checked before each API call via `checkQuota()` function

---

## CSV Export Format

Standardized CSV fields for billing compatibility:

| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | string | User UUID |
| `license_nonce` | string | License identifier (32-char hex) |
| `external_customer_id` | string | Polar or Stripe customer ID |
| `feature_key` | string | `{service}.{action}` (e.g., `heygen.createVideo`) |
| `timestamp` | number | Unix timestamp (seconds) |
| `consumed_units` | number | Credits used for this request |
| `request_count` | number | Always 1 for raw events |
| `tokens_input` | number | Input tokens (OpenRouter only) |
| `tokens_output` | number | Output tokens (OpenRouter only) |
| `service` | string | Service name: `heygen`, `elevenlabs`, `openrouter` |
| `action` | string | Action: `createVideo`, `textToSpeech`, `chatCompletion` |
| `status` | string | `success` or `error` |
| `response_time_ms` | number | API response time in milliseconds |

### CSV Injection Protection

All CSV fields are escaped to prevent formula injection attacks:
- Fields starting with `=`, `+`, `-`, `@` are prefixed with `'`
- Fields containing commas/newlines are quoted
- Double quotes within fields are escaped as `""`

---

## API Endpoints

### GET /api/usage/summary

Get aggregated usage summary for a specific period.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `period` | string | `current_month` | `current_month`, `last_month`, `last_7_days`, `last_30_days` |
| `license_nonce` | string | optional | Specific license to query |

**Response:**
```json
{
  "period": "current_month",
  "startTimestamp": 1709251200,
  "endTimestamp": 1709337600,
  "summary": [
    {
      "service_name": "heygen",
      "total_requests": 42,
      "total_tokens_input": 0,
      "total_tokens_output": 0,
      "total_credits": 42
    }
  ],
  "totalCredits": 127,
  "hourly": [...],  // Hourly breakdown
  "daily": [...],   // Daily breakdown
  "metadata": {
    "userId": "user-uuid",
    "isAdmin": false,
    "licenseNonce": "abc123",
    "exportedAt": "2026-03-07T00:00:00.000Z"
  }
}
```

---

### GET /api/usage/export

Export raw or aggregated usage data for billing/analytics.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `start` | number | yes | Unix timestamp (seconds) - start of date range |
| `end` | number | yes | Unix timestamp (seconds) - end of date range |
| `format` | string | no | `json` (default) or `csv` |
| `service` | string | no | Filter by service: `heygen`, `elevenlabs`, `openrouter` |
| `license_nonce` | string | no | Filter by specific license |

**Date Range Validation:**
- Maximum range: **90 days** (7,776,000 seconds)
- Future dates rejected
- Start must be before end

**Response (JSON):**
```json
{
  "summary": [...],
  "daily": [...],
  "events": [...],
  "aggregated": {
    "hourly": [...],
    "daily": [...],
    "totalCredits": 1234,
    "totalRequests": 567
  },
  "metadata": {
    "userId": "user-uuid",
    "service": "all",
    "startTimestamp": 1709251200,
    "endTimestamp": 1709337600,
    "totalEvents": 100,
    "totalCredits": 127,
    "totalRequests": 100,
    "exportedAt": "2026-03-07T00:00:00.000Z"
  }
}
```

**Response (CSV):**
```
tenant_id,external_customer_id,feature_key,timestamp,consumed_units,request_count,tokens_input,tokens_output,license_nonce,service,action,status,response_time_ms
user-uuid,cust_123456,heygen.createVideo,1709251200,1,1,0,0,abc123,heygen,createVideo,success,1234
```

---

## Usage Examples

### Track Usage in Code

```typescript
import { trackUsage, calculateCredits, hashLicenseKey, resolveExternalCustomerId } from '@/lib/usage-metering';

// Before API call
const startTime = Date.now();
const licenseKeyHash = hashLicenseKey(licenseKey);

// Optional: Manually lookup customer ID (automatic in trackUsage)
const customerId = await resolveExternalCustomerId(licenseNonce);
console.log(`External customer ID: ${customerId}`);

// After successful API call
await trackUsage({
  userId: 'user-uuid',
  licenseKeyHash,
  licenseNonce: 'abc123',
  service: 'openrouter',
  endpoint: '/chat/completions',
  action: 'chat_completion',
  tokensInput: 150,
  tokensOutput: 42,
  creditsUsed: calculateCredits('openrouter', 'chatCompletion', 192, 'PREMIUM'),
  tierAtRequest: 'PREMIUM',
  statusCode: 200,
  responseTimeMs: Date.now() - startTime,
});
```

### Check Quota Before API Call

```typescript
import { checkQuota } from '@/lib/usage-metering';

const quota = await checkQuota(
  'user-uuid',      // tenantId
  'abc123',         // licenseNonce
  'PREMIUM',        // tier
  1                 // requestedCredits
);

if (!quota.allowed) {
  return NextResponse.json({
    error: 'Quota exceeded',
    exceeded: quota.exceeded,
    remaining: quota.remaining,
  }, { status: 429 });
}

// Proceed with API call...
```

### Export Usage for Billing

```bash
# Export JSON for current month
curl -H "Authorization: Bearer $USER_TOKEN" \
  "https://sophia-ai-factory.vercel.app/api/usage/export?start=1709251200&end=1709337600&format=json"

# Download CSV for last 30 days
curl -H "Authorization: Bearer $USER_TOKEN" \
  -o usage-export.csv \
  "https://sophia-ai-factory.vercel.app/api/usage/export?start=1706659200&end=1709337600&format=csv"

# Get summary for specific license
curl -H "Authorization: Bearer $USER_TOKEN" \
  "https://sophia-ai-factory.vercel.app/api/usage/summary?period=current_month&license_nonce=abc123"
```

---

## Credit Calculation Rules

| Service | Action | Billing Type | Base Credits |
|---------|--------|--------------|--------------|
| HeyGen | createVideo | per-call | 1 credit |
| ElevenLabs | textToSpeech | per-call | 1 credit |
| OpenRouter | chatCompletion | per-1k-tokens | 1 credit per 1000 tokens |

### Tier Discounts

Credits are divided by tier multiplier (lower tier = pay more):

| Tier | Multiplier | Effective Rate |
|------|------------|----------------|
| BASIC | 1.0 | 100% of base price |
| PREMIUM | 0.8 | 80% (20% discount) |
| ENTERPRISE | 0.6 | 60% (40% discount) |
| MASTER | 0.5 | 50% (50% discount) |

**Example:** A PREMIUM user making an OpenRouter call with 192 tokens:
- Base: `ceil(192 / 1000) = 1 credit`
- After discount: `ceil(1 / 0.8) = 2 credits`

---

## Database Schema

### usage_events Table

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  license_key_hash TEXT NOT NULL,
  license_nonce TEXT NOT NULL,
  external_customer_id TEXT,  -- Polar or Stripe customer ID for billing reconciliation
  service_name TEXT NOT NULL,
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
  created_at INTEGER NOT NULL  -- Unix timestamp
);
```

### Indexes

```sql
-- User queries
CREATE INDEX idx_usage_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_license ON usage_events(license_nonce);

-- Time-based queries
CREATE INDEX idx_usage_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_user_time ON usage_events(user_id, created_at);

-- Aggregation queries
CREATE INDEX idx_usage_service_time ON usage_events(service_name, created_at);
CREATE INDEX idx_usage_tier_time ON usage_events(tier_at_request, created_at);
```

---

## Security Considerations

### Authentication & Authorization

- **All endpoints require Supabase Auth** - Users must be logged in
- **Users see only their own data** - RLS policies enforce isolation
- **Admins see all data** - Admin role bypasses user filtering
- **License ownership verification** - Users can only query their own licenses

### Rate Limiting (Future)

Currently no rate limiting on export endpoints. Recommended for production:
- Max 10 export requests per minute per user
- Max 90-day range per request (already enforced)

### CSV Injection Protection

All CSV fields are escaped to prevent formula injection attacks in spreadsheet applications. See "CSV Injection Protection" section above.

---

## Troubleshooting

### Common Errors

**"Quota exceeded"**
- User has reached their tier limit for hourly/daily/monthly credits or requests
- Solution: Upgrade tier or wait for window to reset

**"Date range exceeds maximum"**
- Requested date range > 90 days
- Solution: Split into multiple requests with smaller ranges

**"Unauthorized" / "Forbidden"**
- User not logged in or querying someone else's license
- Solution: Verify authentication and license ownership

### Monitoring

Check usage tracking in Supabase Dashboard:
```sql
-- Recent usage by user
SELECT user_id, service_name, COUNT(*), SUM(credits_used)
FROM usage_events
WHERE created_at > (EXTRACT(EPOCH FROM NOW()) - 86400)::integer
GROUP BY user_id, service_name;

-- Quota utilization
SELECT
  license_nonce,
  tier_at_request,
  SUM(credits_used) as daily_credits,
  COUNT(*) as daily_requests
FROM usage_events
WHERE created_at > (EXTRACT(EPOCH FROM NOW()) - 86400)::integer
GROUP BY license_nonce, tier_at_request;
```

---

## Future Enhancements

### Planned (Phase 10+)

1. **Quota Enforcement UI** - Dashboard widgets showing usage vs limits
2. **Analytics Dashboard** - Charts and graphs for usage visualization
3. **Rate Limiting** - API-level rate limiting on export endpoints
4. **Unit Tests** - Dedicated test suite for aggregator/export modules
5. **Decimal.js Precision** - Financial-accuracy credit calculations

### Backlog

- Real-time usage alerts (email/Slack when approaching quota)
- Custom quota limits per tenant (enterprise feature)
- Usage forecasting based on historical patterns
- Welford's algorithm for precise running averages

---

## Debug Tools (v2.0+)

### Environment Variables

```bash
# Enable debug logging
DEBUG_USAGE_METERING=true
USAGE_DEBUG_LOG_FILE=/tmp/usage_debug.log
```

### Mock Endpoint

Generate and clear mock usage data for testing.

**Generate Mock Data:**
```bash
curl "http://localhost:3000/api/usage/mock?count=20&license_nonce=test123"
```

**Clear Mock Data:**
```bash
curl -X DELETE "http://localhost:3000/api/usage/mock"
```

### Debug Query Endpoint

Query recent usage events with filters.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `license_nonce` | string | - | Filter by license |
| `limit` | number | 50 | Max events (1-500) |
| `offset` | number | 0 | Pagination offset |
| `service` | string | - | Filter: heygen, elevenlabs, openrouter |
| `start` | number | - | Start timestamp (Unix seconds) |
| `end` | number | - | End timestamp (Unix seconds) |

**Example:**
```bash
curl "http://localhost:3000/api/usage/debug?license_nonce=test123&limit=10&service=heygen"
```

### Reconciliation Admin Endpoint

Admin-only endpoint for comprehensive usage reconciliation.

**Requires:** Basic Authentication with admin credentials

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `license_nonce` | string | - | Filter by license |
| `customer_id` | string | - | Filter by Polar/Stripe customer ID |
| `service` | string | - | Filter by service |
| `start` | number | - | Start timestamp (Unix seconds) |
| `end` | number | - | End timestamp (Unix seconds) |
| `include_raw` | boolean | false | Include full event payloads |
| `analyze` | boolean | true | Include reconciliation analysis |

**Response:**
```json
{
  "summary": {
    "totalEvents": 150,
    "totalCredits": 245,
    "totalRequests": 150,
    "duplicateCount": 3,
    "failedCount": 1
  },
  "reconciliation": {
    "recordedCredits": 245,
    "billedCredits": 250,
    "discrepancy": -5,
    "anomalies": [],
    "quotaCompliance": {
      "hourly": { "used": 45, "limit": 100, "status": "ok" },
      "daily": { "used": 245, "limit": 500, "status": "ok" }
    }
  },
  "events": [...]
}
```

**Example:**
```bash
curl -H "Authorization: Basic $ADMIN_CREDS" \
  "http://localhost:3000/api/admin/usage/reconciliation?license_nonce=test123&include_raw=true"
```
# Usage Metering - Reference

> **Reference:** 2.1.0 | **Last Updated:** 2026-03-07

---

## resolveExternalCustomerId()

### Purpose

Automatically resolves external customer IDs (Polar/Stripe) from license metadata for billing reconciliation.

### Signature

```typescript
import { resolveExternalCustomerId } from '@/lib/usage-metering';

async function resolveExternalCustomerId(licenseNonce: string): Promise<string | null>
```

### Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `licenseNonce` | string | yes | License nonce to look up |

### Returns

| Type | Description |
|------|-------------|
| `string` | External customer ID (Polar or Stripe) |
| `null` | No external customer ID found |

### Behavior

1. Queries `raas_licenses` table by nonce
2. Extracts `metadata` JSON field
3. Returns `polar_customer_id` if present (higher priority)
4. Falls back to `stripe_customer_id` if Polar ID not found
5. Returns `null` if neither exists

### Usage Examples

**Automatic Resolution (Recommended):**
```typescript
import { trackUsage } from '@/lib/usage-metering';

// Customer ID automatically resolved from license metadata
await trackUsage({
  userId: 'user-uuid',
  licenseKeyHash: '...',
  licenseNonce: 'abc123',
  service: 'openrouter',
  action: 'chatCompletion',
  creditsUsed: 1,
  tierAtRequest: 'PREMIUM',
});
```

**Manual Lookup:**
```typescript
import { resolveExternalCustomerId } from '@/lib/usage-metering';

const customerId = await resolveExternalCustomerId('abc123');

if (customerId) {
  await stripe.customers.create({
    id: customerId,
    email: user.email,
    metadata: { licenseNonce: 'abc123' },
  });
}
```

**Debug View:**
```typescript
const customerId = await resolveExternalCustomerId('abc123');

if (!customerId) {
  console.warn('No customer linked to this license');
}
```

### Integration with Webhooks

When Polar.sh webhooks process payments, they store customer IDs in license metadata:

```typescript
await createLicense({
  tier,
  nonce,
  metadata: {
    polarCustomerId,
    polarSubscriptionId,
  }
});
```

### Error Handling

Errors are caught internally and return `null`. This prevents database issues from blocking usage tracking.

---

## CSV Export Format

Standardized CSV fields for billing compatibility:

| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | string | User UUID |
| `license_nonce` | string | License identifier (32-char hex) |
| `external_customer_id` | string | Polar or Stripe customer ID |
| `feature_key` | string | `{service}.{action}` (e.g., `heygen.createVideo`) |
| `timestamp` | number | Unix timestamp (seconds) |
| `consumed_units` | number | Credits used for this request |
| `request_count` | number | Always 1 for raw events |
| `tokens_input` | number | Input tokens (OpenRouter only) |
| `tokens_output` | number | Output tokens (OpenRouter only) |
| `service` | string | Service name: `heygen`, `elevenlabs`, `openrouter` |
| `action` | string | Action: `createVideo`, `textToSpeech`, `chatCompletion` |
| `status` | string | `success` or `error` |
| `response_time_ms` | number | API response time in milliseconds |

### CSV Injection Protection

All CSV fields are escaped:
- Fields starting with `=`, `+`, `-`, `@` are prefixed with `'`
- Fields containing commas/newlines are quoted
- Double quotes within fields are escaped as `""`

---

## Database Schema

### usage_events Table

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  license_key_hash TEXT NOT NULL,
  license_nonce TEXT NOT NULL,
  external_customer_id TEXT,
  service_name TEXT NOT NULL,
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
  created_at INTEGER NOT NULL
);
```

### Indexes

```sql
CREATE INDEX idx_usage_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_license ON usage_events(license_nonce);
CREATE INDEX idx_usage_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_user_time ON usage_events(user_id, created_at);
CREATE INDEX idx_usage_service_time ON usage_events(service_name, created_at);
CREATE INDEX idx_usage_tier_time ON usage_events(tier_at_request, created_at);
```

---

## Customer Linkage (v2.1+)

### How It Works

When `trackUsage()` is called without `externalCustomerId`:

1. Tracker calls `resolveExternalCustomerId(licenseNonce)`
2. Queries `raas_licenses.metadata` for `polar_customer_id` or `stripe_customer_id`
3. Stores result in `usage_events.external_customer_id`

###Automatic Resolution Flow

```
User API Request → trackUsage() → resolveExternalCustomerId()
                                ↓
                         Query raas_licenses
                                ↓
                    Check metadata.polar_customer_id
                                ↓
                      Check metadata.stripe_customer_id
                                ↓
                       Store in usage_events
```

### Phase 3 Webhook Integration

Checkout webhooks store customer IDs in `raas_licenses.metadata`:

```json
{
  "polar_customer_id": "cust_123456",
  "polar_subscription_id": "sub_789012",
  "stripe_customer_id": "cus_abcdef",
  "customerEmail": "user@example.com",
  "source": "polar-webhook"
}
```

### Reconciliation Workflow

```typescript
// Export with customer linkage
const exportResult = await exportUsage({
  startTimestamp: 1709251200,
  endTimestamp: 1709337600,
  format: 'csv',
});
```

CSV output includes:
```
tenant_id,license_nonce,external_customer_id,consumed_units,...
user-uuid,abc123,cust_123456,10
```

### Admin Reconciliation Endpoint

```bash
# By customer ID
curl -H "Authorization: Basic $ADMIN_CREDS" \
  "http://localhost:3000/api/admin/usage/reconciliation?customer_id=cust_123456"

# By license nonce
curl -H "Authorization: Basic $ADMIN_CREDS" \
  "http://localhost:3000/api/admin/usage/reconciliation?license_nonce=abc123"
```

---

## See Also

- **[Reference](./usage-metering/reference.md)** - Technical reference with full API details, schema, and code examples
- **[System Architecture](system-architecture.md)** - Overall system design
- **[Code Standards](code-standards.md)** - TypeScript type definitions
- **[Project Roadmap](development-roadmap.md)** - Phase 10 tracking
