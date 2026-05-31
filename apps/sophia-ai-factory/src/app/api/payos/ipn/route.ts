/**
 * POST /api/payos/ipn — PayOS IPN (webhook) handler.
 * Verifies HMAC-SHA256, activates tier atomically, marks order completed.
 * Idempotent via payos_events.event_id UNIQUE constraint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPayOsWebhook, payOsIpnSchema, FEATURE_PAYOS, getPayOsTierConfig } from '@/land/payments/payos'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient, getD1Raw } from '@/seed/db/client'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { recordAudit } from '@/seed/db/audit/audit-log'
import { markOrderCompleted, markOrderFailed } from '@/land/orders/pending-order-repo'
import type { Tier } from '@/seed/types'

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY

export async function POST(request: NextRequest) {
  if (!FEATURE_PAYOS) {
    return NextResponse.json({ error: 'PayOS not enabled' }, { status: 503 })
  }

  if (!PAYOS_CHECKSUM_KEY) {
    logger.error('[PayOS IPN] PAYOS_CHECKSUM_KEY not configured')
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }

  // Read raw body BEFORE JSON.parse — required for HMAC verification
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read body' }, { status: 400 })
  }

  // Parse JSON after reading raw body string
  let bodyJson: unknown
  try {
    bodyJson = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate payload shape
  const parsed = payOsIpnSchema.safeParse(bodyJson)
  if (!parsed.success) {
    logger.warn('[PayOS IPN] Invalid payload shape', { errors: parsed.error.flatten() })
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { data: ipnData, signature, success } = parsed.data
  const { orderCode, amount, description, paymentLinkId } = ipnData

  // Verify HMAC-SHA256 over raw body bytes
  const isValid = await verifyPayOsWebhook(rawBody, signature, PAYOS_CHECKSUM_KEY)
  if (!isValid) {
    logger.warn('[PayOS IPN] Invalid signature', { orderCode })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const eventId = `payos_${orderCode}`
  const db = createServerClient()

  // 1. Atomically reserve event (lock mechanism via PRIMARY KEY on payos_events)
  const { error: insertError } = await db.from('payos_events').insert({
    event_id: eventId,
    order_code: String(orderCode),
    status: success ? 'PAID' : 'CANCELLED',
    amount: amount || 0,
    currency: 'VND',
    payload: JSON.stringify(bodyJson),
    processed: 0,
    created_at: new Date().toISOString(),
  })

  if (insertError) {
    // Unique key/Primary key violation
    const { data: existing, error: selectError } = await db
      .from('payos_events')
      .select('processed')
      .eq('event_id', eventId)
      .single()

    if (selectError || !existing) {
      return NextResponse.json({ error: 'Database query failure' }, { status: 500 })
    }

    if (existing.processed === 1 || existing.processed === true) {
      return NextResponse.json({ received: true, note: 'Already processed' })
    } else {
      return NextResponse.json({ error: 'Already processing' }, { status: 409 })
    }
  }

  if (!success) {
    // Payment cancelled or failed — find order via database-lookup matching payment_method = 'payos' and status = 'pending'
    const { data: pendingOrders, error: pendingOrdersError } = await db
      .from('pending_orders')
      .select('*')
      .eq('payment_method', 'payos')
      .eq('status', 'pending')

    if (pendingOrdersError || !pendingOrders) {
      logger.error('[PayOS IPN] Failed to query pending_orders for cancellation', { pendingOrdersError })
      // Release lock so it can be retried
      await db.from('payos_events').delete().eq('event_id', eventId)
      return NextResponse.json({ error: 'Database query failure' }, { status: 500 })
    }

    const orders = pendingOrders as Array<{ order_id: string; user_id: string; tier: string; invoice_url: string | null }> | null
    const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))

    if (matchOrder) {
      try {
        await markOrderFailed(matchOrder.order_id, 'payos_cancelled')
      } catch (err) {
        logger.warn('[PayOS IPN] Failed to mark order failed', { orderId: matchOrder.order_id, error: String(err) })
      }
    } else {
      logger.warn('[PayOS IPN] Cancellation received but no matching pending order found', { paymentLinkId, orderCode })
    }

    // Mark as processed (unsuccessful terminal state)
    await db.from('payos_events').update({ processed: 1 }).eq('event_id', eventId)
    logger.info('[PayOS IPN] Payment not successful', { orderCode, success })
    return NextResponse.json({ received: true })
  }

  try {
    // Directly query pending_orders table matching payment_method = 'payos' and status = 'pending'
    const { data: pendingOrders, error: pendingOrdersError } = await db
      .from('pending_orders')
      .select('*')
      .eq('payment_method', 'payos')
      .eq('status', 'pending')

    if (pendingOrdersError || !pendingOrders) {
      logger.error('[PayOS IPN] Failed to query pending_orders', { pendingOrdersError })
      // Release lock so it can be retried
      await db.from('payos_events').delete().eq('event_id', eventId)
      return NextResponse.json({ error: 'Database query failure' }, { status: 500 })
    }

    const orders = pendingOrders as Array<{ order_id: string; user_id: string; tier: string; invoice_url: string | null }> | null
    
    // Find matching order
    const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))

    if (!matchOrder) {
      logger.error('[PayOS IPN] No matching pending order found', { paymentLinkId, orderCode })
      // Release lock so it can be retried
      await db.from('payos_events').delete().eq('event_id', eventId)
      return NextResponse.json({ error: 'Order not found' }, { status: 400 })
    }

    const userId = matchOrder.user_id
    const tier = matchOrder.tier as Tier
    const orderId = matchOrder.order_id

    // Verify amount matches expected VND price of tier
    const expectedVndAmount = getPayOsTierConfig(tier).vndAmount
    if (amount !== expectedVndAmount) {
      logger.error('[PayOS IPN] Amount mismatch', {
        orderCode,
        received: amount,
        expected: expectedVndAmount,
        tier
      })
      // Release lock so it can be retried
      await db.from('payos_events').delete().eq('event_id', eventId)
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
    }

    const orderPeriod = (matchOrder as Record<string, unknown> | undefined)?.period as string | undefined
    const now = new Date().toISOString()
    const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
    const billingPeriod = isLifetime ? 'lifetime' : orderPeriod === 'yearly' ? 'yearly' : 'monthly'
    const periodEnd = billingPeriod === 'lifetime'
      ? new Date('2099-12-31T23:59:59Z').toISOString()
      : billingPeriod === 'yearly'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: membership } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
    const orgId = membership?.org_id as string | undefined

    // Activate tier atomically via D1 batch
    try {
      const d1 = await getD1Raw()
      const { data: existingSub } = await db.from('subscriptions').select('id').eq('org_id', orgId ?? '').single()

      const stmts = orgId
        ? existingSub
          ? [
              d1.prepare('UPDATE subscriptions SET plan=?, status=?, current_period_end=?, updated_at=? WHERE org_id=?')
                .bind(tier.toLowerCase(), 'active', periodEnd, now, orgId),
              d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
                .bind(tier.toLowerCase(), now, orgId),
              d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
                .bind('completed', `payos_${orderCode}`, now, orderId),
            ]
          : [
              d1.prepare('INSERT INTO subscriptions (org_id, plan, status, current_period_start, current_period_end) VALUES (?,?,?,?,?)')
                .bind(orgId, tier.toLowerCase(), 'active', now, periodEnd),
              d1.prepare('UPDATE organizations SET plan=?, updated_at=? WHERE id=?')
                .bind(tier.toLowerCase(), now, orgId),
              d1.prepare('UPDATE pending_orders SET status=?, payment_id=?, completed_at=? WHERE order_id=?')
                .bind('completed', `payos_${orderCode}`, now, orderId),
            ]
        : []

      if (stmts.length > 0) await d1.batch(stmts)
    } catch (batchErr) {
      logger.warn('[PayOS IPN] Batch failed, falling back', { error: String(batchErr) })
      if (orgId) {
        await db.from('subscriptions').update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now }).eq('org_id', orgId)
        await db.from('organizations').update({ plan: tier.toLowerCase(), updated_at: now }).eq('id', orgId)
      }
      await markOrderCompleted(orderId, `payos_${orderCode}`)
    }

    // Audit trail (non-fatal)
    try {
      const d1 = await getD1Raw()
      await recordAudit(d1, {
        tableName: 'subscriptions',
        rowId: orgId ?? userId,
        action: 'update',
        actorId: userId,
        after: { tier, plan: tier.toLowerCase(), status: 'active', periodEnd, paymentId: `payos_${orderCode}`, provider: 'payos', amountVnd: amount },
      })
    } catch { /* non-fatal */ }

    // 3. Update the lock record to processed on success, save final amount
    await db.from('payos_events').update({ processed: 1, amount }).eq('event_id', eventId)

    logger.info('[PayOS IPN] Tier activated', { userId, orgId, tier, orderCode, amount })
    return NextResponse.json({ received: true })

  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error(String(err))
    logger.error('[PayOS IPN] Processing failed', errorObj, { orderCode })
    // Release the lock on exception so that webhook can be retried
    try {
      await db.from('payos_events').delete().eq('event_id', eventId)
    } catch (delErr) {
      logger.warn('[PayOS IPN] Failed to release lock on failure', { orderCode, error: String(delErr) })
    }
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })
  }
}
