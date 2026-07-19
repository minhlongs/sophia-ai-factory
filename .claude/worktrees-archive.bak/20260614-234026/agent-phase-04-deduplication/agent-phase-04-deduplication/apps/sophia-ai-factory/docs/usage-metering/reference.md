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
