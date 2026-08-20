/**
 * GET /api/affiliate/payouts
 *
 * Lists payout batches for the authenticated affiliate.
 * Tenant-scoped — no cross-tenant leak.
 *
 * Storage uses INTEGER cents (`total_cents`); response exposes both `total_cents`
 * (canonical) and `total_usd` (display convenience) so callers can choose.
 *
 * @module app/api/affiliate/payouts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getD1 } from '@/seed/db/client'
import { fromCents } from '@/land/payouts/commission-cents'

interface BatchRow {
  id: string
  total_cents: number
  ledger_count: number
  status: string
  payment_method: string
  network: string | null
  external_payment_id: string | null
  created_at: number
  finalized_at: number | null
}

interface PayoutBatchPublic extends BatchRow {
  total_usd: number
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit') ?? '20'
  const limit = Math.min(parseInt(limitParam, 10) || 20, 100)

  const tenantId = user.id
  const affiliateId = user.id
  const db = await getD1()
  if (!db) throw new Error('D1 database binding not available')

  const result = await db
    .prepare(
      `SELECT id, total_cents, ledger_count, status, payment_method,
              network, external_payment_id, created_at, finalized_at
       FROM payout_batches
       WHERE tenant_id = ? AND affiliate_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(tenantId, affiliateId, limit)
    .all<BatchRow>()

  const batches: PayoutBatchPublic[] = (result.results ?? []).map((r) => ({
    ...r,
    total_usd: fromCents(r.total_cents),
  }))

  return NextResponse.json({ affiliateId, batches })
}
