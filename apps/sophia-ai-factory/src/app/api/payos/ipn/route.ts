/**
 * POST /api/payos/ipn — PayOS IPN (webhook) handler.
 * Verifies HMAC-SHA256, activates tier atomically, marks order completed.
 * Idempotent via payos_events.event_id UNIQUE constraint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPayOsWebhook, payOsIpnSchema, FEATURE_PAYOS, getPayOsTierConfig } from '@/land/payments/payos'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient, getD1 } from '@/seed/db/client'
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

  // EC4: Timestamp validation — reject replayed webhooks (>5 min old)
  const eventTimestamp = ((bodyJson as Record<string, unknown>)?.data as Record<string, unknown> | undefined)?.timestamp ?? (bodyJson as Record<string, unknown>)?.timestamp as number | undefined;
  if (eventTimestamp && typeof eventTimestamp === 'number') {
    const age = Math.abs(Math.floor(Date.now() / 1000) - eventTimestamp);
    if (age > 300) {
      return NextResponse.json({ error: 'REPLAY_DETECTED' }, { status: 400 });
    }
  }

  const eventId = `payos_${orderCode}`
  const db = createServerClient()

  // 1. Atomically insert event row; ON CONFLICT DO NOTHING ensures only one
  // webhook caller wins the race. The RETURNING clause gives us the processed
  // flag in a single round-trip, eliminating the TOCTOU between INSERT and SELECT.
  const d1 = getD1()
  if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
  const { results: insertResults } = await d1
    .prepare(
      `INSERT INTO payos_events (event_id, order_code, status, amount, currency, payload, processed, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)
       ON CONFLICT(event_id) DO NOTHING
       RETURNING processed`,
    )
    .bind(
      eventId,
      String(orderCode),
      success ? 'PAID' : 'CANCELLED',
      amount || 0,
      'VND',
      JSON.stringify(bodyJson),
      new Date().toISOString(),
    )
    .all<{ processed: number }>()

  const wonTheLock = insertResults && insertResults.length > 0
 if (!wonTheLock) {
 // We lost the race — another caller already holds (or processed) this event.
 // Single SELECT to determine state (fail-closed: return 500 on DB error).
 let existing: { processed: number } | null = null
 try {
   existing = await d1
     .prepare(`SELECT processed FROM payos_events WHERE event_id = ?1 LIMIT 1`)
     .bind(eventId)
     .first<{ processed: number }>()
 } catch {
   return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })
 }

 if (existing && existing.processed === 1) {
   return NextResponse.json({ received: true, note: 'Already processed' })
 }
 // Another caller is actively processing — return 409 so sender retries later
 return NextResponse.json({ error: 'Already processing' }, { status: 409 })
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
  // FIX 2: Lightweight tier lookup FIRST (minimal columns) to validate amount before full order fetch
  // This prevents timing-based probing where attacker measures response time differences
  const { data: tierLookup, error: tierLookupError } = await db
    .from('pending_orders')
    .select('tier')
    .eq('payment_method', 'payos')
    .eq('status', 'pending')
    .limit(1)

  if (tierLookupError || !tierLookup || tierLookup.length === 0) {
    logger.error('[PayOS IPN] No pending orders for tier lookup', { tierLookupError })
    await db.from('payos_events').delete().eq('event_id', eventId)
    return NextResponse.json({ error: 'No pending orders' }, { status: 400 })
  }

  const tier = tierLookup[0].tier as Tier
  const expectedVndAmount = getPayOsTierConfig(tier).vndAmount
  if (amount !== expectedVndAmount) {
    logger.error('[PayOS IPN] Amount mismatch', {
      orderCode,
      received: amount,
      expected: expectedVndAmount,
      tier
    })
    await db.from('payos_events').delete().eq('event_id', eventId)
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
  }

  // Full order lookup after amount validated
  const { data: pendingOrders, error: pendingOrdersError } = await db
    .from('pending_orders')
    .select('*')
    .eq('payment_method', 'payos')
    .eq('status', 'pending')

  if (pendingOrdersError || !pendingOrders) {
    logger.error('[PayOS IPN] Failed to query pending_orders', { pendingOrdersError })
    await db.from('payos_events').delete().eq('event_id', eventId)
    return NextResponse.json({ error: 'Database query failure' }, { status: 500 })
  }

  const orders = pendingOrders as Array<{ order_id: string; user_id: string; tier: string; invoice_url: string | null }> | null

  // Find matching order
  const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))

  if (!matchOrder) {
    logger.error('[PayOS IPN] No matching pending order found', { paymentLinkId, orderCode })
    await db.from('payos_events').delete().eq('event_id', eventId)
    return NextResponse.json({ error: 'Order not found' }, { status: 400 })
  }
  const userId = matchOrder.user_id
  const orderId = matchOrder.order_id

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
      const d1 = getD1()
  if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
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
 logger.warn('[PayOS IPN] Batch failed, verifying state before fallback', { error: String(batchErr) })
 // FIX 3: Verify actual DB state before applying fallback mutations
 try {
  const d1State = getD1()
  const subRow = await d1State!.prepare(
   'SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1'
  ).bind(orgId).first()
  if (!subRow || (subRow as Record<string, string | null>)?.status !== 'active') {
   await db.from('subscriptions').update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now }).eq('org_id', orgId)
  }
  const orgRow = await d1State!.prepare(
   'SELECT plan FROM organizations WHERE id = ?1 LIMIT 1'
  ).bind(orgId).first()
  if (!orgRow || (orgRow as Record<string, string | null>)?.plan !== tier.toLowerCase()) {
   await db.from('organizations').update({ plan: tier.toLowerCase(), updated_at: now }).eq('id', orgId)
  }
 } catch (stateErr) {
  logger.error('[PayOS IPN] State verification failed, applying fallback anyway', { error: String(stateErr) })
  if (orgId) {
   await db.from('subscriptions').update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now }).eq('org_id', orgId)
   await db.from('organizations').update({ plan: tier.toLowerCase(), updated_at: now }).eq('id', orgId)
  }
 }
 await markOrderCompleted(orderId, `payos_${orderCode}`)
 throw batchErr
}

// Audit trail (non-fatal)
try {
  const d1 = getD1()
  if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
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