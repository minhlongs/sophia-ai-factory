/**
 * GET /api/affiliate/payouts
 *
 * Lists payout batches for the authenticated affiliate.
 * Tenant-scoped — no cross-tenant leak.
 *
 * @module app/api/affiliate/payouts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/better-auth-session'
import { getD1Raw } from '@/lib/db/client'

interface PayoutBatchPublic {
  id: string
  total_usd: number
  ledger_count: number
  status: string
  payment_method: string
  network: string
  external_payment_id: string | null
  created_at: number
  finalized_at: number | null
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
  const db = await getD1Raw()

  const result = await db
    .prepare(
      `SELECT id, total_usd, ledger_count, status, payment_method,
              network, external_payment_id, created_at, finalized_at
       FROM payout_batches
       WHERE tenant_id = ? AND affiliate_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(tenantId, affiliateId, limit)
    .all<PayoutBatchPublic>()

  return NextResponse.json({
    affiliateId,
    batches: result.results ?? [],
  })
}
