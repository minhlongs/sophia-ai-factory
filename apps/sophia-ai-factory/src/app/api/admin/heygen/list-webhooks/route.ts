/**
 * GET /api/admin/heygen/list-webhooks?userId=X
 * Lists HeyGen webhook endpoints for a user's stored API key.
 * Admin only. Used for debugging webhook registration.
 *
 * @module app/api/admin/heygen/list-webhooks/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { getUserCredential } from '@/tree/credentials/user-credentials-repo'
;import { listHeyGenWebhooks } from '@/land/heygen/webhook-registrar'
import { getD1 } from '@/seed/db/client'

export const dynamic = 'force-dynamic'

interface UserRow { id: string; email: string }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const userId = request.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId query param required' }, { status: 400 })
  }

  // Verify user exists
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const user = await db.prepare('SELECT id, email FROM user WHERE id = ?1').bind(userId).first<UserRow>()
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const apiKey = await getUserCredential(userId, 'heygen')
  if (!apiKey) {
    return NextResponse.json({ error: 'No HeyGen API key stored for this user' }, { status: 404 })
  }

  const result = await listHeyGenWebhooks(apiKey)
  return NextResponse.json({ user: { id: user.id, email: user.email }, ...result })
}
