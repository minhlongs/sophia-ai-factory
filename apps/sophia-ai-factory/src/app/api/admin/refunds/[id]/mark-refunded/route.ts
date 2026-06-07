/**
 * POST /api/admin/refunds/[id]/mark-refunded
 * Admin: mark refund as complete, revoke video access, send completion email.
 *
 * Idempotency: accepts `Idempotency-Key` header. Duplicate keys (within 24h)
 * return the cached response without re-executing side effects.
 *
 * @module app/api/admin/refunds/[id]/mark-refunded/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getRefundById } from '@/land/refunds/refund-repo'
import { revokeAccessByPurchaseId } from '@/seed/db/repositories/videos-repo'
import { writeAuditLog } from '@/tree/admin/audit-log'
import { sendRefundCompletedEmail } from '@/land/billing/email/send-refund-emails'
import { getD1Raw } from '@/seed/db/client'
import { getErrorMessage } from '@/seed/utils/to-error'
import { logger } from '@/seed/utils/logger-utility'

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

  // FIX-10: idempotency guard — check header before any side effects
  const idempotencyKey = request.headers.get('Idempotency-Key') ?? undefined
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, id)
    if (cached) {
      logger.info('[AdminRefunds] Idempotent duplicate — returning cached', { id, key: idempotencyKey })
      return NextResponse.json(cached, { status: 200 })
    }
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid body', details: getErrorMessage(err) }, { status: 400 })
  }

  try {
    const refund = await getRefundById(id)
    if (!refund) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // SECURITY FIX (Issue 5): Prevent double-processing — check both status and tx_hash
    // IPN handler may have already processed this refund (setting status='refunded' + refund_tx_hash)
    // Without this guard, admin could trigger side effects (email, access revocation) twice
    if (refund.status !== 'approved') {
      return NextResponse.json({ error: 'Must be approved before marking refunded', status: refund.status }, { status: 409 })
    }
    if (refund.refund_tx_hash !== null && refund.refund_tx_hash !== undefined) {
      return NextResponse.json({ error: 'Already refunded — tx_hash already recorded', tx_hash: refund.refund_tx_hash }, { status: 409 })
    }

    // Atomic check-and-update: only update if still approved (prevents race with concurrent IPN)
    const d1 = await getD1Raw()
    const updateResult = await d1
      .prepare(
        `UPDATE refund_requests
         SET status = 'refunded', reviewed_at = strftime('%s','now'), reviewed_by_user_id = ?1,
             admin_notes = COALESCE(?2, admin_notes), refund_tx_hash = ?3
         WHERE id = ?4 AND status = 'approved' AND (refund_tx_hash IS NULL OR refund_tx_hash = '')`
      )
      .bind(auth.user.id, body.notes ?? null, body.tx_hash, id)
      .run()

    if (updateResult.meta.changes === 0) {
      // No rows updated — either already refunded by IPN or concurrent admin call
      const current = await getRefundById(id)
      if (current?.status === 'refunded') {
        return NextResponse.json({ error: 'Already refunded', status: 'refunded', tx_hash: current.refund_tx_hash }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to update — please retry' }, { status: 409 })
    }

    // Side effects: revoke access, audit log, email (only on successful first update)
    await revokeAccessByPurchaseId(refund.purchase_id)

    await writeAuditLog({
      actorUserId: auth.user.id,
      actionType: 'refund_marked_refunded',
      targetUserId: refund.user_id,
      payload: { refundId: id, purchaseId: refund.purchase_id, txHash: body.tx_hash },
    })

    const db = await getD1Raw()
    const userRow = await db.prepare('SELECT email FROM user WHERE id = ?1').bind(refund.user_id).first<UserRow>()
    if (userRow) {
      sendRefundCompletedEmail({
        userEmail: userRow.email,
        purchaseId: refund.purchase_id,
        txHash: body.tx_hash,
      }).catch(() => null)
    }

    const responseBody = { id, status: 'refunded', tx_hash: body.tx_hash }

    // FIX-10: store idempotency key after successful processing
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, id, responseBody)
    }

    logger.info('[AdminRefunds] Marked refunded', { id, txHash: body.tx_hash })
    return NextResponse.json(responseBody)
  } catch (err) {
    logger.error('[AdminRefunds] mark-refunded failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Idempotency helpers (FIX-10)
// ---------------------------------------------------------------------------

interface CachedResult {
  id: string
  status: string
  tx_hash: string
}

/** Return cached result if key exists and not expired, else null. */
async function checkIdempotency(key: string, refundId: string): Promise<CachedResult | null> {
  try {
    const db = getD1Raw()
    const row = await db
      .prepare(
        `SELECT refund_id, status FROM idempotency_keys
         WHERE key = ?1 AND refund_id = ?2 AND expires_at > unixepoch()`,
      )
      .bind(key, refundId)
      .first<{ refund_id: string; status: string }>()
    if (!row) return null
    return { id: row.refund_id, status: row.status, tx_hash: '' }
  } catch {
    return null // fail-open: if idempotency table unreadable, process normally
  }
}

/** Persist idempotency key (24h TTL). */
async function storeIdempotency(key: string, refundId: string, body: CachedResult): Promise<void> {
  try {
    const db = getD1Raw()
    await db
      .prepare(
        `INSERT OR REPLACE INTO idempotency_keys (key, refund_id, status, expires_at)
         VALUES (?1, ?2, ?3, unixepoch() + 86400)`,
      )
      .bind(key, refundId, body.status)
      .run()
  } catch (err) {
    logger.warn('[AdminRefunds] Idempotency store failed', { key, err: getErrorMessage(err) })
  }
}
