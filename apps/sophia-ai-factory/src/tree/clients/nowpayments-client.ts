/**
 * NOWPayments Client - USDT TRC20 crypto payment provider
 * Uses pre-created invoice IDs.
 */

import { Tier } from '@/seed/types'
import { getOneTimeSkuByInvoiceId, ONE_TIME_INVOICE_IDS } from '@/seed/config/one-time-skus'
import type { OneTimeSku } from '@/seed/types'
import { verifyInboundWebhook } from '@/lib/webhooks/signature'

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
 * Build NOWPayments invoice checkout URL with order_id for tracking.
 * Pass customerEmail to embed it in success_url for IPN auto-handover lookup.
 */
export function createInvoiceUrl(tierId: string, userId: string, customerEmail?: string): string {
  const tierConfig = NOWPAYMENTS_TIERS[tierId]
  if (!tierConfig) {
    throw new Error(`Unknown tier: ${tierId}`)
  }

  const timestamp = Date.now()
  const orderId = `sophia_${userId}_${timestamp}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'

  const successParams = new URLSearchParams({ tier: tierId, order_id: orderId })
  if (customerEmail) successParams.set('email', encodeURIComponent(customerEmail))

  const params = new URLSearchParams({
    iid: tierConfig.invoiceId,
    order_id: orderId,
    success_url: `${appUrl}/payment-success?${successParams.toString()}`,
    cancel_url: `${appUrl}/pricing`,
  })

  return `${NOWPAYMENTS_CHECKOUT_BASE}?${params.toString()}`
}

/**
 * NOWPayments canonicalization: parse JSON and re-stringify with sorted keys.
 * This is NOWPayments IPN spec — signature covers JSON with keys in sorted order.
 */
function nowPaymentsCanonicalize(rawBody: string): string {
  const parsed = JSON.parse(rawBody) as Record<string, unknown>
  return JSON.stringify(parsed, Object.keys(parsed).sort())
}

/**
 * Verify NOWPayments IPN signature using HMAC-SHA512.
 * Signature is computed over sorted JSON keys of the request body.
 * Uses unified verifyInboundWebhook with SHA-512 + nowpayments canonicalization.
 */
export async function verifyIpnSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  return verifyInboundWebhook(rawBody, signature, secret, {
    algo: 'SHA-512',
    canonicalize: nowPaymentsCanonicalize,
  })
}

/**
 * Get tier config by invoice ID (used in IPN handler)
 */
export function getTierByInvoiceId(invoiceId: string): NowPaymentsTierConfig | null {
  return (
    Object.values(NOWPAYMENTS_TIERS).find(t => t.invoiceId === invoiceId) ?? null
  )
}

// ── One-time lookup ────────────────────────────────────────────────────────────

export type InvoiceLookup =
  | { kind: 'subscription'; tier: Tier; config: NowPaymentsTierConfig }
  | { kind: 'one_time'; sku: OneTimeSku }
  | null

/**
 * Lookup an invoice ID and return a discriminated union.
 * Checks one_time SKUs first, then subscription tiers.
 * Returns null if unknown.
 */
export function lookupInvoice(invoiceId: string): InvoiceLookup {
  // One-time SKUs take priority — they are checked first to avoid collision risk
  if (ONE_TIME_INVOICE_IDS.has(invoiceId)) {
    const sku = getOneTimeSkuByInvoiceId(invoiceId)
    if (sku) return { kind: 'one_time', sku }
  }

  const config = getTierByInvoiceId(invoiceId)
  if (config) return { kind: 'subscription', tier: config.tier, config }

  return null
}

/**
 * Build NOWPayments checkout URL for a one-time SKU.
 * Pass customerEmail for IPN auto-handover lookup when user wasn't logged in.
 */
export function createOneTimeInvoiceUrl(sku: OneTimeSku, userId: string, customerEmail?: string): string {
  const timestamp = Date.now()
  const orderId = `sophia_${userId}_${timestamp}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'

  const successParams = new URLSearchParams({ sku: sku.id, order_id: orderId })
  if (customerEmail) successParams.set('email', encodeURIComponent(customerEmail))

  const params = new URLSearchParams({
    iid: sku.invoiceId,
    order_id: orderId,
    success_url: `${appUrl}/payment-success?${successParams.toString()}`,
    cancel_url: `${appUrl}/pricing`,
  })

  return `${NOWPAYMENTS_CHECKOUT_BASE}?${params.toString()}`
}
