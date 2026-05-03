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
}

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
      .prepare(`SELECT id, user_id, payment_id, amount_cents, status FROM user_purchases WHERE id = ?1 AND kind = 'one_time'`)
      .bind(body.purchaseId)
      .first<PurchaseRow>()

    if (!purchase || purchase.user_id !== user.id) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
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
