/**
 * NOWPayments IPN handlers for refunded and failed payments.
 * - handleRefunded: cancels subscription and invalidates license cache.
 * - handleFailed: marks order failed and triggers dunning workflow.
 * @module billing/nowpayments-ipn-refunded-failed
 */

import { logger } from '@/seed/utils/logger-utility'
import { safeCatch } from '@/seed/utils/safe-catch'
import { getD1 } from '@/seed/db/client'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'
import { markOrderFailed } from '@/land/orders/pending-order-repo'
import { success, failure, type Result } from '@/seed/types/result'
import { IPNError } from './nowpayments-ipn-errors'

export async function handleRefunded(ipn: NowPaymentsIpnPayload): Promise<Result<void, IPNError>> {
  try {
    const userId = parseUserIdFromOrderId(ipn.order_id || '')
    if (!userId) {
      logger.warn('[NOWPayments] refunded: cannot parse userId', { orderId: ipn.order_id })
      return success(undefined)
    }

    const _db = getDb()
    const _d1 = await getD1()
    if (!_d1) return failure(new IPNError('D1_BINDING_UNAVAILABLE'))
    const d1 = _d1!

    // Idempotency: the atomic lock in processNowPaymentsIpn (INSERT ON CONFLICT
    // DO NOTHING with event_id = nowpayments_${payment_id}_refunded) already
    // guarantees exactly-once processing per (payment_id, status) pair.
    // The previous SELECT-based check here was redundant and introduced
    // its own TOCTOU window. Trust the atomic lock as the single source of truth.

    // M13 fix (2026-07-01): Single UPDATE with subquery JOIN eliminates
    // TOCTOU between SELECT org_id and UPDATE subscriptions. The previous
    // two-step pattern could miss the subscription if membership changed
    // between queries.
    await d1.prepare(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = ?1
       WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = ?2)`
    ).bind(new Date().toISOString(), userId).run()

    await invalidateLicenseCacheOnRefund(userId, d1)

    logger.info('[NOWPayments] Payment refunded — subscription cancelled', { userId, paymentId: ipn.payment_id })
    return success(undefined)
  } catch (err) {
    return failure(new IPNError('HANDLE_REFUNDED_FAILED', err))
  }
}

async function invalidateLicenseCacheOnRefund(userId: string, d1: D1Database): Promise<void> {
  try {
    const lic = await d1
      .prepare('SELECT nonce FROM raas_licenses WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ nonce: string }>()
    if (lic?.nonce) {
      const kv = globalThis.KV_KV as KVNamespace | undefined
      await kv?.delete(`license:${lic.nonce}`).catch((e) => { safeCatch('KV license cache delete')(e) })
    }
  } catch (e) { safeCatch('License cache invalidation')(e) }
}

export async function handleFailed(ipn: NowPaymentsIpnPayload): Promise<Result<void, IPNError>> {
  try {
    const userId = parseUserIdFromOrderId(ipn.order_id || '')
    logger.info('[NOWPayments] Payment failed', { userId, paymentId: ipn.payment_id, amount: ipn.price_amount, currency: ipn.price_currency })

    if (ipn.order_id) {
      try {
        await markOrderFailed(ipn.order_id, `payment_status=${ipn.payment_status}`)
      } catch (err) {
        logger.warn('[NOWPayments] markOrderFailed error (non-fatal)', { orderId: ipn.order_id, error: String(err) })
      }
    }

    await triggerDunningOnFailure(userId, ipn)
    return success(undefined)
  } catch (err) {
    return failure(new IPNError('HANDLE_FAILED_FAILED', err))
  }
}

async function triggerDunningOnFailure(
  userId: string | null | undefined,
  ipn: NowPaymentsIpnPayload
): Promise<void> {
  if (!userId) return

  try {
    const db = getDb()
    const lic = await db
      .prepare('SELECT nonce, tier FROM raas_licenses WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ nonce: string; tier: string }>()
    if (lic?.nonce) {
      const { handlePaymentFailure } = await import('./dunning/dunning-actions')
      await handlePaymentFailure({
        userId,
        licenseNonce: lic.nonce,
        tier: (lic.tier || 'BASIC').toUpperCase() as Tier,
        amount: ipn.price_amount ?? 0,
        currency: ipn.price_currency || 'USD',
        failureReason: ipn.payment_status || 'unknown',
        paymentProvider: 'nowpayments',
      })
    }
  } catch (err) {
    logger.warn('[NOWPayments] Dunning trigger failed (non-fatal)', { userId, error: String(err) })
  }
}
