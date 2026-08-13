/**
 * NOWPayments Mass Payout
 *
 * Sends single payouts at 5/sec rate limit.
 * Idempotent via payout_batches UNIQUE(id).
 * If NOWPAYMENTS_API_KEY not set → mock mode returns synthetic external_payment_id.
 * Amounts stored as INTEGER cents; converted to USDT float at API boundary.
 *
 * @module payouts/nowpayments-mass-payout
 */

import { getD1 } from '@/seed/db/client'
import { decryptSecret } from '@/tree/crypto/encrypt-secret'
import { fromCents, sanitizeErrorText } from './commission-cents'
import { logger } from '@/seed/utils/logger-utility'
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError, FailureKind } from '@/seed/types/failure-kind'

const NOWPAYMENTS_API_BASE = 'https://api.nowpayments.io/v1'
const RATE_LIMIT_MS = 200 // 5 requests/sec

interface PayoutPayload {
  address: string
  currency: string
  amountUsdt: number
  ipn_callback_url: string
  extraId?: string
}

interface WithdrawalResponse {
  id: string
  status: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Send a single payout via NOWPayments API.
 * Returns external_payment_id on success.
 */
async function sendSinglePayout(
  apiKey: string,
  payload: PayoutPayload,
): Promise<string> {
  // Circuit breaker: check if NOWPayments is available
  if (!shouldAllowRequest('nowpayments')) {
    throw new Error('Circuit breaker open for NOWPayments — too many failures')
  }

  try {
    const resp = await fetch(`${NOWPAYMENTS_API_BASE}/payout`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        withdrawals: [
          {
            address: payload.address,
            currency: 'usdttrc20',
            amount: payload.amountUsdt,
            ipn_callback_url: payload.ipn_callback_url,
            extra_id: payload.extraId,
          },
        ],
      }),
    })

    if (!resp.ok) {
      const rawErr = await resp.text()
      // H3: sanitize before logging — strips addresses, keys
      const safeErr = sanitizeErrorText(rawErr)
      logger.error('[NOWPayments] Payout API error', new Error(safeErr), {
        status: resp.status,
      })
      // Circuit breaker: classify HTTP status
      const kind = resp.status === 401 || resp.status === 403
        ? FailureKind.AUTH_FAILURE
        : resp.status === 429
          ? FailureKind.RATE_LIMIT
          : FailureKind.SERVER_ERROR
      recordFailure('nowpayments', kind)
      throw new Error(`NOWPayments payout API error ${resp.status}: ${safeErr}`)
    }

    const data = (await resp.json()) as { withdrawals?: WithdrawalResponse[] }
    const withdrawal = data.withdrawals?.[0]
    if (!withdrawal?.id) {
      throw new Error('NOWPayments payout response missing withdrawal id')
    }

    // Circuit breaker: record success
    recordSuccess('nowpayments')
    return withdrawal.id
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error
    if (error instanceof Error && error.message.includes('NOWPayments payout API')) throw error
    // Circuit breaker: classify network errors
    const kind = classifyError(error)
    recordFailure('nowpayments', kind)
    throw error
  }
}

export interface BatchQueueInput {
  batchId: string
  affiliateId: string
  /** Payout amount in INTEGER cents */
  totalCents: number
  recipientAddrEncrypted: string
  network: string
}

/**
 * Queue and send a payout batch.
 * Decrypts recipient address and sends payout at 5/sec rate.
 * Idempotent: already-confirmed or already-sending batches skip silently.
 * Converts cents → USDT float at API call boundary.
 */
export async function queueBatch(input: BatchQueueInput): Promise<{ externalPaymentId: string }> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const apiKey = process.env.NOWPAYMENTS_API_KEY

  // Check if already sent or in-flight (idempotency — short-circuit for confirmed or sending)
  const existing = await db
    .prepare(
      `SELECT external_payment_id, status FROM payout_batches WHERE id = ?`,
    )
    .bind(input.batchId)
    .first<{ external_payment_id: string | null; status: string }>()

  if (existing && (existing.status === 'confirmed' || existing.status === 'sending')) {
    if (existing.status === 'confirmed' && existing.external_payment_id) {
      return { externalPaymentId: existing.external_payment_id }
    }
    // status === 'sending': treat as already in progress, return existing id or sentinel
    return { externalPaymentId: existing.external_payment_id ?? 'in_progress' }
  }

  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(`UPDATE payout_batches SET status = 'sending' WHERE id = ?`)
    .bind(input.batchId)
    .run()

  let externalPaymentId: string

  if (!apiKey) {
    // Mock mode: synthetic ID for test/dev
    externalPaymentId = `mock_${input.batchId}_${now}`
    await sleep(RATE_LIMIT_MS)
  } else {
    const plainAddr = await decryptSecret(
      input.recipientAddrEncrypted,
      process.env.PAYOUT_ENC_KEY,
    )
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/nowpayments-payout`

    // C1: convert INTEGER cents → USDT float at API boundary
    const amountUsdt = fromCents(input.totalCents)

    try {
      externalPaymentId = await sendSinglePayout(apiKey, {
        address: plainAddr,
        currency: 'usdttrc20',
        amountUsdt,
        ipn_callback_url: callbackUrl,
        extraId: input.batchId,
      })
    } catch (err) {
      // H3: on API failure, mark DB row as failed instead of throwing
      // Prevents stuck 'sending' state and double-payout on retry
      const safeMsg = sanitizeErrorText(err instanceof Error ? err.message : String(err))
      try {
        await db
          .prepare(
            `UPDATE payout_batches SET status = 'failed', failed_reason = ? WHERE id = ?`,
          )
          .bind(safeMsg, input.batchId)
          .run()
        logger.error('[NOWPayments] Mass payout failed — status updated to failed', undefined, {
          batchId: input.batchId,
          error: safeMsg,
        })
      } catch (updateErr) {
        logger.error('[NOWPayments] Failed to update payout_batches status after API error', undefined, {
          batchId: input.batchId,
          updateError: String(updateErr),
        })
      }
      throw new Error(safeMsg)
    }
    await sleep(RATE_LIMIT_MS)
  }

  await db
    .prepare(
      `UPDATE payout_batches SET external_payment_id = ? WHERE id = ?`,
    )
    .bind(externalPaymentId, input.batchId)
    .run()

  return { externalPaymentId }
}
