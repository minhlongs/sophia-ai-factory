/**
 * GET /api/affiliate/earnings
 *
 * Returns commission earnings aggregated by status for the authenticated affiliate.
 * Query params: from (unix ts), to (unix ts)
 * Tenant-scoped — no cross-tenant leak.
 *
 * @module app/api/affiliate/earnings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getEarningsSummary } from '@/lib/payouts/commission-ledger'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const now = Math.floor(Date.now() / 1000)
  const fromTs = fromParam ? parseInt(fromParam, 10) : now - 30 * 86400 // default 30 days
  const toTs = toParam ? parseInt(toParam, 10) : now

  if (isNaN(fromTs) || isNaN(toTs) || fromTs > toTs) {
    return NextResponse.json({ error: 'Invalid from/to parameters' }, { status: 400 })
  }

  const tenantId = user.id // single-tenant model: user IS the tenant
  const affiliateId = user.id

  const summary = await getEarningsSummary(tenantId, affiliateId, fromTs, toTs)

  return NextResponse.json({
    affiliateId,
    from: fromTs,
    to: toTs,
    earnings: summary,
  })
}
