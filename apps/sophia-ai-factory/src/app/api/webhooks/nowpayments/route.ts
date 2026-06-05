/**
 * NOWPayments IPN Webhook Route
 * Verifies x-nowpayments-sig header with HMAC-SHA512, then routes to IPN handlers
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyIpnSignature } from '@/tree/clients/nowpayments-client'
import { processNowPaymentsIpn } from '@/land/billing/nowpayments-ipn-handlers'
import { ipnPayloadSchema } from '@/land/billing/ipn-payload-schema'
import { logger } from '@/seed/utils/logger-utility'
import { captureTierUpgraded } from '@/land/signals/posthog-capture'
import { track } from '@/land/signals/track'
import { D1Events } from '@/land/signals/d1-event-types'
import { emit } from '@/land/webhooks/emitter'
import { resolveUserTier } from '@/seed/db/resolve-user-tier'

function getD1ForWebhooks(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET

const MAX_BODY_BYTES = 64 * 1024 // 64KB limit — prevent memory exhaustion

export async function POST(request: NextRequest) {
  if (!NOWPAYMENTS_IPN_SECRET) {
    logger.error('[NOWPayments Webhook] NOWPAYMENTS_IPN_SECRET not configured')
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }

  // Read body with size limit (reject oversized payloads with 413)
  let rawBody = ''
  try {
    const reader = request.body?.getReader()
    if (reader) {
      const chunks: Uint8Array[] = []
      let totalSize = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalSize += value.byteLength
        if (totalSize > MAX_BODY_BYTES) {
          logger.warn('[NOWPayments Webhook] Payload too large', { size: totalSize })
          return NextResponse.json({ error: 'Payload too large (max 64KB)' }, { status: 413 })
        }
        chunks.push(value)
      }
      rawBody = new TextDecoder().decode(
        chunks.reduce((acc, chunk) => {
          const merged = new Uint8Array(acc.byteLength + chunk.byteLength)
          merged.set(acc, 0)
          merged.set(chunk, acc.byteLength)
          return merged
        }, new Uint8Array(0)),
      )
    }
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
  }

  // Verify IPN signature from x-nowpayments-sig header
  const signature = request.headers.get('x-nowpayments-sig')
  if (!signature) {
    logger.warn('[NOWPayments Webhook] Missing x-nowpayments-sig header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const isValid = await verifyIpnSignature(rawBody, signature, NOWPAYMENTS_IPN_SECRET)
  if (!isValid) {
    logger.warn('[NOWPayments Webhook] Invalid IPN signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Parse and validate IPN payload with Zod
  let parsed: ReturnType<typeof ipnPayloadSchema.safeParse>
  try {
    const raw = JSON.parse(rawBody) as unknown
    parsed = ipnPayloadSchema.safeParse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!parsed.success) {
    logger.warn('[NOWPayments Webhook] Invalid payload shape', { errors: parsed.error.flatten() })
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const ipn = parsed.data

  // Process the IPN event
  const result = await processNowPaymentsIpn(ipn)

  if (!result.success) {
    logger.error('[NOWPayments Webhook] IPN processing failed', new Error(result.message), {
      payment_id: ipn.payment_id,
      payment_status: ipn.payment_status,
    })
    track(D1Events.PAYMENT_FAILED, 'webhook', { provider: 'nowpayments', payment_id: ipn.payment_id, reason: result.message })
    return NextResponse.json({ error: result.message }, { status: 500 })
  }

  // RED-TEAM #11: emit tier_upgraded server-side only — single trust boundary
  if (ipn.payment_status === 'finished' && ipn.order_id) {
    const userId = ipn.order_id.split('_')[1] ?? ipn.order_id
    void captureTierUpgraded({ distinctId: userId, tier: ipn.invoice_id ?? 'unknown', amount: ipn.price_amount, currency: ipn.price_currency })
    track(D1Events.PAYMENT_SUCCESS, 'webhook', { amount_usd: ipn.price_amount, currency: ipn.price_currency, provider: 'nowpayments', payment_id: ipn.payment_id }, userId)
    const fromTier = await resolveUserTier(userId)
    track(D1Events.TIER_CONVERSION, userId, { from_tier: fromTier, to_tier: ipn.invoice_id ?? 'unknown', amount_usd: ipn.price_amount, provider: 'nowpayments' }, userId)

    // Emit outbound webhook event (fire-and-forget)
    const db = getD1ForWebhooks();
    if (db) {
      emit({ DB: db }, 'payment.received', {
        tenantId: userId,
        amountUsd: ipn.price_amount,
        tier: ipn.invoice_id ?? 'unknown',
        paymentId: ipn.payment_id,
        paidAt: new Date().toISOString(),
      }, userId);
    }
  }

  return NextResponse.json({ received: true })
}
