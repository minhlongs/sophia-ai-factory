/**
 * NOWPayments IPN handlers for refunded and failed payments.
 * - handleRefunded: cancels subscription and invalidates license cache.
 * - handleFailed: marks order failed and triggers dunning workflow.
 * @module billing/nowpayments-ipn-refunded-failed
 */

import { logger } from '@/seed/utils/logger-utility'
import { getD1 } from '@/seed/db/client'
import type { Tier } from '@/seed/types'
import type { D1Database } from '@cloudflare/workers-types'
import type { NowPaymentsIpnPayload } from './nowpayments-ipn-handlers'
import { getDb, parseUserIdFromOrderId } from './nowpayments-ipn-db'
import { markOrderFailed } from '@/land/orders/pending-order-repo'
import { success, failure, type Result } from '@/seed/types/result'
import { IPNError } from './nowpayments-ipn-errors'
import { resolveOrgId } from '@/seed/auth/resolve-org-id'
import { invalidateUserTierCacheAsync } from '@/seed/db/get-user-tier'

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

    // Cancel the org subscription, then invalidate every member's cached tier.
    // getUserTier caches both per-user and org-fallback results for 60 seconds.
    const orgId = await resolveOrgId(userId, d1)
    let affectedUserIds = [userId]
    let updateResult
    if (orgId) {
      const members = await d1.prepare(
        'SELECT user_id FROM org_members WHERE org_id = ?1'
      ).bind(orgId).all<{ user_id: string }>()
      if (!members.success) throw new Error('Refund member lookup failed')
      affectedUserIds = [...new Set([userId, ...members.results.map((member) => member.user_id)])]
      updateResult = await d1.prepare(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = ?1
         WHERE org_id = ?2`
      ).bind(new Date().toISOString(), orgId).run()
    } else {
      // Match the same membership/owner scope as the fallback UPDATE so a
      // stale negative org cache cannot leave another member's tier cached.
      const members = await d1.prepare(
        `SELECT DISTINCT user_id FROM org_members WHERE org_id IN (
           SELECT org_id FROM org_members WHERE user_id = ?1
           UNION SELECT id FROM organizations WHERE user_id = ?1
         )`
      ).bind(userId).all<{ user_id: string }>()
      if (!members.success) throw new Error('Refund member lookup failed')
      affectedUserIds = [...new Set([userId, ...members.results.map((member) => member.user_id)])]
      updateResult = await d1.prepare(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = ?1
         WHERE org_id IN (
           SELECT org_id FROM org_members WHERE user_id = ?2
           UNION
           SELECT id AS org_id FROM organizations WHERE user_id = ?2
         ) OR user_id = ?2`
      ).bind(new Date().toISOString(), userId).run()
    }
    if (!updateResult.success) throw new Error('Refund subscription cancellation failed')

    await invalidateRefundEntitlementCaches(affectedUserIds, d1)

    logger.info('[NOWPayments] Payment refunded — subscription cancelled', { userId, paymentId: ipn.payment_id })
    return success(undefined)
  } catch (err) {
    return failure(new IPNError('HANDLE_REFUNDED_FAILED', err))
  }
}

async function invalidateRefundEntitlementCaches(userIds: string[], d1: D1Database): Promise<void> {
  if (userIds.length === 0) return

  const licenseRows: Array<{ user_id: string; nonce: string }> = []
  for (let offset = 0; offset < userIds.length; offset += 90) {
    const userBatch = userIds.slice(offset, offset + 90)
    const placeholders = userBatch.map((_, index) => `?${index + 1}`).join(', ')
    const licenses = await d1
      .prepare(`SELECT user_id, nonce FROM raas_licenses WHERE user_id IN (${placeholders}) AND nonce IS NOT NULL`)
      .bind(...userBatch)
      .all<{ user_id: string; nonce: string }>()
    if (!licenses.success) throw new Error('Refund license lookup failed')
    licenseRows.push(...licenses.results)
  }

  const kv = globalThis.KV_KV as KVNamespace | undefined
  const tasks = [
    ...userIds.map((userId) => () => invalidateUserTierCacheAsync(userId)),
    ...licenseRows.map((license) => async () => {
      await kv?.delete(`license:${license.nonce}`)
      await kv?.delete(`quota:${license.user_id}:${license.nonce}`)
    }),
  ]
  for (let index = 0; index < tasks.length; index += 20) {
    await Promise.all(tasks.slice(index, index + 20).map((task) => task()))
  }
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
