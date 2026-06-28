# Phase 2: Overage Webhook Emitter

**Date:** 2026-03-09
**Status:** In Progress
**Work Context:** `/Users/macbookprom1/mekong-cli/apps/sophia-ai-factory/apps/sophia-ai-factory`

---

## Overview

Implement webhook emitter để gửi overage events từ RaaS Gateway đến AgencyOS khi tenant vượt quota.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Quota Checker (quota-checker.ts)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ checkQuotaWithOverage()                              │   │
│  │   ↓ Exceeded detected                                │   │
│  │   → logOverageEvent() → overage_events table        │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ Trigger
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Overage Webhook Emitter (overage-webhook-emitter.ts)       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ emitOverageWebhook()                                 │   │
│  │   1. Generate event UUID (idempotency key)          │   │
│  │   2. Check KV for duplicate (7-day window)          │   │
│  │   3. Build webhook payload                          │   │
│  │   4. Sign with HMAC-SHA256                          │   │
│  │   5. POST to AgencyOS webhook URL                   │   │
│  │   6. Store UUID in KV with 7-day TTL                │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS POST
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  AgencyOS Webhook Handler (/api/webhooks/raas-overage)      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Verify HMAC signature                            │   │
│  │ 2. Check idempotency (deduplicate)                  │   │
│  │ 3. Process overage event                            │   │
│  │ 4. Trigger billing reconciliation                   │   │
│  │ 5. Return 200 OK                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Overage Webhook Emitter

**File:** `src/lib/webhooks/overage-webhook-emitter.ts`

**Functions:**
- `emitOverageWebhook(event: OverageWebhookEvent): Promise<WebhookEmissionResult>`
- `buildWebhookPayload(event: OverageWebhookEvent): WebhookPayload`
- `signWebhook(payload: string, secret: string): string`
- `checkIdempotency(eventId: string): Promise<boolean>`
- `storeIdempotency(eventId: string, ttlDays: number): Promise<void>`

**Interfaces:**
```typescript
interface OverageWebhookEvent {
  eventId: string;          // UUID for idempotency
  tenantId: string;         // agency_id
  licenseNonce: string;
  tier: string;
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  requestedCredits: number;
  endpoint?: string;
  service?: string;
  action?: string;
  timestamp: string;        // ISO 8601
  ipAddress?: string;
  userAgent?: string;
}

interface WebhookPayload {
  id: string;               // eventId
  type: 'overage.exceeded';
  data: OverageWebhookEvent;
  timestamp: string;
}
```

---

### Step 2: Create Webhook Handler in AgencyOS

**File:** `src/app/api/webhooks/raas-overage/route.ts`

**Flow:**
1. Verify HMAC signature using `RAAS_WEBHOOK_SECRET`
2. Check idempotency (prevent duplicate processing)
3. Parse and validate payload
4. Store event in `webhook_events` table
5. Trigger async billing reconciliation
6. Return 200 OK

---

### Step 3: Integrate with Quota Checker

**File:** `src/lib/quota/quota-checker.ts`

**Change:** In `logOverageEvent()`, after storing to DB:
```typescript
// Emit webhook (async, non-blocking)
emitOverageWebhook({
  eventId: crypto.randomUUID(),
  tenantId: context.userId,
  licenseNonce: context.licenseNonce,
  tier: context.tier,
  exceededType: context.exceededType,
  exceededLimit: context.exceededLimit,
  exceededCurrent: context.exceededCurrent,
  exceededBy: context.exceededBy,
  requestedCredits: context.requestedCredits,
  endpoint: context.endpoint,
  service: context.service,
  action: context.action,
  timestamp: new Date().toISOString(),
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
}).catch(err => logger.error('Overage webhook failed', err));
```

---

### Step 4: KV-Based Idempotency

**KV Namespace:** Bind to Cloudflare KV or use Upstash Redis

**Key Format:** `overage:event:{eventId}`
**TTL:** 7 days (604800 seconds)

**Check Flow:**
```typescript
async function checkIdempotency(eventId: string): Promise<boolean> {
  const kv = getKvClient();
  if (!kv) return false;  // No KV = skip idempotency

  const existing = await kv.get(`overage:event:${eventId}`);
  return !!existing;  // true = duplicate
}

async function storeIdempotency(eventId: string): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  await kv.set(`overage:event:${eventId}`, '1', {
    expirationTtl: 7 * 24 * 60 * 60  // 7 days
  });
}
```

---

### Step 5: Polar/Stripe Billing Integration

**File:** `src/lib/billing/overage-billing-trigger.ts`

**Function:** `triggerOverageBilling(event: OverageWebhookEvent): Promise<void>`

**Flow:**
1. Fetch customer info from Polar/Stripe
2. Calculate overage cost (credits × rate)
3. Create usage record in Polar/Stripe
4. Generate invoice line item
5. Store reconciliation record

**Polar API:**
```typescript
// Create usage record
POST /v1/meters/{meterId}/usage
{
  "external_customer_id": event.tenantId,
  "quantity": event.exceededBy,
  "timestamp": event.timestamp,
  "metadata": {
    "overage_event_id": event.eventId,
    "exceeded_type": event.exceededType
  }
}
```

---

## Database Schema

### New Table: webhook_events

```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) UNIQUE NOT NULL,  -- Idempotency key
  payload JSONB NOT NULL,
  signature VARCHAR(255),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  response_status INTEGER,
  response_body JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP
);

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed) WHERE NOT processed;
```

---

## Environment Variables

```bash
# Webhook Configuration
RAAS_WEBHOOK_SECRET=whsec_xxx          # HMAC signing secret
RAAS_WEBHOOK_URL=https://agencyos.network/api/webhooks/raas-overage

# Polar.sh (for billing)
POLAR_API_KEY=sk_xxx
POLAR_METER_ID=meter_xxx               # Usage meter for overage

# KV Storage (for idempotency)
CLOUDFLARE_KV_NAMESPACE=xxx
CLOUDFLARE_API_TOKEN=xxx

# Alternative: Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

---

## Testing

### Unit Tests
- `src/lib/webhooks/overage-webhook-emitter.test.ts`
  - Test payload building
  - Test HMAC signing
  - Test idempotency check

### Integration Tests
- `src/app/api/webhooks/raas-overage/route.test.ts`
  - Test signature verification
  - Test duplicate rejection
  - Test successful processing

### E2E Flow
```
1. User exceeds quota
2. Overage event logged
3. Webhook emitted
4. AgencyOS receives and verifies
5. Billing reconciliation triggered
6. Invoice created in Polar
```

---

## Security Considerations

1. **HMAC Signature:**
   - Sign payload with `RAAS_WEBHOOK_SECRET`
   - Include signature in `X-RaaS-Signature` header
   - Timestamp validation (prevent replay attacks)

2. **Idempotency:**
   - Check before processing
   - Store UUID with 7-day TTL
   - Return 200 OK for duplicates (already processed)

3. **Rate Limiting:**
   - Limit webhook retries (max 3 attempts)
   - Exponential backoff (1s, 2s, 4s)
   - Circuit breaker for repeated failures

---

## Error Handling

| Error | Response | Action |
|-------|----------|--------|
| Invalid signature | 401 Unauthorized | Log security alert |
| Duplicate event | 200 OK (deduplicated) | Return cached response |
| Invalid payload | 400 Bad Request | Log error, return details |
| Processing error | 500 Internal Server Error | Queue for retry |
| Timeout | 504 Gateway Timeout | Retry with backoff |

---

## Next Steps

1. Create `overage-webhook-emitter.ts`
2. Create webhook handler route
3. Integrate with quota-checker
4. Add Polar billing trigger
5. Write tests
6. Deploy and verify

---

## Unresolved Questions

1. Should webhooks be synchronous or queued (async)?
2. Need retry logic for failed deliveries?
3. Should AgencyOS push back new quota limits via webhook response?
