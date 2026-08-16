/**
 * POST /api/admin/migrations/[filename]/mark-applied
 *
 * Hook B: Mark a Supabase migration as applied in D1 (supabase_migrations_applied table).
 * Admin clicks "Copy SQL", runs in Supabase dashboard, then clicks "Mark Applied" here.
 *
 * Body: { notes?: string }
 * Admin only. Writes audit log.
 *
 * @module app/api/admin/migrations/[filename]/mark-applied/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin'
import { getD1 } from '@/seed/db/client'
import { writeAuditLog } from '@/tree/admin/audit-log'
import { getErrorMessage } from '@/seed/utils/to-error'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  notes: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
): Promise<NextResponse> {
  const auth = await requireAdminWithRecentAuth(request)
  if (auth instanceof Response) return auth

  const { filename } = await params

  // Sanitize filename — only allow alphanumeric, hyphens, underscores, dots
  if (!/^[\w\-. ]+\.sql$/.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: getErrorMessage(err) }, { status: 400 })
  }

  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    await db
      .prepare(
        `INSERT INTO supabase_migrations_applied (filename, applied_by_user_id, notes)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(filename) DO UPDATE SET
           applied_at = strftime('%s','now'),
           applied_by_user_id = excluded.applied_by_user_id,
           notes = excluded.notes`,
      )
      .bind(filename, auth.user.id, body.notes ?? null)
      .run()

    await writeAuditLog({
      actorUserId: auth.user.id,
      actionType: 'mark_migration_applied',
      payload: { filename, notes: body.notes },
    })

    return NextResponse.json({ success: true, filename })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

/**
 * GET — check if a specific migration is applied.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
): Promise<NextResponse> {
  const auth = await requireAdminWithRecentAuth(request)
  if (auth instanceof Response) return auth

  const { filename } = await params

  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(`SELECT * FROM supabase_migrations_applied WHERE filename = ?1`)
    .bind(filename)
    .first<{ filename: string; applied_at: number; applied_by_user_id: string; notes: string | null }>()

  return NextResponse.json({ filename, applied: !!row, row: row ?? null })
}
