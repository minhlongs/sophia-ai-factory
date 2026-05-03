/**
 * GET /api/admin/audit/history
 * Returns paginated list of past audit runs.
 * Admin auth required.
 *
 * @module app/api/admin/audit/history/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getD1Raw } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

interface AuditRunRow {
  id: string
  triggered_by_user_id: string
  started_at: number
  completed_at: number | null
  total_score: number | null
  total_checks: number | null
  passed: number | null
  warned: number | null
  failed: number | null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

  try {
    const d1 = await getD1Raw()
    const rows = await d1
      .prepare(
        `SELECT id, triggered_by_user_id, started_at, completed_at,
                total_score, total_checks, passed, warned, failed
         FROM audit_runs
         ORDER BY started_at DESC
         LIMIT ?1 OFFSET ?2`,
      )
      .bind(limit, offset)
      .all<AuditRunRow>()

    return NextResponse.json({
      runs: rows.results ?? [],
      limit,
      offset,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch audit history' },
      { status: 500 },
    )
  }
}
