/**
 * POST /api/admin/refunds/[id]/mark-refunded
 * Admin: mark refund as complete, revoke video access, send completion email.
 *
 * @module app/api/admin/refunds/[id]/mark-refunded/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getRefundById, updateRefundStatus } from '@/lib/refunds/refund-repo'
import { revokeAccessByPurchaseId } from '@/lib/db/repositories/videos-repo'
import { writeAuditLog } from '@/lib/admin/audit-log'
import { sendRefundCompletedEmail } from '@/lib/billing/email/send-refund-emails'
import { getD1Raw } from '@/lib/db/client'
import { getErrorMessage } from '@/lib/utils/to-error'
import { logger } from '@/lib/utils/logger-utility'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  tx_hash: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
})

interface UserRow { email: string }

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await context.params

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid body', details: getErrorMessage(err) }, { status: 400 })
  }

  try {
    const refund = await getRefundById(id)
    if (!refund) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (refund.status !== 'approved') {
      return NextResponse.json({ error: 'Must be approved before marking refunded', status: refund.status }, { status: 409 })
    }

    await updateRefundStatus({
      id,
      status: 'refunded',
      reviewedByUserId: auth.user.id,
      adminNotes: body.notes,
      refundTxHash: body.tx_hash,
    })

    // Revoke video access for this purchase
    await revokeAccessByPurchaseId(refund.purchase_id)

    await writeAuditLog({
      actorUserId: auth.user.id,
      actionType: 'refund_marked_refunded',
      targetUserId: refund.user_id,
      payload: { refundId: id, purchaseId: refund.purchase_id, txHash: body.tx_hash },
    })

    // Send completion email
    const db = await getD1Raw()
    const userRow = await db.prepare('SELECT email FROM user WHERE id = ?1').bind(refund.user_id).first<UserRow>()
    if (userRow) {
      sendRefundCompletedEmail({
        userEmail: userRow.email,
        purchaseId: refund.purchase_id,
        txHash: body.tx_hash,
      }).catch(() => null)
    }

    logger.info('[AdminRefunds] Marked refunded', { id, txHash: body.tx_hash })
    return NextResponse.json({ id, status: 'refunded', tx_hash: body.tx_hash })
  } catch (err) {
    logger.error('[AdminRefunds] mark-refunded failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
