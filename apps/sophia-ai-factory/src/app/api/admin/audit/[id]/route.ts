/**
 * GET /api/admin/audit/[id]
 * Returns full detail of a specific audit run including all check results.
 * Admin auth required.
 *
 * @module app/api/admin/audit/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getD1Raw } from '@/seed/db/client'
import type { CheckResult } from '@/lib/audit/zero-gap-types'

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
  results: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const d1 = await getD1Raw()
    const row = await d1
      .prepare(`SELECT * FROM audit_runs WHERE id = ?1`)
      .bind(id)
      .first<AuditRunRow>()

    if (!row) {
      return NextResponse.json({ error: 'Audit run not found' }, { status: 404 })
    }

    let results: CheckResult[] = []
    if (row.results) {
      try {
        results = JSON.parse(row.results) as CheckResult[]
      } catch {
        results = []
      }
    }

    return NextResponse.json({
      id: row.id,
      triggeredByUserId: row.triggered_by_user_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      totalScore: row.total_score,
      totalChecks: row.total_checks,
      passed: row.passed,
      warned: row.warned,
      failed: row.failed,
      results,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch audit run' },
      { status: 500 },
    )
  }
}
