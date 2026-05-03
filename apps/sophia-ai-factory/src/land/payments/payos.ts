/**
 * PayOS Vietnam payment provider integration.
 * Handles VND QR code checkout + HMAC-SHA256 IPN signature verification.
 * Gated by FEATURE_PAYOS environment flag.
 * @module payments/payos
 */

import { z } from 'zod'
import { FEATURE_PAYOS } from '@/seed/config/flags'
import type { Tier } from '@/seed/types'

// ── USD to VND conversion (pin via env, fallback to market rate) ──────────────
const USD_TO_VND = Number(process.env.USD_TO_VND ?? '25000')

// ── Tier VND prices (USD * USD_TO_VND, rounded to nearest 1000 VND) ─────────
const TIER_USD_PRICES: Record<Tier, number> = {
  BASIC: 199,
  PREMIUM: 399,
  ENTERPRISE: 799,
  MASTER: 4999,
}

export interface PayOsTierConfig {
  tier: Tier
  vndAmount: number
  usdAmount: number
}

export function getPayOsTierConfig(tier: Tier): PayOsTierConfig {
  const usd = TIER_USD_PRICES[tier]
  const vnd = Math.round((usd * USD_TO_VND) / 1000) * 1000 // round to 1000 VND
  return { tier, vndAmount: vnd, usdAmount: usd }
}

// ── PayOS API types ───────────────────────────────────────────────────────────

export interface PayOsCheckoutInput {
  tier: Tier
  period: 'monthly' | 'lifetime'
  userId: string
  orderId: string
  customerEmail?: string
}

export interface PayOsCheckoutResult {
  qrUrl: string
  checkoutUrl: string
  paymentLinkId: string
  orderCode: number
  expiresAt: string
}

export interface PayOsIpnPayload {
  code: string
  desc: string
  success: boolean
  data: {
    orderCode: number
    amount: number
    description: string
    accountNumber: string
    reference: string
    transactionDateTime: string
    currency: string
    paymentLinkId: string
    code: string
    desc: string
    counterAccountBankId?: string
    counterAccountBankName?: string
    counterAccountName?: string
    counterAccountNumber?: string
    virtualAccountName?: string
    virtualAccountNumber?: string
  }
  signature: string
}

export const payOsIpnSchema = z.object({
  code: z.string(),
  desc: z.string(),
  success: z.boolean(),
  data: z.object({
    orderCode: z.number(),
    amount: z.number(),
    description: z.string(),
    accountNumber: z.string().optional(),
    reference: z.string().optional(),
    transactionDateTime: z.string().optional(),
    currency: z.string().optional(),
    paymentLinkId: z.string(),
    code: z.string().optional(),
    desc: z.string().optional(),
    counterAccountBankId: z.string().optional(),
    counterAccountBankName: z.string().optional(),
    counterAccountName: z.string().optional(),
    counterAccountNumber: z.string().optional(),
    virtualAccountName: z.string().optional(),
    virtualAccountNumber: z.string().optional(),
  }),
  signature: z.string(),
})

// ── HMAC-SHA256 signature verification ───────────────────────────────────────

/**
 * Verify PayOS IPN webhook signature using HMAC-SHA256.
 * PayOS signs: sorted key=value pairs joined by &
 */
export async function verifyPayOsSignature(
  data: Record<string, unknown>,
  signature: string,
  checksumKey: string
): Promise<boolean> {
  try {
    const sorted = Object.keys(data)
      .sort()
      .map(k => `${k}=${(data as Record<string, unknown>)[k]}`)
      .join('&')

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(checksumKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sorted))
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Timing-safe comparison
    if (computed.length !== signature.length) return false
    const a = enc.encode(computed)
    const b = enc.encode(signature)
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  } catch {
    return false
  }
}

// ── PayOS API client ──────────────────────────────────────────────────────────

interface PayOsCreatePaymentResponse {
  code: string
  desc: string
  data?: {
    paymentLinkId: string
    checkoutUrl: string
    qrCode: string
    orderCode: number
  }
}

/**
 * Create a PayOS payment link with VND QR code.
 * Calls PayOS REST API v2 (https://api-merchant.payos.vn).
 * Requires PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY env vars.
 */
export async function createPayOsInvoice(input: PayOsCheckoutInput): Promise<PayOsCheckoutResult> {
  if (!FEATURE_PAYOS) {
    throw new Error('PayOS feature flag disabled — set FEATURE_PAYOS=true to enable')
  }

  const clientId = process.env.PAYOS_CLIENT_ID
  const apiKey = process.env.PAYOS_API_KEY
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error('PayOS env vars missing: PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY')
  }

  const { tier, userId, orderId, customerEmail } = input
  const config = getPayOsTierConfig(tier)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'

  // PayOS orderCode must be a positive integer — use last 9 digits of timestamp
  const orderCode = parseInt(Date.now().toString().slice(-9))
  const description = `Sophia ${tier} - ${orderId.slice(-8)}`
  const expiredAt = Math.floor((Date.now() + 30 * 60 * 1000) / 1000) // 30 min

  const body = {
    orderCode,
    amount: config.vndAmount,
    description,
    buyerEmail: customerEmail,
    buyerName: undefined,
    returnUrl: `${appUrl}/payment-success?order_id=${orderId}&tier=${tier}`,
    cancelUrl: `${appUrl}/pricing`,
    expiredAt,
    items: [
      {
        name: `Sophia AI Factory ${tier}`,
        quantity: 1,
        price: config.vndAmount,
      },
    ],
  }

  // Compute checksum: amount + cancelUrl + description + orderCode + returnUrl
  // Per PayOS API v2 docs
  const checksumData = [
    `amount=${body.amount}`,
    `cancelUrl=${body.cancelUrl}`,
    `description=${body.description}`,
    `orderCode=${body.orderCode}`,
    `returnUrl=${body.returnUrl}`,
  ].join('&')

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(checksumKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(checksumData))
  const checksum = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const response = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': clientId,
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ ...body, signature: checksum }),
  })

  const result = await response.json() as PayOsCreatePaymentResponse

  if (result.code !== '00' || !result.data) {
    throw new Error(`PayOS API error: ${result.code} — ${result.desc}`)
  }

  return {
    qrUrl: result.data.qrCode,
    checkoutUrl: result.data.checkoutUrl,
    paymentLinkId: result.data.paymentLinkId,
    orderCode: result.data.orderCode,
    expiresAt: new Date(expiredAt * 1000).toISOString(),
  }
}

/**
 * Parse userId from PayOS description field.
 * Convention: last segment of orderId embedded in description.
 * orderId format: sophia_{userId}_{ts}
 */
export function parseUserIdFromPayOsDescription(description: string): string | null {
  // Match sophia_{userId}_{ts} pattern in description
  const match = description.match(/sophia_([^_]+)_\d+/)
  return match ? match[1] : null
}

/**
 * Re-export FEATURE_PAYOS for webhook routes.
 */
export { FEATURE_PAYOS }
