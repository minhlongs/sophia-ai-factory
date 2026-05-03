/**
 * PATCH /api/admin/refunds/[id] — approve or reject a refund (admin only)
 * POST /api/admin/refunds/[id]/mark-refunded — see nested route
 *
 * @module app/api/admin/refunds/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getRefundById, updateRefundStatus } from '@/lib/refunds/refund-repo'
import { writeAuditLog } from '@/lib/admin/audit-log'
import { sendRefundApprovedEmail, sendRefundRejectedEmail } from '@/lib/billing/email/send-refund-emails'
import { getD1Raw } from '@/seed/db/client'
import { getErrorMessage } from '@/seed/utils/to-error'
import { logger } from '@/seed/utils/logger-utility'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNotes: z.string().max(500).optional(),
})

interface UserRow { email: string }

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await context.params

  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid body', details: getErrorMessage(err) }, { status: 400 })
  }

  try {
    const refund = await getRefundById(id)
    if (!refund) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (refund.status !== 'pending') {
      return NextResponse.json({ error: 'Already reviewed', status: refund.status }, { status: 409 })
    }

    const newStatus = body.action === 'approve' ? 'approved' : 'rejected'
    await updateRefundStatus({ id, status: newStatus, reviewedByUserId: auth.user.id, adminNotes: body.adminNotes })

    await writeAuditLog({
      actorUserId: auth.user.id,
      actionType: body.action === 'approve' ? 'refund_approved' : 'refund_rejected',
      targetUserId: refund.user_id,
      payload: { refundId: id, purchaseId: refund.purchase_id, adminNotes: body.adminNotes },
    })

    // Fetch user email for notification
    const db = await getD1Raw()
    const userRow = await db.prepare('SELECT email FROM user WHERE id = ?1').bind(refund.user_id).first<UserRow>()
    if (userRow) {
      if (body.action === 'approve') {
        sendRefundApprovedEmail({ userEmail: userRow.email, purchaseId: refund.purchase_id }).catch(() => null)
      } else {
        sendRefundRejectedEmail({ userEmail: userRow.email, purchaseId: refund.purchase_id, adminNotes: body.adminNotes }).catch(() => null)
      }
    }

    return NextResponse.json({ id, status: newStatus })
  } catch (err) {
    logger.error('[AdminRefunds] PATCH failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
