---
title: Phase 2 - Subscription Lifecycle Events
description: Handle subscription.cancelled, past_due, active, expired events for license management
status: pending
priority: P1
effort: 2h
---

# Phase 2: Subscription Lifecycle Events

## Overview

Handle subscription lifecycle events to manage license state (activate, deactivate, revoke).

## Current Status

**NOT IMPLEMENTED** - Phase 1 handles `subscription.created` and `subscription.cancelled`.

### What's Missing:
- `subscription.active` - Reactivate license when subscription becomes active after past_due
- `subscription.past_due` - Add warning to metadata (grace period before revoke)
- `subscription.expired` - Full license revoke when subscription expires

## Event Matrix

| Event | License Action | DB State |
|-------|----------------|----------|
| `subscription.created` | Create + Activate | `is_revoked=false`, `expires_at=period_end` |
| `subscription.active` | Reactivate | `is_revoked=false` |
| `subscription.past_due` | Warning (grace period) | Add warning to metadata |
| `subscription.canceled` | Deactivate (soft revoke) | `is_revoked=true`, `revoked_at=now` |
| `subscription.expired` | Full revoke | `is_revoked=true`, `revoked_at=now` |

## Implementation Steps

### Step 1: Add New Event Types to polar-types.ts

**File:** `src/lib/payments/polar-types.ts`

```typescript
export type PolarEventType =
  | 'checkout.created'
  | 'checkout.updated'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.cancelled'
  | 'subscription.active'       // NEW
  | 'subscription.past_due'     // NEW
  | 'subscription.expired'      // NEW
  | 'order.created'

export interface PolarWebhookEvent {
  type: PolarEventType
  data: Record<string, unknown>
}
```

### Step 2: Add Event Handlers to polar-webhook-handler.ts

```typescript
// NEW: Handle subscription.active (reactivation after past_due)
async function handleSubscriptionActive(data: Record<string, unknown>): Promise<void> {
  const polarSubId = safeString(data.id)
  if (!polarSubId) return

  // Find license by subscription_id
  const { reactivateLicenseBySubscription } = await import('@/lib/raas-audit')
  await reactivateLicenseBySubscription(polarSubId)

  logger.info('[Webhook] Subscription active - license reactivated', { polarSubId })
}

// NEW: Handle subscription.past_due (grace period warning)
async function handleSubscriptionPastDue(data: Record<string, unknown>): Promise<void> {
  const polarSubId = safeString(data.id)
  const { userId } = extractMetadata(data)

  // Add warning to license metadata (don't revoke yet)
  const supabase = getSupabase()
  await supabase
    .from('raas_licenses')
    .update({
      metadata: {
        past_due: true,
        past_due_at: Date.now(),
        warning_sent: true,
      },
    })
    .eq('metadata->>polar_subscription_id', polarSubId)

  // Send warning notification
  if (userId) {
    // TODO: Send email notification
    logger.info('[Webhook] Subscription past due - warning sent', { userId, polarSubId })
  }
}

// NEW: Handle subscription.cancelled (soft revoke - end of period)
async function handleSubscriptionCancelled(data: Record<string, unknown>): Promise<void> {
  const polarSubId = safeString(data.id)
  if (!polarSubId) return

  const periodEnd = safeString(data.current_period_end)

  // Soft revoke: mark as revoked but user still has access until period_end
  const { revokeLicenseBySubscription } = await import('@/lib/raas-audit')
  await revokeLicenseBySubscription(polarSubId, {
    soft: true,
    revokeAt: periodEnd ? new Date(periodEnd).getTime() / 1000 : undefined,
  })

  logger.info('[Webhook] Subscription cancelled - license soft revoked', { polarSubId })
}

// NEW: Handle subscription.expired (full revoke)
async function handleSubscriptionExpired(data: Record<string, unknown>): Promise<void> {
  const polarSubId = safeString(data.id)
  if (!polarSubId) return

  // Full revoke
  const { revokeLicenseBySubscription } = await import('@/lib/raas-audit')
  await revokeLicenseBySubscription(polarSubId, { soft: false })

  logger.info('[Webhook] Subscription expired - license revoked', { polarSubId })
}
```

### Step 3: Add raas-audit.ts Functions

**File:** `src/lib/raas-audit.ts`

```typescript
/**
 * Reactivate license by subscription ID
 */
export async function reactivateLicenseBySubscription(
  polarSubscriptionId: string
): Promise<RaasLicense> {
  const supabase = createAdminClient()

  // Find license by metadata
  const { data: license, error } = await (supabase
    .from('raas_licenses') as any)
    .select('*')
    .eq('metadata->>polar_subscription_id', polarSubscriptionId)
    .single()

  if (error || !license) {
    throw new Error(`License not found for subscription ${polarSubscriptionId}`)
  }

  // Reactivate
  const { data: updated, error: updateError } = await (supabase
    .from('raas_licenses') as any)
    .update({
      is_revoked: false,
      revoked_at: null,
      revoked_by: null,
      metadata: { ...license.metadata, reactivated_at: Date.now() },
    })
    .eq('nonce', license.nonce)
    .select()
    .single()

  if (updateError) throw updateError

  // Log audit
  await logAuditAction({
    action: 'UPDATE',
    nonce: license.nonce,
    tier: license.tier,
    timestamp: Math.floor(Date.now() / 1000),
    details: { action: 'REACTIVATE', polarSubscriptionId },
  })

  return updated as RaasLicense
}

/**
 * Revoke license by subscription ID
 */
export async function revokeLicenseBySubscription(
  polarSubscriptionId: string,
  options: { soft?: boolean; revokeAt?: number } = {}
): Promise<RaasLicense> {
  const supabase = createAdminClient()
  const revokedAt = options.revokeAt || Math.floor(Date.now() / 1000)

  // Find license by metadata
  const { data: license, error } = await (supabase
    .from('raas_licenses') as any)
    .select('*')
    .eq('metadata->>polar_subscription_id', polarSubscriptionId)
    .single()

  if (error || !license) {
    throw new Error(`License not found for subscription ${polarSubscriptionId}`)
  }

  // Revoke
  const { data: updated, error: updateError } = await (supabase
    .from('raas_licenses') as any)
    .update({
      is_revoked: true,
      revoked_at: revokedAt,
      metadata: {
        ...license.metadata,
        revoked_by_subscription: true,
        soft_revoke: options.soft ?? false,
      },
    })
    .eq('nonce', license.nonce)
    .select()
    .single()

  if (updateError) throw updateError

  // Log audit
  await logLicenseRevocation({
    nonce: license.nonce,
    tier: license.tier,
    reason: options.soft ? 'subscription_cancelled' : 'subscription_expired',
  })

  return updated as RaasLicense
}
```

### Step 4: Update processWebhookEvent Switch Statement

```typescript
export async function processWebhookEvent(
  event: PolarWebhookEvent,
  webhookId: string
): Promise<{ success: boolean; message: string }> {
  // ... existing idempotency check ...

  try {
    switch (event.type) {
      case 'checkout.updated':
        if (event.data.status === 'succeeded') {
          await handleCheckoutSuccess(event.data)
        }
        break

      case 'subscription.created':
        await handleSubscriptionCreated(event.data)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data)
        break

      case 'subscription.active':        // NEW
        await handleSubscriptionActive(event.data)
        break

      case 'subscription.past_due':      // NEW
        await handleSubscriptionPastDue(event.data)
        break

      case 'subscription.cancelled':     // NEW
        await handleSubscriptionCancelled(event.data)
        break

      case 'subscription.expired':       // NEW
        await handleSubscriptionExpired(event.data)
        break

      case 'order.created':
        await handleOrderCreated(event.data)
        break

      default:
        logger.warn('[Webhook] Unknown event type', { type: event.type })
    }

    // ... existing mark as processed ...
  }
}
```

## Success Criteria

- [ ] `subscription.active` reactivates license
- [ ] `subscription.past_due` adds warning to metadata (7-day grace period)
- [ ] `subscription.cancelled` soft-revokes license (user has access until period_end)
- [ ] `subscription.expired` fully revokes license
- [ ] Audit logs created for all lifecycle events

## Grace Period Configuration

Add to environment variables:

```env
# Grace period for past_due subscriptions (days)
LICENSE_PAST_DUE_GRACE_PERIOD_DAYS=7
```

## Next Steps

To implement Phase 2:

1. **Add new event types** to `src/lib/payments/polar-types.ts`:
   - `subscription.active`
   - `subscription.past_due`
   - `subscription.expired`

2. **Add handler functions** in `src/lib/payments/polar-webhook-handler.ts`:
   - `handleSubscriptionActive()` - Reactivate license
   - `handleSubscriptionPastDue()` - Add warning metadata
   - `handleSubscriptionExpired()` - Full revoke

3. **Add `raas-audit.ts` functions** (if not exists):
   - `reactivateLicenseBySubscription()`
   - `revokeLicenseBySubscription()` - with soft/hard revoke option

4. **Update `processWebhookEvent()`** switch statement with new cases

## Grace Period Configuration

Add to environment variables:

```env
# Grace period for past_due subscriptions (days)
LICENSE_PAST_DUE_GRACE_PERIOD_DAYS=7
```
