/**
 * Pure validation helpers for checkout flow.
 * Keeps route handler thin; all business rules here.
 * @module checkout/checkout-validators
 */

import type { PendingOrderPeriod, PaymentMethod } from '@/land/orders/pending-order-types'

/**
 * Derive default billing period for a tier.
 * MASTER → lifetime; all others → monthly.
 */
export function derivePeriod(tier: string): PendingOrderPeriod {
  return tier === 'MASTER' ? 'lifetime' : 'monthly'
}

/**
 * Validate period is allowed for the given tier.
 * Throws if invalid.
 */
export function assertPeriodAllowed(tier: string, period: PendingOrderPeriod): void {
  if (period === 'yearly') {
    throw new Error('Yearly billing not yet enabled — please choose monthly or lifetime (MASTER)')
  }
  if (tier === 'MASTER' && period !== 'lifetime') {
    throw new Error('MASTER tier uses lifetime billing only')
  }
  if (tier !== 'MASTER' && period === 'lifetime') {
    throw new Error('Lifetime billing is only available for MASTER tier')
  }
}

/**
 * Validate payment method is allowed.
 * PayOS requires FEATURE_PAYOS=true env flag.
 */
export function assertPaymentMethodAllowed(method: PaymentMethod): void {
  if (method === 'payos') {
    const featureEnabled = process.env.FEATURE_PAYOS === 'true'
    if (!featureEnabled) {
      throw new Error('PayOS not currently available — choose nowpayments')
    }
  }
}
