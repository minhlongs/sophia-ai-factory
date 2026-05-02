/**
 * POST /api/admin/run-synthetic-fulfillment
 *
 * Admin-only: run a full one-time fulfillment pipeline with synthetic data.
 * Returns a detailed timeline for go-live validation before announcing
 * to real customers.
 *
 * Body (optional JSON):
 *   { skuId?: 'STARTER_BUNDLE', timeoutMs?: 60000 }
 *
 * Returns: SyntheticRunResult JSON
 *
 * @module app/api/admin/run-synthetic-fulfillment/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { runSyntheticFulfillment } from '@/lib/admin/synthetic-fulfillment-runner'
import { logger } from '@/lib/utils/logger-utility'
import { getErrorMessage } from '@/lib/utils/to-error'

export const dynamic = 'force-dynamic'

// 90 second max — give HeyGen time to accept job and transition to processing
export const maxDuration = 90

const bodySchema = z.object({
  skuId: z.enum(['STARTER_BUNDLE']).optional().default('STARTER_BUNDLE'),
  timeoutMs: z.number().int().min(5000).max(120_000).optional().default(60_000),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  let body: { skuId: 'STARTER_BUNDLE'; timeoutMs: number }
  try {
    const raw = request.headers.get('content-length') === '0'
      ? {}
      : await request.json().catch(() => ({}))
    body = bodySchema.parse(raw)
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body', details: getErrorMessage(err) },
      { status: 400 },
    )
  }

  logger.info('[SyntheticFulfillment] Admin triggered run', {
    adminUserId: auth.user.id,
    adminEmail: auth.user.email,
    skuId: body.skuId,
    timeoutMs: body.timeoutMs,
  })

  try {
    const result = await runSyntheticFulfillment(
      auth.user.id,
      body.skuId,
      body.timeoutMs,
    )
    return NextResponse.json(result)
  } catch (err) {
    logger.error('[SyntheticFulfillment] Unexpected error', err instanceof Error ? err : undefined)
    return NextResponse.json(
      { error: 'Synthetic run failed', details: getErrorMessage(err) },
      { status: 500 },
    )
  }
}
