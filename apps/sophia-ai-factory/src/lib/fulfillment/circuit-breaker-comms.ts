/**
 * Circuit breaker customer communications.
 *
 * When circuit opens (closed→open transition), affected customers with paid+queued bundles
 * receive an apology email and their bundle TTL is extended by 7 days.
 *
 * Idempotency: each action is gated by billing_events row. Double-open trigger
 * won't double-extend or double-email because:
 *   - email sender checks billing_events for prior send
 *   - TTL extension checks billing_events for kind='outage_compensation'
 *
 * @module lib/fulfillment/circuit-breaker-comms
 */

import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { createServerClient } from '@/seed/db/client'
import { sendBundleOutageApologyEmail } from '@/lib/billing/email/send-bundle-outage-apology-email'

const OUTAGE_COMPENSATION_KIND = 'outage_compensation'
const EXTEND_DAYS = 7
const EXTEND_SECONDS = EXTEND_DAYS * 24 * 60 * 60
/** Look back 24h for paid purchases that may have queued videos. */
const LOOKBACK_SECONDS = 24 * 60 * 60

interface AffectedPurchaseRow {
  id: string
  user_id: string
  expires_at: number | null
}

interface UserEmailRow {
  email?: string
  locale?: string
}

interface BillingEventRow {
  id: string
}

/**
 * Check if TTL was already extended for this purchase (idempotency).
 * Looks for 'outage_compensation' billing_events row with license_nonce = purchaseId prefix.
 */
async function isAlreadyCompensated(purchaseId: string): Promise<boolean> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('billing_events')
      .select('id')
      .eq('event_type', OUTAGE_COMPENSATION_KIND)
      .eq('license_nonce', purchaseId.slice(0, 16))
      .single()
    return (data as BillingEventRow | null) !== null
  } catch {
    return false
  }
}

/**
 * Fetch affected purchases: paid one-time bundles with queued videos created in last 24h.
 * These customers are waiting for render and should receive apology + TTL extension.
 */
async function fetchAffectedPurchases(): Promise<AffectedPurchaseRow[]> {
  const db = createServerClient()
  const nowSec = Math.floor(Date.now() / 1000)
  const since = nowSec - LOOKBACK_SECONDS

  const { data } = await db
    .from('user_purchases')
    .select('id, user_id, expires_at')
    .eq('kind', 'one_time')
    .eq('status', 'paid')
    .gte('created_at', since)

  return (data as AffectedPurchaseRow[] | null) ?? []
}

async function fetchUserInfo(userId: string): Promise<{ email: string; locale: string } | null> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('user')
      .select('email, locale')
      .eq('id', userId)
      .single()
    const row = data as UserEmailRow | null
    if (!row?.email) return null
    return { email: row.email, locale: row.locale ?? 'vi' }
  } catch (err) {
    logger.error('[CircuitBreakerComms] fetchUserInfo failed', err instanceof Error ? err : undefined, { userId })
    return null
  }
}

/**
 * Extend expires_at by EXTEND_DAYS and record outage_compensation billing_event.
 * Returns false if already compensated (idempotent).
 */
async function extendTtlWithAudit(
  purchase: AffectedPurchaseRow,
  openedAt: number,
): Promise<boolean> {
  const alreadyDone = await isAlreadyCompensated(purchase.id)
  if (alreadyDone) return false

  const db = createServerClient()
  const nowSec = Math.floor(Date.now() / 1000)
  const currentExpiry = purchase.expires_at ?? nowSec
  const newExpiry = currentExpiry + EXTEND_SECONDS

  await db
    .from('user_purchases')
    .update({ expires_at: newExpiry, updated_at: nowSec })
    .eq('id', purchase.id)

  await db.from('billing_events').insert({
    user_id: purchase.user_id,
    license_nonce: purchase.id.slice(0, 16),
    event_type: OUTAGE_COMPENSATION_KIND,
    event_category: 'compensation',
    event_data: { purchase_id: purchase.id, opened_at: openedAt, extend_days: EXTEND_DAYS },
    email_sent: false,
    email_template: null,
    processed: true,
    processed_at: new Date().toISOString(),
  })

  return true
}

/**
 * Notify customers when circuit first opens.
 * Called fire-and-forget via executionCtx.waitUntil in circuit-breaker.ts.
 *
 * For each paid+queued bundle from last 24h:
 *   1. Extend TTL by 7 days (idempotent via billing_events)
 *   2. Send outage apology email (idempotent via billing_events)
 *
 * @returns counts of notified customers and TTL extensions
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
        // 1. Extend TTL (idempotent)
        const extended = await extendTtlWithAudit(purchase, openedAt)
        if (extended) ttlExtended++

        // 2. Send email (idempotent via send-bundle-outage-apology-email.ts)
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
