/**
 * POST /api/payos/ipn — PayOS IPN (webhook) handler.
 * Verifies HMAC-SHA256, activates tier atomically, marks order completed.
 * Idempotent via payos_events.event_id UNIQUE constraint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPayOsSignature, payOsIpnSchema, FEATURE_PAYOS, parseUserIdFromPayOsDescription } from '@/lib/payments/payos'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import { getD1Raw } from '@/seed/db/client'
import { getTierByInvoiceId } from '@/lib/clients/nowpayments-client'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import { recordAudit } from '@/seed/db/audit/audit-log'
import { markOrderCompleted, markOrderFailed } from '@/lib/orders/pending-order-repo'
import type { Tier } from '@/seed/types'

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY

/**
 * Check if this orderCode has already been processed (idempotency).
 */
async function isPayOsEventProcessed(orderCode: number): Promise<boolean> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('payos_events')
      .select('processed')
      .eq('event_id', `payos_${orderCode}`)
      .single()
    return data?.processed === 1 || data?.processed === true
  } catch { return false }
}

async function recordPayOsEvent(orderCode: number, status: string, payload: unknown, processed: boolean): Promise<void> {
  try {
    const db = createServerClient()
    await db.from('payos_events').upsert({
      event_id: `payos_${orderCode}`,
      order_code: String(orderCode),
      status,
      amount: 0, // updated by caller
      currency: 'VND',
      payload: JSON.stringify(payload),
      processed: processed ? 1 : 0,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    logger.warn('[PayOS IPN] Failed to record event', { orderCode, error: String(err) })
  }
}

export async function POST(request: NextRequest) {
  if (!FEATURE_PAYOS) {
    return NextResponse.json({ error: 'PayOS not enabled' }, { status: 503 })
  }

  if (!PAYOS_CHECKSUM_KEY) {
    logger.error('[PayOS IPN] PAYOS_CHECKSUM_KEY not configured')
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate payload shape
  const parsed = payOsIpnSchema.safeParse(rawBody)
  if (!parsed.success) {
    logger.warn('[PayOS IPN] Invalid payload shape', { errors: parsed.error.flatten() })
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { data: ipnData, signature, success } = parsed.data
  const { orderCode, amount, description, paymentLinkId } = ipnData

  // Verify HMAC-SHA256 signature
  const isValid = await verifyPayOsSignature(ipnData, signature, PAYOS_CHECKSUM_KEY)
  if (!isValid) {
    logger.warn('[PayOS IPN] Invalid signature', { orderCode })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check
  if (await isPayOsEventProcessed(orderCode)) {
    return NextResponse.json({ received: true, note: 'Already processed' })
  }

  // Record event as unprocessed (reserve row)
  await recordPayOsEvent(orderCode, success ? 'PAID' : 'CANCELLED', rawBody, false)

  if (!success) {
    // Payment cancelled or failed — find order via description and mark failed
    const orderId = description?.includes('sophia_') ? description.match(/sophia_[^_]+_\d+/)?.[0] : undefined
    if (orderId) {
      try { await markOrderFailed(orderId, 'payos_cancelled') } catch { /* non-fatal */ }
    }
    await recordPayOsEvent(orderCode, 'CANCELLED', rawBody, true)
    logger.info('[PayOS IPN] Payment not successful', { orderCode, success })
    return NextResponse.json({ received: true })
  }

  // Parse userId from description (orderId embedded)
  const userId = parseUserIdFromPayOsDescription(description)
  if (!userId) {
    logger.warn('[PayOS IPN] Cannot parse userId from description', { description, orderCode })
    return NextResponse.json({ received: true })
  }

  // Map paymentLinkId → tier (stored in pending_orders via invoice_url)
  // Fetch pending order to get tier info
  const db = createServerClient()
  const { data: pendingOrders } = await db
    .from('pending_orders')
    .select('*')
    .eq('user_id', userId)
    .eq('payment_method', 'payos')
    .eq('status', 'pending')

  const orders = pendingOrders as Array<{ order_id: string; tier: string; invoice_url: string | null }> | null
  const matchOrder = orders?.find(o => o.invoice_url?.includes(paymentLinkId) || o.invoice_url?.includes(String(orderCode)))
    ?? orders?.[0]

  const tier = (matchOrder?.tier ?? 'BASIC') as Tier
  const orderId = matchOrder?.order_id ?? `payos_${userId}_${orderCode}`

  const now = new Date().toISOString()
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
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

  await recordPayOsEvent(orderCode, 'PAID', rawBody, true)

  logger.info('[PayOS IPN] Tier activated', { userId, orgId, tier, orderCode, amount })
  return NextResponse.json({ received: true })
}
