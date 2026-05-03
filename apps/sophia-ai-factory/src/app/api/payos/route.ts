/**
 * POST /api/payos — Create PayOS VND payment link.
 * Returns { checkoutUrl, qrUrl, orderId, orderCode, expiresAt }
 * Gated by FEATURE_PAYOS flag.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session'
import { createPayOsInvoice, FEATURE_PAYOS } from '@/lib/payments/payos'
import { writeOrder } from '@/lib/orders/pending-order-repo'
import { logger } from '@/lib/utils/logger-utility'
import { withRateLimit } from '@/middleware/rate-limit-wrapper'

const payosCheckoutSchema = z.object({
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']),
  period: z.enum(['monthly', 'lifetime']).default('monthly'),
  customerEmail: z.string().email().optional(),
})

export const POST = withRateLimit(async function POST(request: NextRequest) {
  if (!FEATURE_PAYOS) {
    return NextResponse.json({ error: 'PayOS not currently available' }, { status: 503 })
  }

  let userId: string | null = null
  try {
    const user = await getCurrentUserFromHeaders(request.headers)
    userId = user?.id ?? null
  } catch { /* auth failed */ }

  if (!userId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'
    return NextResponse.json(
      {
        error: 'Login required',
        redirectTo: `/login?next=${encodeURIComponent('/pricing')}`,
      },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = payosCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { tier, period, customerEmail } = parsed.data
  const orderId = `sophia_${userId}_${Date.now()}`

  try {
    const result = await createPayOsInvoice({
      tier,
      period,
      userId,
      orderId,
      customerEmail,
    })

    // Write pending order for tracking
    try {
      const { getPayOsTierConfig } = await import('@/lib/payments/payos')
      const config = getPayOsTierConfig(tier)
      await writeOrder({
        order_id: orderId,
        user_id: userId,
        tier,
        period,
        payment_method: 'payos',
        amount_usd_cents: config.usdAmount * 100,
        customer_email: customerEmail,
        invoice_url: result.checkoutUrl,
      })
    } catch (dbErr) {
      logger.warn('[PayOS] Failed to write pending_order (non-fatal)', {
        orderId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      })
    }

    return NextResponse.json({
      checkoutUrl: result.checkoutUrl,
      qrUrl: result.qrUrl,
      orderId,
      orderCode: result.orderCode,
      expiresAt: result.expiresAt,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('[PayOS] Invoice creation failed', new Error(msg), { tier, userId })
    return NextResponse.json({ error: `PayOS checkout failed: ${msg}` }, { status: 500 })
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } })
