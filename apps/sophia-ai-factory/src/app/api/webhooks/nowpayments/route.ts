/**
 * NOWPayments IPN Webhook Route
 * Verifies x-nowpayments-sig header with HMAC-SHA512, then routes to IPN handlers
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyIpnSignature } from '@/tree/clients/nowpayments-client'
import { processNowPaymentsIpn } from '@/land/billing/nowpayments-ipn-handlers'
import { ipnPayloadSchema } from '@/land/billing/ipn-payload-schema'
import { logger } from '@/seed/utils/logger-utility'
import { captureTierUpgraded } from '@/lib/signals/posthog-capture'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET

export async function POST(request: NextRequest) {
  if (!NOWPAYMENTS_IPN_SECRET) {
    logger.error('[NOWPayments Webhook] NOWPAYMENTS_IPN_SECRET not configured')
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }

  const rawBody = await request.text()

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
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
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
    track(D1Events.TIER_CONVERSION, userId, { from_tier: 'BASIC', to_tier: ipn.invoice_id ?? 'unknown', amount_usd: ipn.price_amount, provider: 'nowpayments' }, userId)
  }

  return NextResponse.json({ received: true })
}
