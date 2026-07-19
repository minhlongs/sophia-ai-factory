# Phase 1: Stripe Metered Billing Setup

## Overview
Setup Stripe Metered Billing để tính phí overage khi usage vượt quá tier limits.

## Implementation Steps

### 1.1 Tạo Stripe Products và Metered Prices

**Stripe Dashboard Steps:**
1. Vào Stripe Dashboard → Products
2. Tạo Products cho mỗi tier:
   - `AI Usage - Basic Tier`
   - `AI Usage - Premium Tier`
   - `AI Usage - Enterprise Tier`
   - `AI Usage - Master Tier`
3. Add Metered Price cho mỗi product:
   - Pricing model: "Graduated"
   - First unit: Included (theo tier quota)
   - Overage: $0.001 per credit

### 1.2 Tạo Stripe Customer Integration

**File:** `src/lib/billing/stripe-client.ts`

```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

export interface MeteredUsageReport {
  subscriptionItemId: string
  quantity: number
  timestamp: number
  action: 'increment' | 'set'
}

export async function reportMeteredUsage(
  report: MeteredUsageReport
): Promise<void> {
  await stripe.subscriptionItems.createUsageRecord(
    report.subscriptionItemId,
    {
      quantity: report.quantity,
      timestamp: report.timestamp,
      action: report.action,
    }
  )
}

export async function getMeteredUsageSummary(
  subscriptionItemId: string
): Promise<Stripe.UsageRecordSummary> {
  const summaries = await stripe.subscriptionItems.listUsageRecordSummaries(
    subscriptionItemId,
    { limit: 1 }
  )
  return summaries.data[0]
}
```

### 1.3 Stripe Metered Billing Service

**File:** `src/lib/billing/stripe-metered-billing-service.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger-utility'
import { stripe, reportMeteredUsage } from './stripe-client'
import type { Tier } from '@/types'

export interface OverageCharge {
  customerId: string
  subscriptionItemId: string
  creditsOverage: number
  chargeAmount: number // in cents
}

export interface UsageQuota {
  tier: Tier
  includedCredits: number
  overageRatePerCredit: number // in cents
}

const TIER_QUOTAS: Record<Tier, UsageQuota> = {
  BASIC: {
    tier: 'BASIC',
    includedCredits: 1000,
    overageRatePerCredit: 1, // $0.01 per credit
  },
  PREMIUM: {
    tier: 'PREMIUM',
    includedCredits: 10000,
    overageRatePerCredit: 0.8, // $0.008 per credit
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    includedCredits: 100000,
    overageRatePerCredit: 0.5, // $0.005 per credit
  },
  MASTER: {
    tier: 'MASTER',
    includedCredits: Number.POSITIVE_INFINITY,
    overageRatePerCredit: 0, // No overage
  },
}

export function getTierQuota(tier: Tier): UsageQuota {
  return TIER_QUOTAS[tier] || TIER_QUOTAS.BASIC
}

export async function calculateOverage(
  tier: Tier,
  actualCredits: number
): Promise<{ overage: number; chargeAmount: number }> {
  const quota = getTierQuota(tier)

  if (actualCredits <= quota.includedCredits) {
    return { overage: 0, chargeAmount: 0 }
  }

  const overage = actualCredits - quota.includedCredits
  const chargeAmount = Math.ceil(overage * quota.overageRatePerCredit)

  return { overage, chargeAmount }
}

export async function reportOverageToStripe(
  licenseNonce: string,
  billingPeriodStart: number,
  billingPeriodEnd: number
): Promise<void> {
  const supabase = createAdminClient()

  // Get license with Stripe customer
  const { data: license, error: licenseError } = await supabase
    .from('raas_licenses')
    .select('*')
    .eq('nonce', licenseNonce)
    .single()

  if (licenseError || !license) {
    throw new Error(`License not found: ${licenseNonce}`)
  }

  const stripeCustomerId = license.stripe_customer_id
  if (!stripeCustomerId) {
    logger.warn('No Stripe customer linked to license', { licenseNonce })
    return
  }

  // Get usage for billing period
  const { data: usage, error: usageError } = await supabase
    .from('usage_daily_summary')
    .select('total_credits')
    .eq('license_nonce', licenseNonce)
    .gte('day_timestamp', billingPeriodStart)
    .lte('day_timestamp', billingPeriodEnd)

  if (usageError) {
    throw new Error(`Failed to get usage: ${usageError.message}`)
  }

  const totalCredits = usage?.reduce((sum, day) => sum + day.total_credits, 0) || 0

  // Calculate overage
  const tier = license.tier as Tier
  const { overage, chargeAmount } = await calculateOverage(tier, totalCredits)

  if (overage === 0) {
    logger.info('No overage to report', { licenseNonce, totalCredits, tier })
    return
  }

  // Report to Stripe
  // Note: This requires subscription item ID from Stripe
  const subscriptionItemId = license.metadata?.stripe_subscription_item_id
  if (!subscriptionItemId) {
    logger.error('No subscription item ID for metered billing', { licenseNonce })
    return
  }

  await reportMeteredUsage({
    subscriptionItemId,
    quantity: overage,
    timestamp: billingPeriodEnd,
    action: 'set',
  })

  // Log overage charge
  await supabase.from('overage_charges').insert({
    license_nonce: licenseNonce,
    stripe_customer_id: stripeCustomerId,
    billing_period_start: billingPeriodStart,
    billing_period_end: billingPeriodEnd,
    total_credits: totalCredits,
    overage_credits: overage,
    charge_amount_cents: chargeAmount,
    status: 'reported',
    reported_at: new Date().toISOString(),
  })

  logger.info('Overage reported to Stripe', {
    licenseNonce,
    overage,
    chargeAmount,
    stripeCustomerId,
  })
}

export async function getCurrentBillingPeriod(): Promise<{
  start: number
  end: number
}> {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  }
}
```

## Dependencies
- Stripe account với metered billing enabled
- STRIPE_SECRET_KEY environment variable
- Stripe webhook endpoint configured

## Testing Steps
1. Tạo Stripe test customer
2. Tạo metered subscription
3. Report test usage
4. Verify overage calculation
5. Check Stripe invoice generation

## Rollback Plan
1. Backup database trước migration
2. Feature flags cho từng component
3. Stripe test mode verification trước production
