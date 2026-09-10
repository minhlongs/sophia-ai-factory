/**
 * NOWPayments Client — USDT TRC20 crypto payment provider.
 *
 * Uses @nowpaymentsio/nowpayments-sdk-nodejs for checkout creation (API-created
 * payments) and IPN webhook verification. Pre-created invoice IDs retained as
 * emergency fallback for when the NOWPayments API is unreachable.
 *
 * @module tree/clients/nowpayments-client
 */

import { NowPaymentsSDK } from '@nowpaymentsio/nowpayments-sdk-nodejs'
import type { Payment as SdkPayment } from '@nowpaymentsio/nowpayments-sdk-nodejs'
import { Tier } from '@/seed/types'
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits'
import { getOneTimeSkuById, getOneTimeSkuByInvoiceId, ONE_TIME_INVOICE_IDS } from '@/seed/config/one-time-skus'
import type { OneTimeSku } from '@/seed/types'
import { verifyInboundWebhook } from '@/seed/security/signature'

// ═══════════════════════════════════════════════════════════════════════════
// 1. SDK Factory
// ═══════════════════════════════════════════════════════════════════════════

let sdkInstance: NowPaymentsSDK | null = null

function resolveApiKey(): string {
  try {
    const g = globalThis as Record<string, unknown>
    const env = (g.__env ?? process.env) as Record<string, string | undefined>
    return env.NOWPAYMENTS_API_KEY ?? process.env.NOWPAYMENTS_API_KEY ?? ''
  } catch {
    return process.env.NOWPAYMENTS_API_KEY ?? ''
  }
}

export function createNowPaymentsSDK(): NowPaymentsSDK {
  if (sdkInstance) return sdkInstance
  const apiKey = resolveApiKey()
  if (!apiKey) throw new Error('NOWPAYMENTS_API_KEY is required for SDK operations')
  sdkInstance = new NowPaymentsSDK({
    apiKey,
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || undefined,
  })
  return sdkInstance
}

/** Reset cached SDK instance (for testing). */
export function resetNowPaymentsSDK(): void {
  sdkInstance = null
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Tier Price Config (for SDK checkout — replaces invoiceId-based lookup)
// ═══════════════════════════════════════════════════════════════════════════

export const TIER_PRICE_CONFIG: Record<string, { price: number; yearlyPrice: number; currency: string; name: string }> = {
  BASIC:      { price: UNIFIED_TIERS.BASIC.price,      yearlyPrice: UNIFIED_TIERS.BASIC.yearlyPrice,      currency: 'USD', name: UNIFIED_TIERS.BASIC.name },
  PREMIUM:    { price: UNIFIED_TIERS.PREMIUM.price,    yearlyPrice: UNIFIED_TIERS.PREMIUM.yearlyPrice,    currency: 'USD', name: UNIFIED_TIERS.PREMIUM.name },
  ENTERPRISE: { price: UNIFIED_TIERS.ENTERPRISE.price, yearlyPrice: UNIFIED_TIERS.ENTERPRISE.yearlyPrice, currency: 'USD', name: UNIFIED_TIERS.ENTERPRISE.name },
  MASTER:     { price: UNIFIED_TIERS.MASTER.price,     yearlyPrice: UNIFIED_TIERS.MASTER.yearlyPrice,     currency: 'USD', name: UNIFIED_TIERS.MASTER.name },
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SDK Checkout (NEW — API-created payments instead of pre-created invoice URLs)
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateCheckoutInput {
  tierId: string
  userId: string
  customerEmail?: string
  period?: 'monthly' | 'yearly'
}

export async function createCheckout(input: CreateCheckoutInput): Promise<{
  invoiceUrl: string
  orderId: string
  invoiceId: string
}> {
  const sdk = createNowPaymentsSDK()
  const config = TIER_PRICE_CONFIG[input.tierId]
  if (!config) throw new Error(`Unknown tier: ${input.tierId}`)

  const isYearly = input.period === 'yearly'
  if (isYearly && config.yearlyPrice === 0) {
    throw new Error(`Yearly billing not available for tier: ${input.tierId}`)
  }
  const priceAmount = isYearly ? config.yearlyPrice : config.price

  const timestamp = Date.now()
  const orderId = `sophia_${input.userId}_${timestamp}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'

  let successUrl = `${appUrl}/payment-success?tier=${input.tierId}&order_id=${orderId}`
  if (input.customerEmail) {
    successUrl += `&email=${encodeURIComponent(input.customerEmail)}`
  }

  const result = await sdk.createCheckout({
    priceAmount,
    priceCurrency: config.currency,
    orderId,
    orderDescription: `${config.name}${isYearly ? ' (Annual)' : ''}`,
    successUrl,
    cancelUrl: `${appUrl}/pricing`,
  })

  if (!result.invoice_url) {
    throw new Error('NOWPayments checkout returned empty invoice_url')
  }

  return {
    invoiceUrl: result.invoice_url,
    orderId,
    invoiceId: String(result.id ?? ''),
  }
}

export interface CreateOneTimeCheckoutInput {
  skuId: string
  userId: string
  customerEmail?: string
}

export async function createOneTimeCheckout(input: CreateOneTimeCheckoutInput): Promise<{
  invoiceUrl: string
  orderId: string
  invoiceId: string
}> {
  const sdk = createNowPaymentsSDK()
  const sku = getOneTimeSkuById(input.skuId)
  if (!sku) throw new Error(`Unknown SKU: ${input.skuId}`)

  const timestamp = Date.now()
  const orderId = `sophia_${input.userId}_${timestamp}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'

  let successUrl = `${appUrl}/payment-success?sku=${input.skuId}&order_id=${orderId}`
  if (input.customerEmail) {
    successUrl += `&email=${encodeURIComponent(input.customerEmail)}`
  }

  const result = await sdk.createCheckout({
    priceAmount: sku.priceUsd,
    priceCurrency: 'USD',
    orderId,
    orderDescription: sku.label_en,
    successUrl,
    cancelUrl: `${appUrl}/pricing`,
  })

  if (!result.invoice_url) {
    throw new Error('NOWPayments one-time checkout returned empty invoice_url')
  }

  return {
    invoiceUrl: result.invoice_url,
    orderId,
    invoiceId: String(result.id ?? ''),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. SDK Webhook Parsing (NEW — replaces custom HMAC-SHA512 + JSON.parse)
// ═══════════════════════════════════════════════════════════════════════════

/** Internal adapter output — structurally compatible with NowPaymentsIpnPayload. */
export interface IpnPayloadResult {
  payment_id: string
  payment_status: string
  pay_address?: string
  price_amount: number
  price_currency: string
  pay_amount?: number
  pay_currency?: string
  order_id?: string
  order_description?: string
  invoice_id?: string
  actually_paid?: number
  outcome_amount?: number
  outcome_currency?: string
  customer_email?: string
}

/**
 * Map SDK Payment event to internal IPN payload shape.
 * Falls back to rawPayload for fields the SDK Payment may not include
 * (customer_email, actually_paid_at_fiat, outcome_currency).
 */
export function sdkEventToInternalPayload(
  event: { type: string; payment: SdkPayment },
  rawPayload: Record<string, unknown>,
): IpnPayloadResult {
  const p = event.payment
  return {
    payment_id: String(p.payment_id ?? rawPayload.payment_id ?? ''),
    payment_status: p.payment_status ?? 'waiting',
    pay_address: (p.pay_address ?? undefined) as string | undefined,
    price_amount: Number(p.price_amount ?? rawPayload.price_amount ?? 0),
    price_currency: String(p.price_currency ?? rawPayload.price_currency ?? 'USD'),
    pay_amount: p.pay_amount != null ? Number(p.pay_amount) : undefined,
    pay_currency: (p.pay_currency ?? undefined) as string | undefined,
    order_id: (p.order_id ?? undefined) as string | undefined,
    order_description: (p.order_description ?? undefined) as string | undefined,
    invoice_id: (p.invoice_id ?? rawPayload.invoice_id) as string | undefined,
    actually_paid: p.actually_paid != null ? Number(p.actually_paid)
      : rawPayload.actually_paid != null ? Number(rawPayload.actually_paid) : undefined,
    outcome_amount: p.outcome_amount != null ? Number(p.outcome_amount)
      : rawPayload.outcome_amount != null ? Number(rawPayload.outcome_amount) : undefined,
    outcome_currency: (p.outcome_currency ?? rawPayload.outcome_currency) as string | undefined,
    customer_email: (rawPayload.customer_email ?? undefined) as string | undefined,
  }
}

/**
 * Parse and verify a NOWPayments IPN webhook using the SDK.
 * Replaces custom verifyIpnSignature() + JSON.parse() + Zod chain.
 * Zod validation is still applied in the webhook route as defense-in-depth.
 *
 * @throws {Error} if signature verification fails or event type is unexpected
 */
export function parseIpnWebhook(
  payload: Record<string, unknown>,
  signature: string,
): IpnPayloadResult {
  const sdk = createNowPaymentsSDK()
  const event = sdk.parseWebhook(payload, signature, { verify: true })
  if (event.type !== 'payment.status_changed') {
    throw new Error(`Unexpected webhook event type: ${event.type}`)
  }
  return sdkEventToInternalPayload(event, payload)
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Backward Compat — Pre-created invoice IDs (DEPRECATED)
//    Kept as emergency fallback + payout webhook support.
// ═══════════════════════════════════════════════════════════════════════════

export interface NowPaymentsTierConfig {
  tier: Tier
  invoiceId: string
  yearlyInvoiceId?: string
  price: number
  yearlyPrice: number
  currency: string
  name: string
}

/**
 * @deprecated Use createCheckout() instead. Pre-created invoice IDs retained
 * as emergency fallback. Will be removed in next release cycle.
 */
export const NOWPAYMENTS_TIERS: Record<string, NowPaymentsTierConfig> = {
  BASIC: {
    tier: 'BASIC',
    invoiceId: '5710519960',
    yearlyInvoiceId: '5710519960', // Deprecated fallback — use createCheckout() for yearly billing
    price: 199,
    yearlyPrice: 1990,
    currency: 'USD',
    name: 'Starter',
  },
  PREMIUM: {
    tier: 'PREMIUM',
    invoiceId: '4559269964',
    yearlyInvoiceId: '4559269964', // Deprecated fallback — use createCheckout() for yearly billing
    price: 399,
    yearlyPrice: 3990,
    currency: 'USD',
    name: 'Growth',
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    invoiceId: '6336799275',
    yearlyInvoiceId: '6336799275', // Deprecated fallback — use createCheckout() for yearly billing
    price: 799,
    yearlyPrice: 7990,
    currency: 'USD',
    name: 'Premium',
  },
  MASTER: {
    tier: 'MASTER',
    invoiceId: '5589879034',
    yearlyInvoiceId: '5589879034', // Deprecated fallback — use createCheckout() for yearly billing
    price: 4999,
    yearlyPrice: 0, // MASTER is lifetime only - no annual option
    currency: 'USD',
    name: 'Master',
  },
}

const NOWPAYMENTS_CHECKOUT_BASE =
  process.env.NOWPAYMENTS_CHECKOUT_BASE || 'https://nowpayments.io/payment'

/**
 * @deprecated Use createCheckout() instead. Builds URL from pre-created invoice IDs.
 * Kept for emergency fallback when NOWPayments API is unreachable.
 * Supports period for yearly billing when yearlyInvoiceId is configured.
 */
export function createInvoiceUrl(tierId: string, userId: string, customerEmail?: string, period?: 'monthly' | 'yearly'): string {
  const tierConfig = NOWPAYMENTS_TIERS[tierId]
  if (!tierConfig) throw new Error(`Unknown tier: ${tierId}`)

  const isYearly = period === 'yearly'
  const invoiceId = isYearly && tierConfig.yearlyInvoiceId ? tierConfig.yearlyInvoiceId : tierConfig.invoiceId
  if (isYearly && tierConfig.yearlyPrice === 0) {
    throw new Error(`Yearly billing not available for tier: ${tierId}`)
  }

  const timestamp = Date.now()
  const orderId = `sophia_${userId}_${timestamp}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'

  const successParams = new URLSearchParams({ tier: tierId, order_id: orderId })
  if (customerEmail) successParams.set('email', encodeURIComponent(customerEmail))

  const params = new URLSearchParams({
    iid: invoiceId,
    order_id: orderId,
    success_url: `${appUrl}/payment-success?${successParams.toString()}`,
    cancel_url: `${appUrl}/pricing`,
  })

  return `${NOWPAYMENTS_CHECKOUT_BASE}?${params.toString()}`
}

/**
 * @deprecated Use createOneTimeCheckout() instead.
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

// ── Signature verification (KEPT for payout webhook) ──────────────────────

function nowPaymentsCanonicalize(rawBody: string): string {
  const parsed = JSON.parse(rawBody) as Record<string, unknown>
  return JSON.stringify(parsed, Object.keys(parsed).sort())
}

/**
 * Verify NOWPayments IPN signature using HMAC-SHA512.
 * KEPT because the payout webhook route still uses this function
 * (SDK does not cover mass payout webhooks).
 * For regular IPN, use parseIpnWebhook() instead.
 */
export async function verifyIpnSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  return verifyInboundWebhook(rawBody, signature, secret, {
    algo: 'SHA-512',
    canonicalize: nowPaymentsCanonicalize,
  })
}

// ── Tier lookup ────────────────────────────────────────────────────────────

/**
 * @deprecated Use createCheckout() instead. Looks up tier by pre-created invoice ID.
 * Supports both monthly and yearly invoice IDs.
 */
export function getTierByInvoiceId(invoiceId: string): NowPaymentsTierConfig | null {
  return (
    Object.values(NOWPAYMENTS_TIERS).find(t => t.invoiceId === invoiceId || t.yearlyInvoiceId === invoiceId) ?? null
  )
}

// ── Invoice lookup (used by webhook route for PostHog tier resolution) ─────

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
  if (ONE_TIME_INVOICE_IDS.has(invoiceId)) {
    const sku = getOneTimeSkuByInvoiceId(invoiceId)
    if (sku) return { kind: 'one_time', sku }
  }

  const config = getTierByInvoiceId(invoiceId)
  if (config) return { kind: 'subscription', tier: config.tier, config }

  return null
}
