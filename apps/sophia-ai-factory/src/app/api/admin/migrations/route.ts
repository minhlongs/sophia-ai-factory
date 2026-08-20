/**
 * GET /api/admin/migrations
 *
 * Hook B: Lists Supabase migrations from the build-time manifest with applied status from D1.
 * Returns each migration with: filename, sha256, applied boolean, applied_at.
 * Admin only.
 *
 * @module app/api/admin/migrations/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getD1 } from '@/seed/db/client'
import { SUPABASE_MIGRATIONS_MANIFEST } from '@/tree/admin/supabase-migrations-manifest'

export const dynamic = 'force-dynamic'

interface AppliedRow {
  filename: string
  applied_at: number
  applied_by_user_id: string
  notes: string | null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const { results } = await db
    .prepare(`SELECT filename, applied_at, applied_by_user_id, notes FROM supabase_migrations_applied`)
    .all<AppliedRow>()

  const appliedMap = new Map<string, AppliedRow>()
  for (const row of results) appliedMap.set(row.filename, row)

  const migrations = SUPABASE_MIGRATIONS_MANIFEST.map((m) => {
    const row = appliedMap.get(m.filename)
    return {
      filename: m.filename,
      sha256: m.sha256,
      content_b64: m.content_b64,
      applied: !!row,
      applied_at: row?.applied_at ?? null,
      applied_by: row?.applied_by_user_id ?? null,
      notes: row?.notes ?? null,
    }
  })

  const supabaseProjectRef = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
    : null

  return NextResponse.json({
    migrations,
    supabase_editor_url: supabaseProjectRef
      ? `https://supabase.com/dashboard/project/${supabaseProjectRef}/sql/new`
      : null,
    total: migrations.length,
    pending: migrations.filter((m) => !m.applied).length,
  })
}
