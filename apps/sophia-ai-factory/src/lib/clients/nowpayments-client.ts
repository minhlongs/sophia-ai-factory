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
    invoiceId: '5710519960',
    price: 199,
    currency: 'USD',
    name: 'Starter',
  },
  PREMIUM: {
    tier: 'PREMIUM',
    invoiceId: '4559269964',
    price: 399,
    currency: 'USD',
    name: 'Growth',
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    invoiceId: '6336799275',
    price: 799,
    currency: 'USD',
    name: 'Premium',
  },
  MASTER: {
    tier: 'MASTER',
    invoiceId: '5589879034',
    price: 4999,
    currency: 'USD',
    name: 'Master',
  },
}

const NOWPAYMENTS_CHECKOUT_BASE = 'https://nowpayments.io/payment'

/**
 * Build NOWPayments invoice checkout URL with order_id for tracking
 */
export function createInvoiceUrl(tierId: string, userId: string): string {
  const tierConfig = NOWPAYMENTS_TIERS[tierId]
  if (!tierConfig) {
    throw new Error(`Unknown tier: ${tierId}`)
  }

  const timestamp = Date.now()
  const orderId = `sophia_${userId}_${timestamp}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'

  const params = new URLSearchParams({
    iid: tierConfig.invoiceId,
    order_id: orderId,
    success_url: `${appUrl}/payment-success?tier=${tierId}&order_id=${orderId}`,
    cancel_url: `${appUrl}/pricing`,
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
    // Timing-safe comparison to prevent signature brute-force
    if (computed.length !== signature.length) return false
    const a = enc.encode(computed)
    const b = enc.encode(signature)
    return crypto.subtle.timingSafeEqual(a, b)
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
