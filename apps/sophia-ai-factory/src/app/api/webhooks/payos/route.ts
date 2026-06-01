/**
 * PayOS IPN Webhook Route
 * Verifies x-checksum header with HMAC-SHA256, activates tier on successful payment.
 * Gated by FEATURE_PAYOS — returns 503 when flag is off.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyPayOsWebhook,
  payOsIpnSchema,
  parseUserIdFromPayOsDescription,
  FEATURE_PAYOS,
} from '@/land/payments/payos'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import { UNIFIED_TIERS } from '@/seed/config/tiers'
import type { Tier } from '@/seed/types'
import { markOrderCompleted } from '@/land/orders/pending-order-repo'
import { track } from '@/land/signals/track'
import { D1Events } from '@/land/signals/d1-event-types'

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY

/** Map PayOS description amount to the correct tier. */
function resolveTierFromAmount(amountVnd: number): Tier | null {
  // Tier VND prices (must match payos.ts TIER_USD_PRICES * USD_TO_VND)
  const USD_TO_VND = Number(process.env.USD_TO_VND ?? '25000')
  const TIER_USD: Record<Tier, number> = {
    BASIC: 199,
    PREMIUM: 399,
    ENTERPRISE: 799,
    MASTER: 4999,
  }
  for (const [tier, usd] of Object.entries(TIER_USD) as [Tier, number][]) {
    const expected = Math.round((usd * USD_TO_VND) / 1000) * 1000
    // Allow ±1% tolerance for rounding
    if (Math.abs(amountVnd - expected) <= expected * 0.01) {
      return tier
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  if (!FEATURE_PAYOS) {
    logger.warn('[PayOS Webhook] Feature flag disabled — ignoring')
    // PayOS requires 200 to stop retrying; return success with disabled note
    return NextResponse.json({ received: true, note: 'payos_disabled' }, { status: 200 })
  }

  if (!PAYOS_CHECKSUM_KEY) {
    logger.error('[PayOS Webhook] PAYOS_CHECKSUM_KEY not configured')
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
  }

  const rawBody = await request.text()

  // Verify signature from x-checksum header (PayOS spec)
  const signature = request.headers.get('x-checksum')
  if (!signature) {
    logger.warn('[PayOS Webhook] Missing x-checksum header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const isValid = await verifyPayOsWebhook(rawBody, signature, PAYOS_CHECKSUM_KEY)
  if (!isValid) {
    logger.warn('[PayOS Webhook] Invalid checksum signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Parse and validate IPN payload
  let parsed: ReturnType<typeof payOsIpnSchema.safeParse>
  try {
    const raw = JSON.parse(rawBody) as unknown
    parsed = payOsIpnSchema.safeParse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!parsed.success) {
    logger.warn('[PayOS Webhook] Invalid payload shape', { errors: parsed.error.flatten() })
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const ipn = parsed.data

  // Only process successful payments
  if (!ipn.success || ipn.code !== '00') {
    logger.info('[PayOS Webhook] Non-success payment event', { code: ipn.code, desc: ipn.desc })
    return NextResponse.json({ received: true })
  }

  const { orderCode, amount, description, paymentLinkId } = ipn.data

  // Resolve userId from description (convention: "Sophia {TIER} - {orderId_last8}")
  const userId = parseUserIdFromPayOsDescription(description)
  if (!userId) {
    logger.warn('[PayOS Webhook] Cannot parse userId from description', { description, orderCode })
    return NextResponse.json({ error: 'Cannot resolve user' }, { status: 422 })
  }

  // Resolve tier from VND amount
  const tier = resolveTierFromAmount(amount)
  if (!tier) {
    logger.warn('[PayOS Webhook] Cannot resolve tier from amount', { amount, orderCode })
    return NextResponse.json({ error: 'Cannot resolve tier' }, { status: 422 })
  }

  // Idempotency: check if this paymentLinkId was already processed
  const db = createServerClient()
  try {
    const { data: existing } = await db
      .from('payment_events')
      .select('processed')
      .eq('event_id', `payos_${paymentLinkId}`)
      .single()
    if (existing?.processed) {
      logger.info('[PayOS Webhook] Already processed', { paymentLinkId })
      return NextResponse.json({ received: true, duplicate: true })
    }
  } catch { /* not found — continue */ }

  // Record event (unprocessed)
  try {
    await db.from('payment_events').upsert({
      event_id: `payos_${paymentLinkId}`,
      event_type: 'payos.payment_success',
      payload: rawBody,
      processed: 0,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    logger.warn('[PayOS Webhook] Failed to record event (non-fatal)', { error: String(err) })
  }

  // Activate tier — same logic as NOWPayments subscription handler
  const isLifetime = UNIFIED_TIERS[tier]?.billingType === 'lifetime'
  const now = new Date().toISOString()
  const periodEnd = isLifetime
    ? new Date('2099-12-31T23:59:59Z').toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data: membership } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .single()
    const orgId = membership?.org_id as string | undefined

    if (orgId) {
      // Upsert subscription record
      const { data: existingSub } = await db
        .from('subscriptions')
        .select('org_id')
        .eq('org_id', orgId)
        .single()

      if (existingSub) {
        await db
          .from('subscriptions')
          .update({ plan: tier.toLowerCase(), status: 'active', current_period_end: periodEnd, updated_at: now })
          .eq('org_id', orgId)
      } else {
        await db.from('subscriptions').insert({
          org_id: orgId,
          plan: tier.toLowerCase(),
          status: 'active',
          current_period_start: now,
          current_period_end: periodEnd,
        })
      }

      // Update organization tier
      await db
        .from('organizations')
        .update({ tier: tier.toLowerCase(), updated_at: now })
        .eq('id', orgId)
    }

    // Mark pending order completed (best-effort — match by userId + tier + payos method)
    try {
      await markOrderCompleted(`payos_${paymentLinkId}`, `payos_${paymentLinkId}`)
    } catch { /* non-fatal */ }

    // Mark event processed
    await db.from('payment_events').update({ processed: 1 }).eq('event_id', `payos_${paymentLinkId}`)

    // Emit analytics
    track(D1Events.PAYMENT_SUCCESS, 'webhook', {
      provider: 'payos',
      payment_link_id: paymentLinkId,
      amount_vnd: amount,
      tier,
    }, userId)
    track(D1Events.TIER_CONVERSION, userId, {
      to_tier: tier,
      provider: 'payos',
      amount_vnd: amount,
    }, userId)

    logger.info('[PayOS Webhook] Tier activated', { userId, tier, orgId, isLifetime, periodEnd })
    return NextResponse.json({ received: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('[PayOS Webhook] Activation failed', new Error(msg), { userId, tier })
    return NextResponse.json({ error: `Activation failed: ${msg}` }, { status: 500 })
  }
}
