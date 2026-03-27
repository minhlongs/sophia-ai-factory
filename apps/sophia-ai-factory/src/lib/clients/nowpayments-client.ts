/**
 * NOWPayments Client - USDT TRC20 crypto payment provider
 * Replaces Polar.sh for billing. Uses pre-created invoice IDs.
 */

import { Tier } from '@/types'

export interface NowPaymentsTierConfig {
  tier: Tier
  invoiceId: string
  price: number        // USD
  currency: string
  name: string
}

/**
 * NOWPayments tiers with pre-created invoice IDs
 * Invoice IDs created in NOWPayments dashboard (one-time setup)
 */
export const NOWPAYMENTS_TIERS: Record<string, NowPaymentsTierConfig> = {
  BASIC: {
    tier: 'BASIC',
    invoiceId: '1531090702',
    price: 199,
    currency: 'USD',
    name: 'Starter',
  },
  PREMIUM: {
    tier: 'PREMIUM',
    invoiceId: '120104686',
    price: 399,
    currency: 'USD',
    name: 'Growth',
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    invoiceId: '1405990131',
    price: 799,
    currency: 'USD',
    name: 'Premium',
  },
  MASTER: {
    tier: 'MASTER',
    invoiceId: '307544778',
    price: 4999,
    currency: 'USD',
    name: 'Master',
  },
}

const NOWPAYMENTS_CHECKOUT_BASE = 'https://nowpayments.io/payment'

/**
 * Build NOWPayments invoice checkout URL with order_id for tracking
 */
export function createInvoiceUrl(tierId: string, orgId: string): string {
  const tierConfig = NOWPAYMENTS_TIERS[tierId]
  if (!tierConfig) {
    throw new Error(`Unknown tier: ${tierId}`)
  }

  const timestamp = Date.now()
  const orderId = `sophia_${orgId}_${timestamp}`

  const params = new URLSearchParams({
    iid: tierConfig.invoiceId,
    order_id: orderId,
  })

  return `${NOWPAYMENTS_CHECKOUT_BASE}?${params.toString()}`
}

/**
 * Verify NOWPayments IPN signature using HMAC-SHA512
 * Signature is computed over sorted JSON keys of the request body
 */
export async function verifyIpnSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>
    const sorted = JSON.stringify(parsed, Object.keys(parsed).sort())
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sorted))
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return computed === signature
  } catch {
    return false
  }
}

/**
 * Get tier config by invoice ID (used in IPN handler)
 */
export function getTierByInvoiceId(invoiceId: string): NowPaymentsTierConfig | null {
  return (
    Object.values(NOWPAYMENTS_TIERS).find(t => t.invoiceId === invoiceId) ?? null
  )
}
