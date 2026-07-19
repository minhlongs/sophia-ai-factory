/**
 * GET /api/admin/dlq/reconciliation — list dropped events + stale DLQ entries
 *
 * Query params:
 *   since (ISO-8601, optional) — filter dropped events after this timestamp
 *   limit (number, default 50) — max entries per dataset
 *
 * Returns:
 *   { dropped: DroppedEventRecord[], staleDlq: DeadLetterEntry[], dlqStats: {...} }
 *
 * @module app/api/admin/dlq/reconciliation/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getDb } from '@/land/billing/nowpayments-ipn-db'
import { getDroppedEvents, countDroppedEvents } from '@/land/billing/nowpayments-ipn-dropped-events'
import { getStaleDlqEntries, countUnresolvedDlq, type D1LikeClient } from '@/land/billing/nowpayments-ipn-dead-letter'
import { logger } from '@/seed/utils/logger-utility'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
})

const DLQ_SIZE_CAP = 1000

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      since: searchParams.get('since') || undefined,
      limit: searchParams.get('limit') || '50',
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_query', details: parsed.error.flatten() }, { status: 400 })
    }

    const { since, limit } = parsed.data
    const db = getDb() as unknown as D1LikeClient

    // Default: events dropped in the last 7 days
    const sinceDate = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [dropped, staleDlq, unresolvedCount, droppedCount] = await Promise.all([
      getDroppedEvents(db, sinceDate, limit),
      getStaleDlqEntries(db, 24, limit),
      countUnresolvedDlq(db),
      countDroppedEvents(db),
    ])

    return NextResponse.json({
      dropped,
      staleDlq,
      dlqStats: {
        unresolved: unresolvedCount,
        dropped: droppedCount,
        capacity: DLQ_SIZE_CAP,
      },
    })
  } catch (err) {
    logger.error('[AdminDLQ] Reconciliation failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
