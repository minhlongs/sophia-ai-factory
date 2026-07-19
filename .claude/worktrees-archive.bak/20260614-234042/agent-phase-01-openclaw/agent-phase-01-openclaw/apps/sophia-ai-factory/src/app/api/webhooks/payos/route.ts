/**
 * PayOS IPN Webhook Route
 * Verifies x-checksum header with HMAC-SHA256, activates tier on successful payment.
 * Gated by FEATURE_PAYOS — returns 503 when flag is off.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
verifyPayOsWebhook,
payOsIpnSchema,
parseUserIdFromPayOsDescription,
FEATURE_PAYOS,
} from '@/land/payments/payos'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import type { Tier } from '@/seed/types'
import { markOrderCompleted, findPendingOrderByUserAndMethod } from '@/land/orders/pending-order-repo'
import { track } from '@/land/signals/track'
import { D1Events } from '@/land/signals/d1-event-types'

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY

/** Map PayOS description amount to the correct tier.
 *  Picks the tier whose expected VND amount is closest to the received amount.
 *  Rejects if the closest tier is more than 0.5% off (prevents tier confusion from
 *  underpayments that fall within another tier's wider 1% tolerance window). */
function resolveTierFromAmount(amountVnd: number): Tier | null {
  const USD_TO_VND = Number(process.env.USD_TO_VND ?? '25000')
  const TIER_USD: Record<Tier, number> = {
    BASIC: 199,
    PREMIUM: 399,
    ENTERPRISE: 799,
    MASTER: 4999,
  }
  let closest: Tier | null = null
  let closestDiff = Infinity
  for (const [tier, usd] of Object.entries(TIER_USD) as [Tier, number][]) {
    const expected = Math.round((usd * USD_TO_VND) / 1000) * 1000
    const diff = Math.abs(amountVnd - expected)
    if (diff < closestDiff) {
      closestDiff = diff
      closest = tier
    }
  }
  if (!closest) return null
  const expectedForClosest = Math.round((TIER_USD[closest] * USD_TO_VND) / 1000) * 1000
  if (closestDiff > expectedForClosest * 0.005) return null
  return closest
}

/** F-06: Log a lost payment event to the DLQ (payment_events table) for later recovery. */
async function logToDlq(db: ReturnType<typeof createServerClient>, payload: {
  orderCode: string
  paymentLinkId: string
  userId: string
  tier: Tier
  amount: number
  rawBody: string
  reason: string
}): Promise<void> {
  try {
    await db.from('payment_events').upsert({
      event_id: `dlq_payos_${payload.paymentLinkId}`,
      event_type: 'payos.dlq_lost_event',
      payload: payload.rawBody,
      processed: 0,
      created_at: new Date().toISOString(),
    })
    logger.error('[PayOS DLQ] Lost payment event recorded', {
      orderCode: payload.orderCode,
      paymentLinkId: payload.paymentLinkId,
      userId: payload.userId,
      tier: payload.tier,
      amount: payload.amount,
      reason: payload.reason,
    })
  } catch (err) {
    logger.error('[PayOS DLQ] Failed to record DLQ entry', err instanceof Error ? err : undefined)
  }
}

export async function POST(request: NextRequest) {
  if (!FEATURE_PAYOS) {
    logger.warn('[PayOS Webhook] Feature flag disabled — ignoring')
    return NextResponse.json({ received: true, note: 'payos_disabled' }, { status: 200 })
  }

  if (!PAYOS_CHECKSUM_KEY) {
    logger.error('[PayOS Webhook] PAYOS_CHECKSUM_KEY not configured')
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }

  const rawBody = await request.text()

  const signature = request.headers.get('x-checksum')
  if (!signature) {
    logger.warn('[PayOS Webhook] Missing x-checksum header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const isValid = await verifyPayOsWebhook(rawBody, signature, PAYOS_CHECKSUM_KEY)
  if (!isValid) {
    logger.warn('[PayOS Webhook] Invalid checksum signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let parsed: ReturnType<typeof payOsIpnSchema.safeParse>
  try {
    const raw = JSON.parse(rawBody) as unknown
    parsed = payOsIpnSchema.safeParse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!parsed.success) {
    logger.warn('[PayOS Webhook] Invalid payload shape', { errors: parsed.error.flatten() })
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const ipn = parsed.data

  if (!ipn.success || ipn.code !== '00') {
    logger.info('[PayOS Webhook] Non-success payment event', { code: ipn.code, desc: ipn.desc })
    return NextResponse.json({ received: true })
  }

  const { orderCode, amount, description, paymentLinkId } = ipn.data

  const userId = parseUserIdFromPayOsDescription(description)
  if (!userId) {
    logger.warn('[PayOS Webhook] Cannot parse userId from description', { description, orderCode })
    return NextResponse.json({ error: 'Cannot resolve user' }, { status: 422 })
  }

  const tier = resolveTierFromAmount(amount)
  if (!tier) {
    logger.warn('[PayOS Webhook] Cannot resolve tier from amount', { amount, orderCode })
    return NextResponse.json({ error: 'Cannot resolve tier' }, { status: 422 })
  }

  const db = createServerClient()

  // Idempotency: INSERT-first with UNIQUE constraint check (F1 fix — eliminates SELECT-then-upsert race)
  try {
    await db
      .from('payment_events')
      .insert({
        event_id: `payos_${paymentLinkId}`,
        event_type: 'payos.payment_success',
        payload: rawBody,
        processed: 0,
        created_at: new Date().toISOString(),
      })
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined
    const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message?: string }).message) : ''
    if (code === '23505' || msg.includes('UNIQUE constraint')) {
      // Concurrent request already inserted — check if already processed
      const { data: existing } = await db
        .from('payment_events')
        .select('processed')
        .eq('event_id', `payos_${paymentLinkId}`)
        .single()
      if (existing?.processed) {
        logger.info('[PayOS Webhook] Already processed (race recovered)', { paymentLinkId })
        return NextResponse.json({ received: true, duplicate: true })
      }
      // Inserted by concurrent request but not yet processed — continue processing
    } else {
      logger.warn('[PayOS Webhook] Failed to record event', { error: msg })
      return NextResponse.json({ error: 'Cannot record payment event' }, { status: 422 })
    }
  }

  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
  const now = new Date().toISOString()
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data: membership } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .single()
    const orgId = membership?.org_id as string | undefined

    if (orgId) {
      const { data: existingSub } = await db
        .from('subscriptions')
        .select('org_id')
        .eq('org_id', orgId)
        .single()

      if (existingSub) {
        await db
          .from('subscriptions')
          .update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now })
          .eq('org_id', orgId)
      } else {
        await db.from('subscriptions').insert({
          org_id: orgId,
          plan: tier.toLowerCase(),
          status: 'active',
          current_period_start: now,
          current_period_end: periodEnd,
        })
      }

      await db
        .from('organizations')
        .update({ plan: tier.toLowerCase(), updated_at: now })
        .eq('id', orgId)
    }

    // F-03: order_id in pending_orders uses sophia_{userId}_{timestamp}, not payos_{paymentLinkId}
    // Look up the most recent pending order by userId + payment_method='payos'
    const found = await findPendingOrderByUserAndMethod(userId, 'payos')
    if (found) {
      await markOrderCompleted(found.order_id, `payos_${paymentLinkId}`)
    } else {
      // F-06: No pending order — log to DLQ for later recovery instead of silently ignoring
      await logToDlq(db, {
        orderCode: String(orderCode),
        paymentLinkId,
        userId,
        tier,
        amount,
        rawBody,
        reason: 'pending_order_not_found',
      })
    }

    await db.from('payment_events').update({ processed: 1 }).eq('event_id', `payos_${paymentLinkId}`)

    track(D1Events.PAYMENT_SUCCESS, 'webhook', {
      provider: 'payos',
      payment_link_id: paymentLinkId,
      amount_vnd: amount,
      tier,
    }, userId)
    track(D1Events.TIER_CONVERSION, userId, {
      to_tier: tier,
      provider: 'payos',
      amount_vnd: amount,
    }, userId)

    logger.info('[PayOS Webhook] Tier activated', { userId, tier, orgId, isLifetime, periodEnd })
    return NextResponse.json({ received: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('[PayOS Webhook] Activation failed', new Error(msg), { userId, tier })
    return NextResponse.json({ error: `Activation failed: ${msg}` }, { status: 500 })
  }
}
