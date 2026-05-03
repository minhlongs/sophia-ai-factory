/**
 * POST /api/admin/synthetic-ipn
 *
 * Hook E: Inject a synthetic NOWPayments IPN through the REAL webhook handler.
 * Validates the full chain: signature verify → handleOneTimeFinished → fulfillment → email.
 * Uses HMAC-SHA512 with NOWPAYMENTS_IPN_SECRET so the signature verify step is exercised.
 *
 * Body: { skuId?: string, userId?: string }
 *   skuId defaults to 'STARTER_BUNDLE'
 *   userId defaults to the calling admin's user ID
 *
 * Admin only. Writes audit log.
 *
 * @module app/api/admin/synthetic-ipn/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/seed/auth/require-admin'
import { writeAuditLog } from '@/lib/admin/audit-log'
import { getOneTimeSkuById } from '@/seed/config/one-time-skus'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  skuId: z.string().default('STARTER_BUNDLE'),
  userId: z.string().optional(),
})

/**
 * Build HMAC-SHA512 signature over sorted JSON keys — matches verifyIpnSignature exactly.
 */
async function buildIpnSignature(payload: Record<string, unknown>, secret: string): Promise<string> {
  const sorted = JSON.stringify(payload, Object.keys(payload).sort())
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(sorted))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET
  if (!ipnSecret) {
    return NextResponse.json({ error: 'NOWPAYMENTS_IPN_SECRET not configured' }, { status: 500 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: getErrorMessage(err) }, { status: 400 })
  }

  const targetUserId = body.userId ?? auth.user.id
  const skuId = body.skuId

  const sku = getOneTimeSkuById(skuId)
  if (!sku) {
    return NextResponse.json({ error: `Unknown SKU: ${skuId}` }, { status: 400 })
  }

  const paymentId = `ADMIN_E2E_${Date.now()}`
  const orderId = `sophia_${targetUserId}_${Date.now()}`
  const dispatchedAt = new Date().toISOString()

  const ipnPayload: Record<string, unknown> = {
    payment_id: paymentId,
    payment_status: 'finished',
    invoice_id: sku.invoiceId,
    order_id: orderId,
    price_amount: sku.priceUsd,
    price_currency: 'USD',
    actually_paid: sku.priceUsd,
    actually_paid_at_fiat: sku.priceUsd,
    pay_currency: 'USDTTRC20',
    outcome_amount: sku.priceUsd,
    outcome_currency: 'USD',
    created_at: dispatchedAt,
    updated_at: dispatchedAt,
  }

  let signature: string
  try {
    signature = await buildIpnSignature(ipnPayload, ipnSecret)
  } catch (err) {
    logger.error('[SyntheticIPN] Signature build failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'Signature build failed' }, { status: 500 })
  }

  // Dispatch to real IPN webhook endpoint (internal)
  const webhookUrl = new URL('/api/webhooks/nowpayments', request.url)
  let webhookRes: Response
  try {
    webhookRes = await fetch(webhookUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nowpayments-sig': signature,
      },
      body: JSON.stringify(ipnPayload),
    })
  } catch (err) {
    logger.error('[SyntheticIPN] Webhook fetch failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'Webhook dispatch failed', details: getErrorMessage(err) }, { status: 500 })
  }

  const webhookBody = await webhookRes.text()

  await writeAuditLog({
    actorUserId: auth.user.id,
    actionType: 'run_synthetic',
    targetUserId,
    payload: {
      skuId,
      paymentId,
      orderId,
      webhookStatus: webhookRes.status,
      webhookBody: webhookBody.slice(0, 200),
    },
  })

  if (!webhookRes.ok) {
    logger.warn('[SyntheticIPN] Webhook returned error', { status: webhookRes.status, body: webhookBody })
    return NextResponse.json(
      {
        success: false,
        paymentId,
        dispatched_at: dispatchedAt,
        webhook_status: webhookRes.status,
        webhook_body: webhookBody,
        watch_url: '/dashboard/orders',
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    success: true,
    payment_id: paymentId,
    dispatched_at: dispatchedAt,
    sku: { id: skuId, priceUsd: sku.priceUsd, credits: sku.credits },
    target_user_id: targetUserId,
    watch_url: '/dashboard/orders',
  })
}
