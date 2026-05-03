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
import { verifyClickBankSignature } from '@/lib/affiliates/clickbank-signature-verifier'
import { parsePostback } from '@/lib/affiliates/clickbank-postback-parser'
import { attributeClick } from '@/lib/affiliates/conversion-attributor'
import { calcCommission } from '@/lib/affiliates/commission-calculator'
import { notifyConversionEarned } from '@/lib/inngest/functions/generate-campaign-db'
import { checkRateLimit } from '@/lib/telegram/sql-rate-limiter'
import { logger } from '@/seed/utils/logger-utility'

/** Map canonical event type to payout status */
function resolvePayout(
  eventType: string,
  attributed: boolean
): { payout_status: string; available_at: number | null } {
  if (!attributed) {
    return { payout_status: 'unattributed', available_at: null }
  }
  // TEST events are tag-only: mark pending_clearance but no clearance window (M5 wallet ignores)
  if (eventType === 'TEST') {
    return { payout_status: 'pending_clearance', available_at: null }
  }
  if (eventType === 'SALE') {
    const available_at = Math.floor(Date.now() / 1000) + 60 * 86400 // +60 days
    return { payout_status: 'pending_clearance', available_at }
  }
  return { payout_status: 'reversed', available_at: null }
}

/** Get raw D1Database binding */
function getD1Binding(): D1Database | null {
  const env = (globalThis as unknown as { __env?: Record<string, unknown> }).__env
  if (env?.DB) return env.DB as D1Database
  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  return globalDb ?? null
}

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
        id,
        receipt,
        attribution?.clickId ?? null,
        attribution?.campaignId ?? null,
        attribution?.userId ?? null,
        attribution?.offerId ?? null,
        transactionType,
        grossAmount,
        currency,
        commissionUser,
        commissionSophia,
        payout_status,
        available_at ?? null,
        rawBody,
      )
      .run()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE constraint failed')) {
      // Race: ClickBank fired duplicate before idempotency SELECT completed
      logger.info('[clickbank-webhook] race-detected duplicate (UNIQUE conflict)', { receipt, event_type: transactionType })
      return NextResponse.json({ ok: true, skipped: 'duplicate_race' }, { status: 200 })
    }
    logger.error('[clickbank-webhook] insert failed (non-constraint)', err instanceof Error ? err : new Error(msg), {
      receipt,
      event_type: transactionType,
    })
    return NextResponse.json({ ok: true, skipped: 'insert_error' }, { status: 200 })
  }

  // If SALE and attributed — fire-and-forget Telegram notify
  if (transactionType === 'SALE' && attributed && attribution) {
    void notifyConversionEarned(attribution.userId, commissionUser, attribution.campaignId)
  }

  // Also update the original SALE payout_status to 'reversed' if this is a reversal.
  // Match by receipt (not click_id) to avoid mass-reversing recurring billing rows.
  if (isReversal && attributed && attribution) {
    try {
      const result = await db
        .prepare(
          `UPDATE affiliate_conversions
             SET payout_status = 'reversed'
           WHERE receipt = ?
             AND event_type = 'SALE'
             AND payout_status IN ('pending_clearance','available')`
        )
        .bind(receipt)
        .run()

      const changes = (result.meta as { changes?: number } | undefined)?.changes ?? 0
      if (changes === 0) {
        logger.warn('[clickbank-webhook] reversal had no matching SALE', { receipt, event_type: transactionType })
      }
    } catch (err) {
      logger.warn('[clickbank-webhook] reversal update failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('[clickbank-webhook] conversion recorded', {
    id,
    receipt,
    event_type: transactionType,
    attributed,
    payout_status,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
