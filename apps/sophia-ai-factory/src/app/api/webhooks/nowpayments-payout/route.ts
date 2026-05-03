/**
 * NOWPayments Payout IPN Webhook
 *
 * Receives payout confirmation callbacks from NOWPayments.
 * Verifies HMAC-SHA512 signature, updates payout_batches.status = confirmed,
 * and emits payout.confirmed Inngest event.
 *
 * @module app/api/webhooks/nowpayments-payout
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyIpnSignature } from '@/tree/clients/nowpayments-client'
import { getD1Raw } from '@/seed/db/client'
import { inngest } from '@/lib/inngest/client'
import { logger } from '@/seed/utils/logger-utility'

const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET

interface PayoutIpnPayload {
  withdrawal_id: string
  status: string
  extra_id?: string
  amount?: number
  currency?: string
}

export async function POST(request: NextRequest) {
  if (!IPN_SECRET) {
    logger.error('[NOWPayments Payout IPN] NOWPAYMENTS_IPN_SECRET not configured')
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-nowpayments-sig')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  const isValid = await verifyIpnSignature(rawBody, signature, IPN_SECRET)
  if (!isValid) {
    logger.warn('[NOWPayments Payout IPN] Invalid HMAC signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let ipn: PayoutIpnPayload
  try {
    ipn = JSON.parse(rawBody) as PayoutIpnPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!ipn.withdrawal_id || !ipn.status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (ipn.status !== 'finished' && ipn.status !== 'confirmed') {
    return NextResponse.json({ received: true, action: 'no-op', status: ipn.status })
  }

  const batchId = ipn.extra_id
  if (!batchId) {
    logger.warn('[NOWPayments Payout IPN] Missing extra_id (batchId)', { withdrawal_id: ipn.withdrawal_id })
    return NextResponse.json({ received: true, action: 'no-op', reason: 'no batch id' })
  }

  const db = await getD1Raw()
  const now = Math.floor(Date.now() / 1000)

  // H4: idempotent — do NOT overwrite finalized_at on IPN re-receipt
  await db
    .prepare(
      `UPDATE payout_batches
       SET status = 'confirmed', external_payment_id = ?, finalized_at = ?
       WHERE id = ? AND finalized_at IS NULL`,
    )
    .bind(ipn.withdrawal_id, now, batchId)
    .run()

  await inngest.send({
    name: 'payout.confirmed',
    data: {
      batchId,
      externalPaymentId: ipn.withdrawal_id,
      confirmedAt: now,
    },
  })

  return NextResponse.json({ received: true, batchId })
}
