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
  getPayOsTierConfig,
  } from '@/land/payments/payos'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient, getD1Raw } from '@/seed/db/client'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { recordAudit } from '@/seed/db/audit/audit-log'
import { markOrderCompleted, markOrderFailed } from '@/land/orders/pending-order-repo'
import type { Tier } from '@/seed/types'
import type { PendingOrder } from '@/land/orders/pending-order-types'
import { track } from '@/tree/signals/track'
import { D1Events } from '@/tree/signals/d1-event-types'

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY

// Underpayment threshold: accept as full if >= 99% of expected amount
const UNDERPAYMENT_THRESHOLD = 0.99



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
  let sanitizedBody: string
  try {
    const raw = JSON.parse(rawBody) as unknown
    sanitizedBody = JSON.stringify(raw) // L6: ensure valid JSON before storage
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

  const db = createServerClient()
  const { orderCode, amount, description, paymentLinkId } = ipn.data

  // Idempotency: INSERT-first with UNIQUE constraint check (F1 fix — eliminates SELECT-then-upsert race)
  try {
    await db
      .from('payment_events')
      .insert({
        event_id: `payos_${paymentLinkId}`,
        event_type: 'payos.payment_success',
        payload: sanitizedBody,
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

  const userId = parseUserIdFromPayOsDescription(description)
  if (!userId) {
    logger.warn('[PayOS Webhook] Cannot parse userId from description', { description, orderCode })
    return NextResponse.json({ error: 'Cannot resolve user' }, { status: 422 })
  }

  // Reserve the order by direct lookup using provider_payment_id
  const { data: orderRow } = await db
    .from('pending_orders')
    .select('*')
    .eq('provider_payment_id', paymentLinkId)
    .eq('status', 'pending')
    .single()

  const order = orderRow as PendingOrder | null
  if (!order) {
    logger.warn('[PayOS Webhook] No pending order found for paymentLinkId', { paymentLinkId, orderCode })
    // Release lock and ack to prevent infinite retries; this is a config issue
    await db.from('payment_events').delete().eq('event_id', `payos_${paymentLinkId}`)
    return NextResponse.json({ error: 'Order not found' }, { status: 400 })
  }

  const tier = order.tier as Tier
  const orderId = order.order_id
  const orderPeriod = order.period

  // Expected amount verification with underpayment tolerance
  const expectedVndAmount = getPayOsTierConfig(tier).vndAmount

  if (amount < expectedVndAmount * UNDERPAYMENT_THRESHOLD) {
    logger.warn('[PayOS Webhook] Underpayment detected', {
      orderCode,
      orderId,
      amount,
      expected: expectedVndAmount,
      threshold: UNDERPAYMENT_THRESHOLD,
    })
    // Mark order as failed due to underpayment
    await markOrderFailed(orderId, 'underpaid')
    // Mark event as processed to prevent retry
    await db.from('payment_events').update({ processed: 1 }).eq('event_id', `payos_${paymentLinkId}`)
    return NextResponse.json({ received: true, status: 'underpaid' })
  }

  // Log overpayment (info only)
  if (amount > expectedVndAmount * 1.01) {
    logger.warn('[PayOS Webhook] Overpaid', { orderCode, expected: expectedVndAmount, actual: amount })
  }

  // Determine period end based on tier and order period
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
  const now = new Date().toISOString()
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : orderPeriod === 'yearly'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data: membership } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .single()
    let orgId = membership?.org_id as string | undefined

    if (orgId) {
      const { data: existingSub } = await db
        .from('subscriptions')
        .select('id')
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
    } else {
      // No org membership: create new org and subscription
      logger.warn('[PayOS Webhook] No org membership found for userId, creating new org', { userId })
      const insertResult = await db.from('organizations').insert({ name: `User ${userId}`, plan: tier.toLowerCase() }).select('id').single()
      const newOrg = insertResult.data as { id: string } | null
      if (newOrg?.id) {
        orgId = newOrg.id
        await db.from('org_members').insert({ org_id: newOrg.id, user_id: userId, role: 'owner' })
        await db.from('subscriptions').insert({ org_id: newOrg.id, plan: tier.toLowerCase(), status: 'active', current_period_start: now, current_period_end: periodEnd })
      }
    }

    // Complete the pending order
    await markOrderCompleted(orderId, `payos_${paymentLinkId}`)

    // Mark event as processed
    await db.from('payment_events').update({ processed: 1 }).eq('event_id', `payos_${paymentLinkId}`)

    // Audit trail
    try {
      const d1 = await getD1Raw()
      await recordAudit(d1, {
        tableName: 'subscriptions',
        rowId: orgId ?? userId,
        action: 'update',
        actorId: userId,
        after: { tier, plan: tier.toLowerCase(), status: 'active', periodEnd, paymentId: `payos_${paymentLinkId}`, provider: 'payos', amountVnd: amount },
      })
    } catch { /* non-fatal */ }

    // Telemetry
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
    // Release lock on failure to enable retry
    try {
      await db.from('payment_events').delete().eq('event_id', `payos_${paymentLinkId}`)
    } catch (delErr) {
      logger.warn('[PayOS Webhook] Failed to release lock on failure', { paymentLinkId, error: String(delErr) })
    }
    return NextResponse.json({ error: `Activation failed: ${msg}` }, { status: 500 })
  }
}
