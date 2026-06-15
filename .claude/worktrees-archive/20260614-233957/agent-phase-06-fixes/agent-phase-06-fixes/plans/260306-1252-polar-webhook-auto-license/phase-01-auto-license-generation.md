---
title: Phase 1 - Auto-License Generation on Payment Success
description: Generate RaaS license key when subscription.created or checkout.updated succeeds
status: complete
priority: P1
effort: 2h
---

# Phase 1: Auto-License Generation

## Overview

Automatically generate a RaaS license key when a payment succeeds via Polar.sh.

## Events to Handle

| Event | Trigger | Action |
|-------|---------|--------|
| `subscription.created` | New subscription activated | Generate license |
| `checkout.updated` | One-time payment succeeded | Generate license |
| `order.created` | Order completed | Generate license |

## Implementation Steps

### Step 1: Add License Generation to Webhook Handler

**File:** `src/lib/payments/polar-webhook-handler.ts`

Add `generateLicenseOnPayment()` function:

```typescript
async function handleSubscriptionCreated(data: Record<string, unknown>): Promise<void> {
  const { userId, tier, telegramChatId } = extractMetadata(data)
  if (!userId) return

  const resolvedTier = tier || 'PREMIUM'
  const periodEnd = safeString(data.current_period_end)
  const polarSubId = safeString(data.id)
  if (!polarSubId) return

  // EXISTING: Activate subscription
  await activateSubscription(userId, polarSubId, resolvedTier, periodEnd)

  // NEW: Generate license key
  await generateLicenseOnPayment({
    userId,
    tier: resolvedTier,
    polarSubscriptionId: polarSubId,
    expiresAt: periodEnd,
    telegramChatId,
  })

  if (telegramChatId) {
    await notifySubscriptionActivated(telegramChatId, resolvedTier)
  }
}
```

### Step 2: Create License Generation Service

**File:** `src/lib/payments/polar-webhook-handler.ts` (new function)

```typescript
interface LicenseGenerationParams {
  userId: string
  tier: Tier
  polarSubscriptionId: string
  expiresAt: string | null
  telegramChatId: string | null
}

async function generateLicenseOnPayment(
  params: LicenseGenerationParams
): Promise<void> {
  const { userId, tier, polarSubscriptionId, expiresAt } = params

  // Import key generator
  const { generateLicenseKey } = await import('@/lib/raas-key-generator')
  const { createLicense, logLicenseCreation } = await import('@/lib/raas-audit')
  const { createHash } = await import('crypto')

  const secret = process.env.RAAS_LICENSE_SECRET
  if (!secret) {
    logger.error('[Webhook] RAAS_LICENSE_SECRET not configured')
    throw new Error('License secret not configured')
  }

  // Calculate expiration timestamp
  const expiresAtDate = expiresAt ? new Date(expiresAt) : null
  const timestamp = expiresAtDate
    ? Math.floor(expiresAtDate.getTime() / 1000)
    : 0 // 0 = perpetual (fallback)

  // Generate license key
  const tierLower = tier.toLowerCase() as Parameters<typeof generateLicenseKey>[0]
  const expiresDate = expiresAtDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  const licenseKey = generateLicenseKey(tierLower, expiresDate, secret)

  // Parse key components
  const parsed = parseLicenseKey(licenseKey)
  if (!parsed) {
    throw new Error('Failed to parse generated license key')
  }

  // Create key hash for secure storage
  const keyHash = createHash('sha256').update(licenseKey).digest('hex')

  // Store in database
  await createLicense({
    tier,
    nonce: parsed.nonce,
    keyHash,
    expiresAt: timestamp,
    createdBy: undefined, // System-generated
    metadata: {
      polar_subscription_id: polarSubscriptionId,
      generated_by: 'webhook',
      user_id: userId,
    },
  })

  // Log audit action
  await logLicenseCreation({
    nonce: parsed.nonce,
    tier,
    timestamp: Math.floor(Date.now() / 1000),
    ipAddress: undefined,
    userAgent: undefined,
  })

  logger.info('[Webhook] License generated on payment', {
    userId,
    tier,
    polarSubscriptionId,
    nonce: parsed.nonce,
  })

  // TODO: Send license key to user (email or dashboard notification)
}
```

### Step 3: Update `checkout.updated` Handler

```typescript
async function handleCheckoutSuccess(data: Record<string, unknown>): Promise<void> {
  const { userId, tier, telegramChatId } = extractMetadata(data)
  if (!userId || !tier) return

  const dbTier = TIER_DB_MAPPING[tier]
  const supabase = getSupabase()
  const polarSubId = safeString(data.id)
  if (!polarSubId) return

  // Update user profile
  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: dbTier,
      subscription_status: 'active',
      polar_subscription_id: polarSubId,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('user_id', userId)

  if (error) throw error

  // NEW: Generate license
  await generateLicenseOnPayment({
    userId,
    tier,
    polarSubscriptionId: polarSubId,
    expiresAt: null, // One-time purchase, no expiration
    telegramChatId,
  })

  if (telegramChatId) {
    await notifySubscriptionActivated(telegramChatId, tier)
  }
}
```

### Step 4: Update `order.created` Handler

Same pattern as `checkout.updated` - call `generateLicenseOnPayment()`.

## Status

**COMPLETED** - Phase 1 implementation verified in `src/lib/payments/polar-webhook-handler.ts`

### Implementation Verified:
- `generateLicenseOnPayment()` - Auto-generates license on `checkout.updated`, `subscription.created`, `order.created`
- License stored in `raas_licenses` with metadata including `polarSubscriptionId` and `customerEmail`
- Audit log created in `raas_audit_logs` with timestamp and createdBy='polar-webhook'
- Idempotency via `payment_events` table using `polar_event_id`

### Code Location:
- Handler: `src/lib/payments/polar-webhook-handler.ts` (lines 40-120)
- Webhook Route: `src/app/api/webhooks/polar/route.ts`

## Success Criteria (Verified)

- [x] License generated on `subscription.created` webhook
- [x] License generated on `checkout.updated` webhook (status: succeeded)
- [x] License generated on `order.created` webhook
- [x] License stored in `raas_licenses` table with `polarSubscriptionId` metadata
- [x] Audit log created in `raas_audit_logs`
- [x] No duplicate licenses (idempotency via `payment_events` table)

```typescript
// Unit test: generateLicenseOnPayment
describe('generateLicenseOnPayment', () => {
  it('generates valid license key on subscription created', async () => {
    const result = await generateLicenseOnPayment({
      userId: 'test-user',
      tier: 'PREMIUM',
      polarSubscriptionId: 'sub_123',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      telegramChatId: null,
    })

    // Verify license stored in DB
    const license = await getLicenseByNonce(result.nonce)
    expect(license).toBeDefined()
    expect(license.tier).toBe('PREMIUM')
    expect(license.metadata.polar_subscription_id).toBe('sub_123')
  })
})
```

## Risks

- **Race condition**: Webhook retry could generate duplicate licenses
  - **Mitigation**: Idempotency check via `payment_events` table (already implemented)
- **Secret missing**: `RAAS_LICENSE_SECRET` not configured in production
  - **Mitigation**: Throw error and log clearly

## Notes

Phase 1 fully implemented and operational. License key auto-generation on payment success is in production use via Polar.sh webhooks.

See Phase 2 for subscription lifecycle event handling (cancel, past_due, active, expired).
