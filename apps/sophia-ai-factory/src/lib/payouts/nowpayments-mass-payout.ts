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

import { getD1Raw } from '@/lib/db/client'
import { decryptSecret } from '@/lib/crypto/encrypt-secret'
import { fromCents, sanitizeErrorText } from './commission-cents'
import { logger } from '@/lib/utils/logger-utility'

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
    throw new Error(`NOWPayments payout API error ${resp.status}: ${safeErr}`)
  }

  const data = (await resp.json()) as { withdrawals?: WithdrawalResponse[] }
  const withdrawal = data.withdrawals?.[0]
  if (!withdrawal?.id) {
    throw new Error('NOWPayments payout response missing withdrawal id')
  }
  return withdrawal.id
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
 * Idempotent: already-confirmed batches skip silently.
 * Converts cents → USDT float at API call boundary.
 */
export async function queueBatch(input: BatchQueueInput): Promise<{ externalPaymentId: string }> {
  const db = await getD1Raw()
  const apiKey = process.env.NOWPAYMENTS_API_KEY

  // Check if already sent (idempotency)
  const existing = await db
    .prepare(
      `SELECT external_payment_id, status FROM payout_batches WHERE id = ?`,
    )
    .bind(input.batchId)
    .first<{ external_payment_id: string | null; status: string }>()

  if (existing?.status === 'confirmed' && existing.external_payment_id) {
    return { externalPaymentId: existing.external_payment_id }
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
      // H3: sanitize error message before re-throw
      const safeMsg = sanitizeErrorText(err instanceof Error ? err.message : String(err))
      throw new Error(safeMsg)
    }
    await sleep(RATE_LIMIT_MS)
  }

  await db
    .prepare(
      `UPDATE payout_batches
       SET external_payment_id = ?
       WHERE id = ?`,
    )
    .bind(externalPaymentId, input.batchId)
    .run()

  return { externalPaymentId }
}
