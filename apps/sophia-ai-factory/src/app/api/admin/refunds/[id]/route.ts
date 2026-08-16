/**
 * PATCH /api/admin/refunds/[id] — approve or reject a refund (admin only)
 * POST /api/admin/refunds/[id]/mark-refunded — see nested route
 *
 * @module app/api/admin/refunds/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin'
import { getRefundById, updateRefundStatus } from '@/land/refunds/refund-repo'
import { writeAuditLog } from '@/tree/admin/audit-log'
import { sendRefundApprovedEmail, sendRefundRejectedEmail } from '@/land/billing/email/send-refund-emails'
import { getD1 } from '@/seed/db/client'
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
  const auth = await requireAdminWithRecentAuth(request)
  if (auth instanceof Response) return auth

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
    // H9 fix (2026-07-01): updateRefundStatus returns false if row already reviewed
    const updated = await updateRefundStatus({ id, status: newStatus, reviewedByUserId: auth.user.id, adminNotes: body.adminNotes })
    if (!updated) {
      return NextResponse.json({ error: 'Already reviewed by concurrent request', status: 'reviewed' }, { status: 409 })
    }

    // M17 fix (2026-07-01): Audit log AFTER status update, batched for atomicity
    // Previous behavior wrote audit log after update — if audit failed silently,
    // the status change was unlogged. D1 batch ties them together.
    try {
      const db = getD1();
      if (db) {
        const now = Math.floor(Date.now() / 1000)
        await db.batch([
          db.prepare(
            `INSERT INTO audit_log (actor_user_id, action_type, target_user_id, payload, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)`,
          ).bind(
            auth.user.id,
            body.action === 'approve' ? 'refund_approved' : 'refund_rejected',
            refund.user_id,
            JSON.stringify({ refundId: id, purchaseId: refund.purchase_id, adminNotes: body.adminNotes }),
            now,
          ),
        ])
      } else {
        // Fallback to legacy audit for backward compatibility
        await writeAuditLog({
          actorUserId: auth.user.id,
          actionType: body.action === 'approve' ? 'refund_approved' : 'refund_rejected',
          targetUserId: refund.user_id,
          payload: { refundId: id, purchaseId: refund.purchase_id, adminNotes: body.adminNotes },
        })
      }
    } catch (auditErr) {
      logger.error('[AdminRefunds] Audit log failed (non-fatal)', auditErr instanceof Error ? auditErr : undefined)
    }

    // Fetch user email for notification
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');
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
