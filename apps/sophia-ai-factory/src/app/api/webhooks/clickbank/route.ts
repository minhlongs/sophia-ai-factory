/**
 * ClickBank INS Webhook Route
 *
 * Receives ClickBank Instant Notification Service (INS) postbacks,
 * verifies HMAC-SHA1 signature, attributes conversion to user campaign,
 * and records commission split in affiliate_conversions.
 *
 * Always returns 200 after signature check to prevent ClickBank retry storms.
 *
 * @module app/api/webhooks/clickbank/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyClickBankSignature } from '@/land/affiliates/clickbank-signature-verifier'
import { parsePostback } from '@/land/affiliates/clickbank-postback-parser'
import { attributeClick } from '@/land/affiliates/conversion-attributor'
import { calcCommission } from '@/land/affiliates/commission-calculator'
import { notifyConversionEarned } from '@/land/affiliates/conversion-notifier'
import { checkRateLimit } from '@/tree/telegram/sql-rate-limiter'
import { logger } from '@/seed/utils/logger-utility'
import {
  resolvePayout,
  getD1Binding,
  reverseOriginalSaleIfNeeded,
} from './clickbank-webhook-helpers'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const CLICKBANK_INS_SECRET = process.env.CLICKBANK_INS_SECRET
  if (!CLICKBANK_INS_SECRET) {
    logger.error('[clickbank-webhook] CLICKBANK_INS_SECRET not configured')
    // Still return 200 — config error should not trigger ClickBank retries
    return NextResponse.json({ ok: false, reason: 'config' }, { status: 200 })
  }

  // Rate limit: 1000/min per IP — 429 is safe (ClickBank will retry)
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const rl = await checkRateLimit(`clickbank:${ip}`, 1000, 60)
  if (!rl.allowed) {
    logger.warn('[clickbank-webhook] rate limited', { ip })
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-clickbank-signature') ?? ''

  // Signature verification — ONLY place we return 401
  const isValid = await verifyClickBankSignature(rawBody, signature, CLICKBANK_INS_SECRET)
  if (!isValid) {
    logger.warn('[clickbank-webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse + validate payload
  const postback = parsePostback(rawBody)
  if (!postback) {
    logger.warn('[clickbank-webhook] unparseable postback body')
    return NextResponse.json({ ok: true, skipped: 'parse_error' }, { status: 200 })
  }

  const { receipt, transactionType, amount, currency, cvendthru } = postback
  const db = getD1Binding()

  if (!db) {
    logger.error('[clickbank-webhook] D1 binding unavailable')
    return NextResponse.json({ ok: true, skipped: 'db_unavailable' }, { status: 200 })
  }

  // Idempotency: skip if already processed
  const existing = await db
    .prepare('SELECT 1 FROM affiliate_conversions WHERE receipt = ? AND event_type = ? LIMIT 1')
    .bind(receipt, transactionType)
    .first<{ 1: number }>()

  if (existing) {
    logger.info('[clickbank-webhook] duplicate receipt skipped', { receipt })
    return NextResponse.json({ ok: true, skipped: 'duplicate' }, { status: 200 })
  }

  // Attribution: resolve cvendthru → click → campaign + user
  const attribution = cvendthru ? await attributeClick(cvendthru) : null
  const attributed = attribution !== null

  // For refunds/chargebacks use negative amount for reversal
  const isReversal = transactionType === 'REFUND' || transactionType === 'CHARGEBACK'
  const grossAmount = isReversal ? -Math.abs(amount) : amount

  const { user: commissionUser, sophia: commissionSophia } = calcCommission(grossAmount)
  const { payout_status, available_at } = resolvePayout(transactionType, attributed)

  const id = crypto.randomUUID()

  try {
    await db
      .prepare(
        `INSERT INTO affiliate_conversions
           (id, receipt, click_id, campaign_id, user_id, offer_id, network,
            event_type, gross_amount, currency, commission_user, commission_sophia,
            payout_status, available_at, raw_payload)
         VALUES (?,?,?,?,?,?,'clickbank',?,?,?,?,?,?,?,?)`
      )
      .bind(
        id, receipt, attribution?.clickId ?? null, attribution?.campaignId ?? null,
        attribution?.userId ?? null, attribution?.offerId ?? null, transactionType,
        grossAmount, currency, commissionUser, commissionSophia,
        payout_status, available_at ?? null, rawBody,
      )
      .run()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE constraint failed')) {
      logger.info('[clickbank-webhook] race-detected duplicate (UNIQUE conflict)', { receipt, event_type: transactionType })
      return NextResponse.json({ ok: true, skipped: 'duplicate_race' }, { status: 200 })
    }
    logger.error('[clickbank-webhook] insert failed (non-constraint)', err instanceof Error ? err : new Error(msg), { receipt, event_type: transactionType })
    return NextResponse.json({ ok: true, skipped: 'insert_error' }, { status: 200 })
  }

  // If SALE and attributed — fire-and-forget Telegram notify
  if (transactionType === 'SALE' && attributed && attribution) {
    void notifyConversionEarned(attribution.userId, commissionUser, attribution.campaignId)
  }

  // Also update the original SALE payout_status to 'reversed' if this is a reversal.
  if (isReversal && attributed && attribution) {
    await reverseOriginalSaleIfNeeded(db, receipt, transactionType)
  }

  logger.info('[clickbank-webhook] conversion recorded', {
    id, receipt, event_type: transactionType, attributed, payout_status,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
