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
import { processRefund } from '@/land/refunds/refund-processor'
import { getErrorMessage } from '@/seed/utils/to-error'
import { logger } from '@/seed/utils/logger-utility'
import {
  bodySchema,
  checkIdempotency,
  storeIdempotency,
  runPostRefundSideEffects,
} from './mark-refunded-helpers'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

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

    // SECURITY FIX (Issue 5): Prevent double-processing — check status before calling processor
    // processRefund has its own atomic lock, but we check early for clear error messages
    if (refund.status !== 'approved') {
      return NextResponse.json({ error: 'Must be approved before marking refunded', status: refund.status }, { status: 409 })
    }

    // Wire processRefund for the full refund pipeline:
    // - Atomic lock via refund_events INSERT ON CONFLICT DO NOTHING
    // - NOWPayments refund API call (if crypto)
    // - Subscription tier rollback to BASIC
    // - MCU credit clawback to tier base amount
    // - Refund ledger entry for audit trail
    // - Mark refund_requests status='refunded' with tx_hash
    const result = await processRefund({
      refundRequestId: id,
      reviewedByUserId: auth.user.id,
      txHash: body.tx_hash,
      notes: body.notes,
    })

    if (!result.ok) {
      if (result.error.code === 'DUPLICATE_REFUND') {
        return NextResponse.json({ error: 'Already refunded' }, { status: 409 })
      }
      if (result.error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Refund request not found' }, { status: 404 })
      }
      return NextResponse.json({ error: result.error.message, code: result.error.code }, { status: 500 })
    }

    await runPostRefundSideEffects({
      id,
      actorUserId: auth.user.id,
      targetUserId: refund.user_id,
      purchaseId: refund.purchase_id,
      txHash: body.tx_hash,
      tierBefore: result.value.tierBefore,
      tierAfter: result.value.tierAfter,
      mcuClawedBack: result.value.mcuClawedBack,
    })

    const responseBody = {
      id,
      status: 'refunded',
      tx_hash: body.tx_hash,
      tier_before: result.value.tierBefore,
      tier_after: result.value.tierAfter,
      mcu_clawed_back: result.value.mcuClawedBack,
      ledger_entry_id: result.value.ledgerEntryId,
    }

    // FIX-10: store idempotency key after successful processing
    if (idempotencyKey) {
      await storeIdempotency(idempotencyKey, id, { id, status: responseBody.status, tx_hash: responseBody.tx_hash })
    }

    logger.info('[AdminRefunds] Marked refunded via processRefund', {
      id,
      txHash: body.tx_hash,
      tierBefore: result.value.tierBefore,
      tierAfter: result.value.tierAfter,
      mcuClawedBack: result.value.mcuClawedBack,
    })
    return NextResponse.json(responseBody)
  } catch (err) {
    logger.error('[AdminRefunds] mark-refunded failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
