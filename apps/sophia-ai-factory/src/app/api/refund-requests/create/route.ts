/**
 * POST /api/refund-requests/create
 * Auth required. Validates purchase ownership, creates refund_request row, notifies admin.
 *
 * @module app/api/refund-requests/create/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session'
import { getD1Raw } from '@/seed/db/client'
import { createRefundRequest, getRefundByPurchaseAndUser } from '@/land/refunds/refund-repo'
import { sendRefundReceivedEmail } from '@/land/billing/email/send-refund-emails'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  purchaseId: z.string().min(1),
  reason: z.string().min(10).max(1000),
  customerWalletAddress: z.string().min(10).max(200),
})

interface PurchaseRow {
  id: string
  user_id: string
  payment_id: string
  amount_cents: number
  status: string
  created_at: number
  paid_at: number | null
}

/** Homepage promise — `landing.refund.window` claims 30-day money-back guarantee. */
const REFUND_WINDOW_DAYS = 30
const SECONDS_PER_DAY = 86_400

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: getErrorMessage(err) }, { status: 400 })
  }

  try {
    // Verify purchase ownership
    const db = await getD1Raw()
    const purchase = await db
      .prepare(`SELECT id, user_id, payment_id, amount_cents, status, created_at, paid_at FROM user_purchases WHERE id = ?1 AND kind = 'one_time'`)
      .bind(body.purchaseId)
      .first<PurchaseRow>()

    if (!purchase || purchase.user_id !== user.id) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    // 30-day refund window enforcement (P29 — matches homepage `landing.refund.window` promise).
    // Uses paid_at when present (real refund clock starts on settlement); falls back to created_at.
    const purchaseEpochSec = purchase.paid_at ?? purchase.created_at
    const nowEpochSec = Math.floor(Date.now() / 1000)
    const daysSincePurchase = (nowEpochSec - purchaseEpochSec) / SECONDS_PER_DAY
    if (daysSincePurchase > REFUND_WINDOW_DAYS) {
      return NextResponse.json(
        {
          error: 'refund_window_expired',
          message: `Refunds are available within ${REFUND_WINDOW_DAYS} days of purchase. This purchase is ${Math.floor(daysSincePurchase)} days old.`,
          windowDays: REFUND_WINDOW_DAYS,
          daysSincePurchase: Math.floor(daysSincePurchase),
        },
        { status: 422 },
      )
    }

    // One refund per purchase
    const existing = await getRefundByPurchaseAndUser(body.purchaseId, user.id)
    if (existing) {
      return NextResponse.json({ error: 'Refund already requested', refundId: existing.id }, { status: 409 })
    }

    const refundId = await createRefundRequest({
      userId: user.id,
      purchaseId: body.purchaseId,
      paymentId: purchase.payment_id ?? '',
      amountCents: purchase.amount_cents ?? 0,
      reason: body.reason,
      customerWalletAddress: body.customerWalletAddress,
    })

    // Fire-and-forget notification
    sendRefundReceivedEmail({
      userEmail: user.email,
      purchaseId: body.purchaseId,
      reason: body.reason,
    }).catch(() => null)

    logger.info('[RefundCreate] Request created', { refundId, userId: user.id, purchaseId: body.purchaseId })
    return NextResponse.json({ refundId, status: 'pending' }, { status: 201 })
  } catch (err) {
    logger.error('[RefundCreate] Failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
