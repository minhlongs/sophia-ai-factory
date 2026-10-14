/**
 * Circuit breaker customer communications.
 *
 * When circuit opens (closed→open transition), affected customers with paid+queued bundles
 * receive an apology email and their bundle TTL is extended by 7 days.
 *
 * @module lib/fulfillment/circuit-breaker-comms
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { sendBundleOutageApologyEmail } from '@/land/billing/email/send-bundle-outage-apology-email'
import {
  fetchAffectedPurchases,
  fetchUserInfo,
  extendTtlWithAudit,
} from './circuit-breaker-comms-helpers'

/**
 * Notify customers when circuit first opens.
 * Called fire-and-forget via executionCtx.waitUntil in circuit-breaker.ts.
 */
export async function notifyCustomersOnOutage(
  openedAt: number,
): Promise<{ notified: number; ttlExtended: number }> {
  let notified = 0
  let ttlExtended = 0

  try {
    const affected = await fetchAffectedPurchases()

    if (affected.length === 0) {
      logger.info('[CircuitBreakerComms] No affected purchases — nothing to notify')
      return { notified: 0, ttlExtended: 0 }
    }

    logger.info('[CircuitBreakerComms] Notifying affected customers', { count: affected.length })

    for (const purchase of affected) {
      try {
        const extended = await extendTtlWithAudit(purchase, openedAt)
        if (extended) ttlExtended++

        const userInfo = await fetchUserInfo(purchase.user_id)
        const result = await sendBundleOutageApologyEmail({
          userEmail: userInfo?.email,
          userId: purchase.user_id,
          purchaseId: purchase.id,
          locale: userInfo?.locale ?? 'vi',
          openedAt,
        })

        if (result.success && !result.skipped) notified++
      } catch (err) {
        logger.error('[CircuitBreakerComms] Failed to process purchase', err instanceof Error ? err : undefined, {
          purchaseId: purchase.id,
        })
      }
    }
  } catch (err) {
    logger.error('[CircuitBreakerComms] notifyCustomersOnOutage failed', err instanceof Error ? err : undefined, {
      openedAt: getErrorMessage(err),
    })
  }

  logger.info('[CircuitBreakerComms] Outage notification complete', { notified, ttlExtended })
  return { notified, ttlExtended }
}
