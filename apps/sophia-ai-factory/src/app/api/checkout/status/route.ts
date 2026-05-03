/**
 * GET /api/checkout/status?orderId=... — Poll pending_orders status.
 * Returns { status, tier, period, paymentId, completedAt }
 * No auth required — orderId is high-entropy bearer token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrderById } from '@/lib/orders/pending-order-repo'
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper'

const querySchema = z.object({
  orderId: z.string().regex(/^sophia_/, 'orderId must start with sophia_'),
})

export const GET = withRateLimit(async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('orderId')
  const parsed = querySchema.safeParse({ orderId })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
  }

  const order = await getOrderById(parsed.data.orderId)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: order.status,
    tier: order.tier,
    period: order.period,
    paymentId: order.payment_id,
    completedAt: order.completed_at,
  })
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 30 } })
