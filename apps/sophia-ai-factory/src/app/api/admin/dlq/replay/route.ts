/**
 * POST /api/admin/dlq/replay — replay a dropped IPN event
 *
 * Body: { payment_id: string }
 * Returns: { success: boolean, message: string }
 *
 * Looks up the dropped event in payment_events_dropped, parses the stored
 * payload, and re-processes it through processNowPaymentsIpn().
 *
 * @module app/api/admin/dlq/replay/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getDb } from '@/land/billing/nowpayments-ipn-db'
import { getDroppedEventByPaymentId, deleteDroppedEvent } from '@/land/billing/nowpayments-ipn-dropped-events'
import { processNowPaymentsIpn, type NowPaymentsIpnPayload } from '@/land/billing/nowpayments-ipn-handlers'
import type { D1LikeClient } from '@/land/billing/nowpayments-ipn-dead-letter'
import { logger } from '@/seed/utils/logger-utility'

export const dynamic = 'force-dynamic'

const replaySchema = z.object({
  payment_id: z.string().min(1, 'payment_id is required'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  try {
    const body = await request.json().catch(() => null)
    const parsed = replaySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
    }

    const { payment_id } = parsed.data
    const db = getDb() as unknown as D1LikeClient

    // Look up the dropped event
    const dropped = await getDroppedEventByPaymentId(db, payment_id)
    if (!dropped) {
      return NextResponse.json({
        success: false,
        message: `No dropped event found for payment_id: ${payment_id}`,
      }, { status: 404 })
    }

    // Parse stored payload and re-process through IPN handler
    let payload: NowPaymentsIpnPayload
    try {
      payload = JSON.parse(dropped.payload) as NowPaymentsIpnPayload
    } catch {
      return NextResponse.json({
        success: false,
        message: 'Failed to parse stored payload — may be corrupted',
      }, { status: 500 })
    }

    const result = await processNowPaymentsIpn(payload)

    // If replay succeeded, remove from dropped events table
    if (result.success) {
      await deleteDroppedEvent(db, dropped.event_id)
      logger.info('[AdminDLQ] Dropped event replayed successfully', {
        paymentId: payment_id,
        eventId: dropped.event_id,
        message: result.message,
      })
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      replayed: result.success,
    })
  } catch (err) {
    logger.error('[AdminDLQ] Replay failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
