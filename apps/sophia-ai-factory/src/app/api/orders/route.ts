/**
 * GET /api/orders
 * Returns authenticated user's one-time purchase orders with video status.
 * Used by the /dashboard/orders page for SWR polling.
 *
 * Security: filters strictly by getCurrentUser().id — never trusts client userId.
 *
 * @module app/api/orders
 */

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getUserOrders } from '@/lib/orders/order-query'
import { logger } from '@/seed/utils/logger-utility'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const orders = await getUserOrders(user.id)
    return NextResponse.json({ orders })
  } catch (err) {
    logger.error('[OrdersAPI] Failed to fetch orders', err instanceof Error ? err : undefined, {
      userId: user.id,
    })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
