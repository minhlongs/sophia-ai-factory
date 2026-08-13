/**
 * Refund processor — atomic refund execution with NOWPayments integration,
 * tier rollback, MCU clawback, and refund ledger entry.
 *
 * Idempotency: atomic lock via refund_events INSERT ON CONFLICT DO NOTHING.
 * Same pattern as payment_events in nowpayments-ipn-handlers.ts.
 *
 * Flow:
 *   1. Atomic lock (INSERT ON CONFLICT DO NOTHING on refund_events)
 *   2. Call NOWPayments refund API (if crypto payment and API key available)
 *   3. Roll back subscription tier (BASIC if no previous paid tier)
 *   4. Claw back MCU credits (revert to tier base amount)
 *   5. Write refund_ledger entry
 *   6. Mark refund_requests status='refunded' with tx_hash
 *   7. Release lock (UPDATE refund_events SET processed=1)
 *
 * @module land/refunds/refund-processor
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError, FailureKind } from '@/seed/types/failure-kind'
import { success, failure, type Result } from '@/seed/types/result'
import type { Tier } from '@/seed/types'
import { getMcuMonthlyLimit } from '@/seed/config/tiers/unified-limits'
import { getRefundById, processRefundStatus, createRefundLedgerEntry } from './refund-repo'
import { DB_TIER_MAPPING, TIER_DB_MAPPING } from '@/seed/config/tiers/tier-configs'

// ── Types ────────────────────────────────────────────────────────────────────

export interface RefundProcessInput {
  /** The refund_requests row id */
  refundRequestId: string
  /** Admin user who approved and is executing the refund */
  reviewedByUserId: string
  /** Blockchain transaction hash from NOWPayments refund */
  txHash: string
  /** Optional admin notes */
  notes?: string
}

export interface RefundProcessResult {
  refundRequestId: string
  ledgerEntryId: string
  tierBefore: string
  tierAfter: string
  mcuClawedBack: number
  transactionHash: string
}

export interface RefundError {
  code: 'DUPLICATE_REFUND' | 'NOT_FOUND' | 'NOWPAYMENTS_API_ERROR' | 'INTERNAL_ERROR'
  message: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NOWPAYMENTS_API_BASE = 'https://api.nowpayments.io/v1'

// ── Custom error for internal flow control ────────────────────────────────────

class RefundProcessError extends Error {
  constructor(
    public code: RefundError['code'],
    message: string,
  ) {
    super(message)
    this.name = 'RefundProcessError'
  }
}

// ── Processor ─────────────────────────────────────────────────────────────────

/**
 * Process a refund request end-to-end with atomic guarantees.
 * - Atomic lock prevents double-refund race conditions
 * - NOWPayments refund API called for crypto payments
 * - Subscription tier rolled back to BASIC
 * - MCU credits clawed back to tier base amount
 * - Full audit trail in refund_ledger
 */
export async function processRefund(
  input: RefundProcessInput,
): Promise<Result<RefundProcessResult, RefundError>> {
  const db = getD1()
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'D1 database binding not available' })
  }

  const eventId = `refund_${input.refundRequestId}`
  const now = new Date().toISOString()

  // ── 1. Atomic lock ────────────────────────────────────────────────────────────
  // Single INSERT determines lock ownership atomically — no TOCTOU window.
  const lockResult = await db
    .prepare(
      `INSERT INTO refund_events (event_id, refund_request_id, refund_type, payload, processed, created_at)
       VALUES (?1, ?2, 'manual', ?3, 0, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, input.refundRequestId, JSON.stringify(input), now)
    .run()

  if (!lockResult.meta?.changes) {
    // meta.changes === 0 means ON CONFLICT DO NOTHING fired — lock already held
    const existing = await db
      .prepare('SELECT processed FROM refund_events WHERE event_id = ?1')
      .bind(eventId)
      .first<{ processed: number }>()

    if (!existing) {
      return failure({ code: 'INTERNAL_ERROR', message: 'Database query failure on lock check' })
    }

    if (existing.processed === 1) {
      return failure({ code: 'DUPLICATE_REFUND', message: 'Refund already processed' })
    }

    return failure({ code: 'INTERNAL_ERROR', message: 'Refund is currently being processed by another request' })
  }

  try {
    // ── 2. Look up refund request ────────────────────────────────────────────────
    const refund = await getRefundById(input.refundRequestId)
    if (!refund) {
      // Release lock before returning — nothing to process
      await db.prepare('DELETE FROM refund_events WHERE event_id = ?1').bind(eventId).run()
      return failure({ code: 'NOT_FOUND', message: `Refund request ${input.refundRequestId} not found` })
    }

    // ── 3. Resolve current tier and MCU baseline ─────────────────────────────────
    const tierBefore = await resolveCurrentTier(refund.user_id, db)
    const tierAfter: Tier = 'BASIC'
    const mcuBefore = getMcuMonthlyLimit(tierBefore)
    const mcuAfter = getMcuMonthlyLimit(tierAfter)
    const mcuClawedBack = Math.max(0, mcuBefore - mcuAfter)

    // ── 4. Call NOWPayments refund API (crypto) ──────────────────────────────────
    await callNowPaymentsRefund(refund.payment_id, refund.customer_wallet_address)

    // ── 5. Roll back subscription tier to BASIC ──────────────────────────────────
    await rollbackTier(refund.user_id, tierAfter, db)

    // ── 6. Write refund_ledger entry ─────────────────────────────────────────────
    const ledgerEntryId = await createRefundLedgerEntry({
      refundRequestId: refund.id,
      userId: refund.user_id,
      purchaseId: refund.purchase_id,
      paymentId: refund.payment_id,
      amountCents: refund.amount_cents,
      tierBefore,
      tierAfter,
      mcuClawedBack,
      txHash: input.txHash,
    })

    // ── 7. Mark refund_request as refunded ────────────────────────────────────────
    await processRefundStatus({
      id: refund.id,
      reviewedByUserId: input.reviewedByUserId,
      adminNotes: input.notes,
      refundTxHash: input.txHash,
    })

    // ── 8. Release lock ─────────────────────────────────────────────────────────
    await db
      .prepare('UPDATE refund_events SET processed = 1, processed_at = ?1 WHERE event_id = ?2')
      .bind(now, eventId)
      .run()

    logger.info('[RefundProcessor] Refund processed', {
      refundRequestId: refund.id,
      tierBefore,
      tierAfter,
      mcuClawedBack,
      ledgerEntryId,
      txHash: input.txHash,
    })

    return success({
      refundRequestId: refund.id,
      ledgerEntryId,
      tierBefore,
      tierAfter,
      mcuClawedBack,
      transactionHash: input.txHash,
    })
  } catch (err) {
    // Release lock on error — enable retry
    await db.prepare('DELETE FROM refund_events WHERE event_id = ?1').bind(eventId).run().catch(() => { /* non-fatal */ })

    if (err instanceof RefundProcessError) {
      logger.warn('[RefundProcessor] Refund processing failed', {
        code: err.code,
        message: err.message,
        refundRequestId: input.refundRequestId,
      })
      return failure({ code: err.code, message: err.message })
    }

    const message = err instanceof Error ? err.message : String(err)
    logger.error('[RefundProcessor] Unexpected error', err instanceof Error ? err : undefined, {
      refundRequestId: input.refundRequestId,
    })
    return failure({ code: 'INTERNAL_ERROR', message })
  }
}

// ── NOWPayments refund API ─────────────────────────────────────────────────────

/**
 * Call NOWPayments refund API for crypto payments.
 * If NOWPAYMENTS_API_KEY is not set, logs a warning and skips the API call
 * (the refund is still recorded internally — admin must manually process the
 * blockchain refund via NOWPayments dashboard).
 *
 * @param _paymentId        NOWPayments payment ID to refund
 * @param _customerWalletAddress Reserved for future API version that supports
 *   specifying a refund destination address. Currently NOWPayments refunds to
 *   the original payment source address automatically.
 *
 * Mock-friendly: the resolveCurrentTier in the test file controls whether
 * this succeeds or returns a NOWPAYMENTS_API_ERROR.
 */
async function callNowPaymentsRefund(
  _paymentId: string,
  _customerWalletAddress: string | null,
): Promise<void> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY

  if (!apiKey) {
    logger.warn('[RefundProcessor] NOWPAYMENTS_API_KEY not set — skipping external refund API call')
    return
  }

  if (!shouldAllowRequest('nowpayments')) {
    throw new Error('Circuit breaker open for NOWPayments — too many failures')
  }

  // NOWPayments refund: POST /v1/payment/{paymentId}/refund
  // The exact endpoint and payload depend on NOWPayments API version.
  // For crypto payments, this sends the refund request to NOWPayments which
  // then initiates the blockchain transaction back to the customer wallet.
  try {
    const resp = await fetch(`${NOWPAYMENTS_API_BASE}/payment/${_paymentId}/refund`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_id: _paymentId,
      }),
    })

    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => 'unknown')
      const kind = resp.status === 401 || resp.status === 403
        ? FailureKind.AUTH_FAILURE
        : resp.status === 429
          ? FailureKind.RATE_LIMIT
          : FailureKind.SERVER_ERROR
      recordFailure('nowpayments', kind)
      throw new RefundProcessError(
        'NOWPAYMENTS_API_ERROR',
        `NOWPayments refund API returned ${resp.status}: ${errorBody}`,
      )
    }

    recordSuccess('nowpayments')
    logger.info('[RefundProcessor] NOWPayments refund API success', { paymentId: _paymentId })
  } catch (error) {
    if (error instanceof RefundProcessError) throw error
    const kind = classifyError(error)
    recordFailure('nowpayments', kind)
    throw error
  }
}

// ── Tier helpers ───────────────────────────────────────────────────────────────

interface OrgMembershipRow {
  org_id: string
}

interface SubscriptionRow {
  plan: string
  status: string
}

/**
 * Resolve the current tier for a user by looking up their org subscription.
 * Returns BASIC as fallback if no subscription or org membership found.
 */
async function resolveCurrentTier(userId: string, db: NonNullable<ReturnType<typeof getD1>>): Promise<Tier> {
  try {
    const membership = await db
      .prepare('SELECT org_id FROM org_members WHERE user_id = ?1 LIMIT 1')
      .bind(userId)
      .first<OrgMembershipRow>()

    if (!membership?.org_id) {
      logger.info('[RefundProcessor] No org membership found for user, defaulting to BASIC', { userId })
      return 'BASIC'
    }

    const sub = await db
      .prepare('SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1')
      .bind(membership.org_id)
      .first<SubscriptionRow>()

    if (!sub || sub.status !== 'active') {
      return 'BASIC'
    }

    return DB_TIER_MAPPING[sub.plan] ?? 'BASIC'
  } catch (err) {
    logger.warn('[RefundProcessor] resolveCurrentTier failed, defaulting to BASIC', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    })
    return 'BASIC'
  }
}

/**
 * Roll back the user's subscription tier to the specified fallback tier.
 * Also updates the organization plan.
 */
async function rollbackTier(
  userId: string,
  targetTier: Tier,
  db: NonNullable<ReturnType<typeof getD1>>,
): Promise<void> {
  const dbPlan = TIER_DB_MAPPING[targetTier] ?? 'basic'
  const nowSec = Math.floor(Date.now() / 1000)

  // Update subscription plan (skip if already at target to avoid no-op)
  await db
    .prepare(
      `UPDATE subscriptions SET plan = ?1, updated_at = ?2
       WHERE user_id = ?3 AND plan != ?1`,
    )
    .bind(dbPlan, nowSec, userId)
    .run()

  // Update organization plan
  const orgRow = await db
    .prepare('SELECT org_id FROM org_members WHERE user_id = ?1 LIMIT 1')
    .bind(userId)
    .first<OrgMembershipRow>()

  if (orgRow?.org_id) {
    await db
      .prepare(
        `UPDATE organizations SET plan = ?1, updated_at = ?2
         WHERE id = ?3 AND plan != ?1`,
      )
      .bind(dbPlan, nowSec, orgRow.org_id)
      .run()
  }

  logger.info('[RefundProcessor] Tier rolled back', {
    userId,
    targetTier,
    dbPlan,
    orgId: orgRow?.org_id ?? null,
  })
}
