/**
 * Overage Top-Up Service
 *
 * Manages the top-up lifecycle:
 * 1. createTopupInvoice(userId, mcuAmount) → creates NOWPayments invoice,
 *    stores pending_topups row, returns invoice URL for redirect
 * 2. processTopupIpn(ipn) → atomic lock via INSERT ON CONFLICT DO NOTHING,
 *    verify payment amount, add credits to user balance, mark overage events
 *    as billable, invalidate quota cache
 *
 * @module billing/overage-topup
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { createNowPaymentsSDK } from '@/tree/clients/nowpayments-client'
import { markEventsAsBillable } from '@/seed/db/overage-billing-ops'
import { invalidateQuotaCache } from '@/seed/kv/quota-cache-ops'
import {
  type TopupInvoice,
  type TopupIpnPayload,
  TOPUP_PRICE_PER_MCU,
  TOPUP_CREDIT_EXPIRY_DAYS,
} from './overage-topup-types'

const UNDERPAYMENT_THRESHOLD = 0.99

/**
 * Create a top-up invoice for the given user.
 * Creates a NOWPayments invoice and stores a pending_topups row.
 * Returns the invoice details (including redirect URL) or null on failure.
 */
export async function createTopupInvoice(
  userId: string,
  mcuAmount: number,
): Promise<TopupInvoice | null> {
  if (!userId || mcuAmount <= 0) {
    logger.error('[OverageTopup] Invalid input', { userId, mcuAmount })
    return null
  }

  const priceCents = Math.round(mcuAmount * TOPUP_PRICE_PER_MCU * 100)
  const priceUsd = priceCents / 100
  const orderId = `topup_${userId}_${Date.now()}`
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min expiry

  try {
    const sdk = createNowPaymentsSDK()
    const result = await sdk.createCheckout({
      priceAmount: priceUsd,
      priceCurrency: 'USD',
      orderId,
      orderDescription: `Top-up ${mcuAmount} MCU credits`,
    })

    if (!result || !result.id) {
      logger.error('[OverageTopup] Failed to create NOWPayments checkout', { userId, mcuAmount, priceUsd })
      return null
    }

    const invoiceId = String(result.id)
    const invoiceUrl = result.invoice_url ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'}/dashboard/billing`

    // Store pending top-up record for IPN reconciliation
    const db = createServerClient()
    await db.from('pending_topups').insert({
      id: `topup_${invoiceId}`,
      user_id: userId,
      invoice_id: invoiceId,
      mcu_amount: mcuAmount,
      price_cents: priceCents,
      status: 'pending',
      created_at: new Date().toISOString(),
    })

    logger.info('[OverageTopup] Invoice created', {
      userId,
      mcuAmount,
      priceUsd,
      invoiceId,
      orderId,
    })

    return {
      invoiceId,
      invoiceUrl,
      mcuAmount,
      priceCents,
      expiresAt,
    }
  } catch (error) {
    logger.error('[OverageTopup] Invoice creation failed', toError(error))
    return null
  }
}

/**
 * Process a top-up IPN (Instant Payment Notification).
 *
 * Atomic lock via INSERT ON CONFLICT DO NOTHING on payment_events table.
 * Verifies payment amount, grants credits, marks overage events billable,
 * and invalidates quota cache.
 */
export async function processTopupIpn(
  ipn: TopupIpnPayload,
): Promise<{ success: boolean; message: string }> {
  const { payment_id, payment_status, order_id, price_amount } = ipn

  if (!order_id.startsWith('topup_')) {
    return { success: false, message: 'Not a top-up order' }
  }

  const eventId = `topup_${payment_id}_${payment_status}`
  const db = createServerClient()
  const now = new Date().toISOString()

  // ── 1. Atomic lock via INSERT ON CONFLICT DO NOTHING ──────────────────────
  const lockResult = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
       VALUES (?1, ?2, ?3, 0, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, `topup.${payment_status}`, JSON.stringify(ipn), now)
    .run()

  if (!lockResult.meta?.changes) {
    const existing = await db
      .prepare('SELECT processed, created_at FROM payment_events WHERE event_id = ?1')
      .bind(eventId)
      .first<{ processed: number | boolean; created_at: string }>()

    if (!existing) {
      return { success: false, message: 'Database query failure' }
    }

    if (existing.processed === 1) {
      return { success: true, message: 'Already processed' }
    }

    // Stale lock recovery (>5 min)
    const lockAgeMs = Date.now() - new Date(existing.created_at ?? now).getTime()
    if (lockAgeMs > 5 * 60 * 1000) {
      logger.error('[OverageTopup] Stale lock cleared', { eventId, payment_id })
      try {
        await db
          .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
          .bind(eventId)
          .run()
      } catch {
        // Non-fatal — stale lock cleared best-effort
      }
      return { success: true, message: 'Stale lock cleared (marked processed)' }
    }

    return { success: false, message: 'Already processing' }
  }

  // ── 2. This process owns the lock — process the top-up ────────────────────
  try {
    if (payment_status !== 'finished') {
      // Non-final status — mark processed and return
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run()
      return { success: true, message: `Top-up ${payment_status} recorded` }
    }

    // ── 3. Verify payment amount (underpayment guard) ───────────────────────
    const actuallyPaid = ipn.actually_paid
    const required = price_amount * UNDERPAYMENT_THRESHOLD

    if (actuallyPaid !== undefined && actuallyPaid !== null && actuallyPaid < required) {
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run()

      logger.warn('[OverageTopup] Underpayment detected — no credits granted', {
        payment_id,
        priceAmount: price_amount,
        actuallyPaid,
        required,
      })
      return { success: false, message: 'Underpayment detected — insufficient funds' }
    }

    // ── 4. Look up pending top-up ────────────────────────────────────────────
    const userId = order_id.startsWith('topup_')
      ? order_id.slice('topup_'.length).split('_').slice(0, -1).join('_') || order_id.slice('topup_'.length)
      : null
    if (!userId) {
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run()
      return { success: false, message: 'Could not parse user ID from order' }
    }

    // Parse invoice_id from the IPN or find the pending topup
    const ipnInvoiceId = ipn.invoice_id
    const pendingTopupId = `topup_${ipnInvoiceId ?? payment_id}`
    const pendingTopup = await db
      .prepare('SELECT id, user_id, mcu_amount, price_cents, status FROM pending_topups WHERE id = ?1')
      .bind(pendingTopupId)
      .first<{ id: string; user_id: string; mcu_amount: number; price_cents: number; status: string }>()

    if (!pendingTopup) {
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run()
      logger.warn('[OverageTopup] Pending top-up not found, creating credit directly', {
        payment_id,
        userId,
      })
      // Fall through — grant credits based on price_amount
    }

    const mcuAmount = pendingTopup?.mcu_amount ?? Math.round(price_amount / TOPUP_PRICE_PER_MCU)

    // ── 5. Grant credits via user_credits table ─────────────────────────────
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + TOPUP_CREDIT_EXPIRY_DAYS)

    // Use upsert pattern to add credits atomically
    await db
      .prepare(
        `INSERT INTO user_credits (user_id, credits_remaining, credits_total_purchased, expires_at)
         VALUES (?1, ?2, ?2, ?3)
         ON CONFLICT(user_id) DO UPDATE SET
           credits_remaining = credits_remaining + ?2,
           credits_total_purchased = credits_total_purchased + ?2,
           expires_at = ?3`,
      )
      .bind(userId, mcuAmount, Math.floor(expiresAt.getTime() / 1000))
      .run()

    // ── 6. Mark pending top-up as completed ─────────────────────────────────
    if (pendingTopup) {
      await db
        .prepare('UPDATE pending_topups SET status = ?1 WHERE id = ?2')
        .bind('completed', pendingTopup.id)
        .run()
    }

    // ── 7. Mark overage events as billable ──────────────────────────────────
    try {
      const overageEventIds = await getUnbilledOverageEventIds(userId)
      if (overageEventIds.length > 0) {
        await markEventsAsBillable(overageEventIds, TOPUP_PRICE_PER_MCU)
        logger.info('[OverageTopup] Overage events marked as billable', {
          userId,
          count: overageEventIds.length,
        })
      }
    } catch (err) {
      logger.warn('[OverageTopup] Failed to mark events billable (non-fatal)', toError(err))
    }

    // ── 8. Invalidate quota cache ───────────────────────────────────────────
    try {
      await invalidateQuotaCache(userId, userId)
    } catch {
      // Non-fatal — cache will be refreshed on next check
    }

    // ── 9. Mark event as processed ──────────────────────────────────────────
    await db
      .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
      .bind(eventId)
      .run()

    logger.info('[OverageTopup] Top-up processed successfully', {
      userId,
      payment_id,
      mcuAmount,
    })

    return { success: true, message: 'Top-up processed' }
  } catch (error) {
    logger.error('[OverageTopup] Processing failed', toError(error))

    // Release lock on failure to allow retry
    try {
      await db
        .prepare('DELETE FROM payment_events WHERE event_id = ?1')
        .bind(eventId)
        .run()
    } catch {
      // Non-fatal — lock release best-effort
    }

    return { success: false, message: error instanceof Error ? error.message : 'Processing failed' }
  }
}

/**
 * Get IDs of unbilled overage events for a user.
 * Used to mark them as billable after a successful top-up.
 */
async function getUnbilledOverageEventIds(userId: string): Promise<string[]> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('overage_events')
      .select('id')
      .eq('user_id', userId)
      .eq('billable', false)
      .limit(100)

    if (!data || !Array.isArray(data)) return []
    return (data as Array<{ id: string }>).map(row => row.id)
  } catch {
    return []
  }
}
