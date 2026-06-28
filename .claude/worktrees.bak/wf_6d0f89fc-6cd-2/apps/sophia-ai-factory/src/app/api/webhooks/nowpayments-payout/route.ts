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
import { getD1 } from '@/seed/db/client'
import { inngest } from '@/seed/inngest/client'
import { logger } from '@/seed/utils/logger-utility'

function getCloudflareEnv(): Record<string, unknown> | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
    if (env) return env
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')]
    return ctx?.env ?? null
  } catch {
    return null
  }
}

function getNowPaymentsIpnSecret(): string | null {
  const env = getCloudflareEnv()
  const secret = env?.NOWPAYMENTS_IPN_SECRET
  if (typeof secret === 'string') return secret
  return process.env.NOWPAYMENTS_IPN_SECRET ?? null
}

interface PayoutIpnPayload {
  withdrawal_id: string
  status: string
  extra_id?: string
  amount?: number
  currency?: string
}

export async function POST(request: NextRequest) {
  const nowPaymentsIpnSecret = getNowPaymentsIpnSecret()
  if (!nowPaymentsIpnSecret) {
    logger.error('[NOWPayments Payout IPN] NOWPAYMENTS_IPN_SECRET not configured')
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-nowpayments-sig')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  const isValid = await verifyIpnSignature(rawBody, signature, nowPaymentsIpnSecret)
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

  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const now = Math.floor(Date.now() / 1000);

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
