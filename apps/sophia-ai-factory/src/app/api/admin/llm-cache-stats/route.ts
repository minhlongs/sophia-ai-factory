/**
 * GET /api/admin/llm-cache-stats — Phase 4H machine-readable cache stats.
 *
 * Exposes getCacheStats() aggregate as JSON for ops tooling / dashboards.
 * CRON_SECRET-guarded. D1 failure → 200 ok:false (never pages founder).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCacheStats, cacheHitRate } from '@/lib/admin/monitoring-queries'

export const dynamic = 'force-dynamic'

function verifyCronSecret(request: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ts = new Date().toISOString()

  try {
    const result = await getCacheStats()

    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: 'D1_UNAVAILABLE', ts }, { status: 200 })
    }

    const hitRate = cacheHitRate(result.data)
    return NextResponse.json({ ok: true, ts, stats: result.data, hitRate }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, reason: 'D1_ERROR', error: message, ts },
      { status: 200 },
    )
  }
}
