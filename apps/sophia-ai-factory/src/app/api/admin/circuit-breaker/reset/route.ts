/**
 * POST /api/admin/circuit-breaker/reset
 *
 * Admin-only: clear circuit breaker KV state + attempt log.
 * Use after confirming HeyGen is healthy again.
 *
 * Returns new circuit state (always 'closed' after reset).
 *
 * @module app/api/admin/circuit-breaker/reset/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { resetCircuit, getCircuitState } from '@/land/fulfillment/circuit-breaker'
import { logger } from '@/seed/utils/logger-utility'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    await resetCircuit()
    const state = await getCircuitState()

    logger.info('[CircuitBreaker] Admin reset via API', {
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
    })

    return NextResponse.json({
      ok: true,
      message: 'Circuit breaker reset — state is now closed',
      circuitState: state,
    })
  } catch (err) {
    logger.error('[CircuitBreaker] Admin reset failed', err instanceof Error ? err : undefined)
    return NextResponse.json(
      { ok: false, error: 'Reset failed' },
      { status: 500 },
    )
  }
}
