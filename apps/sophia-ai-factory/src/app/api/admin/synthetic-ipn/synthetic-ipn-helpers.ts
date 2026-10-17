/**
 * Helpers for /api/admin/synthetic-ipn route handler.
 *
 * @module app/api/admin/synthetic-ipn/synthetic-ipn-helpers
 */

import { z } from 'zod'
import { getOneTimeSkuById } from '@/seed/config/one-time-skus'

type ResolvedOneTimeSku = NonNullable<ReturnType<typeof getOneTimeSkuById>>

function getCloudflareEnv(): Record<string, unknown> | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
    if (env) return env
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ]
    return ctx?.env ?? null
  } catch {
    return null
  }
}

export function getNowPaymentsIpnSecret(): string | null {
  const env = getCloudflareEnv()
  const secret = env?.NOWPAYMENTS_IPN_SECRET
  if (typeof secret === 'string') return secret
  return process.env.NOWPAYMENTS_IPN_SECRET ?? null
}

export const bodySchema = z.object({
  skuId: z.string().default('STARTER_BUNDLE'),
  userId: z.string().optional(),
})

/**
 * Build HMAC-SHA512 signature over sorted JSON keys — matches verifyIpnSignature exactly.
 */
export async function buildIpnSignature(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const sorted = JSON.stringify(payload, Object.keys(payload).sort())
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sorted))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function buildSyntheticIpnPayload(
  paymentId: string,
  orderId: string,
  sku: ResolvedOneTimeSku,
  dispatchedAt: string,
): Record<string, unknown> {
  return {
    payment_id: paymentId,
    payment_status: 'finished',
    invoice_id: sku.invoiceId,
    order_id: orderId,
    price_amount: sku.priceUsd,
    price_currency: 'USD',
    actually_paid: sku.priceUsd,
    actually_paid_at_fiat: sku.priceUsd,
    pay_currency: 'USDTTRC20',
    outcome_amount: sku.priceUsd,
    outcome_currency: 'USD',
    created_at: dispatchedAt,
    updated_at: dispatchedAt,
  }
}
