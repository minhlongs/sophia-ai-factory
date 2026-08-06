---
title: Phase 3 - Webhook Enhancements
description: Add new event types, idempotency for new events, enhanced audit logging
status: pending
priority: P2
effort: 1.5h
---

# Phase 3: Webhook Enhancements

## Overview

Enhance the webhook handler with new event types, improved idempotency, and comprehensive audit logging.

## Current Status

**NOT IMPLEMENTED** - Basic webhook handler exists with signature verification and idempotency.

### What's Missing:
- Enhanced audit logging for webhook events (success/failure tracking)
- Webhook retry count monitoring
- Performance timing metrics per event type

## Implementation Steps

### Step 1: Add New Event Types to Idempotency Check

**File:** `src/lib/payments/polar-webhook-handler.ts`

The existing `isEventProcessed()` function uses `polar_event_id` which works for all event types. No changes needed.

### Step 2: Enhanced Idempotency for License Generation

Prevent duplicate license generation on retry:

```typescript
async function generateLicenseOnPayment(
  params: LicenseGenerationParams & { webhookEventId: string }
): Promise<string> {
  // Check if license already generated for this webhook event
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from('raas_licenses')
    .select('nonce')
    .eq('metadata->>webhook_event_id', params.webhookEventId)
    .single()

  if (existing) {
    logger.info('[Webhook] License already generated for event', {
      eventId: params.webhookEventId,
      nonce: existing.nonce,
    })
    return existing.nonce
  }

  // ... proceed with generation ...
}
```

### Step 3: Add Webhook Event ID to Metadata

Update all license generation calls to include `webhook_event_id`:

```typescript
await createLicense({
  tier,
  nonce: parsed.nonce,
  keyHash,
  expiresAt: timestamp,
  createdBy: undefined,
  metadata: {
    polar_subscription_id: polarSubId,
    generated_by: 'webhook',
    webhook_event_id: webhookId, // NEW
    user_id: userId,
  },
})
```

### Step 4: Add Webhook Event Audit Log

**File:** `src/lib/payments/polar-webhook-handler.ts`

```typescript
async function recordWebhookAudit(
  event: PolarWebhookEvent,
  webhookId: string,
  result: 'success' | 'failure',
  details?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase()

  await supabase.from('webhook_audit_logs').insert({
    event_type: event.type,
    polar_event_id: webhookId,
    result,
    details: details ?? {},
    created_at: new Date().toISOString(),
  })
}
```

### Step 5: Update processWebhookEvent with Enhanced Logging

```typescript
export async function processWebhookEvent(
  event: PolarWebhookEvent,
  webhookId: string
): Promise<{ success: boolean; message: string }> {
  logger.info('[Webhook] Processing event', {
    type: event.type,
    eventId: webhookId,
  })

  const startTime = Date.now()

  // Idempotency check
  if (await isEventProcessed(webhookId)) {
    logger.info('[Webhook] Event already processed', { eventId: webhookId })
    return { success: true, message: 'Event already processed' }
  }

  // Record as pending
  await recordPaymentEvent({
    event_type: event.type,
    polar_event_id: webhookId,
    payload: event.data,
    processed: false,
  })

  try {
    // ... existing handlers ...

    // Mark as processed
    await recordPaymentEvent({
      event_type: event.type,
      polar_event_id: webhookId,
      payload: event.data,
      processed: true,
    })

    // Audit log
    await recordWebhookAudit(event, webhookId, 'success', {
      processingTimeMs: Date.now() - startTime,
    })

    logger.info('[Webhook] Event processed successfully', {
      type: event.type,
      eventId: webhookId,
      durationMs: Date.now() - startTime,
    })

    return { success: true, message: `Processed ${event.type}` }
  } catch (error) {
    // Error audit log
    await recordWebhookAudit(event, webhookId, 'failure', {
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: Date.now() - startTime,
    })

    logger.error('[Webhook] Event processing failed', {
      type: event.type,
      eventId: webhookId,
      error,
    })

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

### Step 6: Add Webhook Retry Handling

Polar.sh retries failed webhooks. Add retry count tracking:

```typescript
// Check webhook retry count from headers
const retryCount = headersList.get('webhook-retry-count') ?? '0'

if (parseInt(retryCount, 10) > 3) {
  logger.warn('[Webhook] High retry count', {
    eventId: webhookId,
    retryCount,
  })
  // Alert admin - might be persistent failure
}
```

## Success Criteria

- [ ] All new event types have idempotency protection
- [ ] License generation includes `webhook_event_id` in metadata
- [ ] Webhook processing time logged
- [ ] Success/failure audit logs created
- [ ] Retry count monitoring

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/payments/polar-webhook-handler.ts` | Add audit logging, idempotency enhancements |
| `src/lib/payments/polar-types.ts` | Add `WebhookAuditLog` type |

## Database Schema (Optional)

If webhook audit logs don't exist:

```sql
CREATE TABLE IF NOT EXISTS webhook_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  polar_event_id TEXT UNIQUE NOT NULL,
  result TEXT NOT NULL, -- success | failure
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_audit_logs_event_type ON webhook_audit_logs(event_type);
CREATE INDEX idx_webhook_audit_logs_polar_event_id ON webhook_audit_logs(polar_event_id);
```

## Next Steps

To implement Phase 3:

1. **Add `webhook_audit_logs` table** to database (see schema above)
2. **Update `raas-schema.ts`** with new types if needed
3. **Add `recordWebhookAudit()` function** in `polar-webhook-handler.ts`
4. **Update `processWebhookEvent()`** with timing and audit logging
5. **Add retry count monitoring** for high-frequency retries
