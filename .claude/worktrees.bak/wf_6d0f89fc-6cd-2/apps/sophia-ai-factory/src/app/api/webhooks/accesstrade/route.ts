/**
 * AccessTrade Webhook Handler
 *
 * Receives conversion postbacks from AccessTrade VN.
 * HMAC-SHA256 verification via X-Accesstrade-Signature header.
 * Idempotent on network_transaction_id.
 *
 * @module app/api/webhooks/accesstrade/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { getD1 } from '@/seed/db/client'

async function verifyHmac(body: string, signature: string, secret: string): Promise<boolean> {
  if (!body || !signature || !secret) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const computed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    const a = new TextEncoder().encode(computed)
    const b = new TextEncoder().encode(signature.trim().toLowerCase())
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  } catch {
    return false
  }
}

interface AccessTradeConversionPayload {
  conversion_id?: string
  click_id?: string
  order_value?: number
  commission?: number
  sub_id?: string
  status?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.ACCESSTRADE_WEBHOOK_SECRET
  if (!secret) {
    logger.warn('[accesstrade-webhook] ACCESSTRADE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ ok: true, skipped: 'config' })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-accesstrade-signature') ?? ''

  const isValid = await verifyHmac(rawBody, signature, secret)
  if (!isValid) {
    logger.warn('[accesstrade-webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: AccessTradeConversionPayload
  try {
    payload = JSON.parse(rawBody) as AccessTradeConversionPayload
  } catch {
    return NextResponse.json({ ok: true, skipped: 'parse_error' })
  }

  const conversionId = payload.conversion_id
  if (!conversionId) return NextResponse.json({ ok: true, skipped: 'no_conversion_id' })

  const _db = getD1();
  if (!_db) {
    logger.warn('[accesstrade-webhook] D1 unavailable');
    return NextResponse.json({ ok: true, skipped: 'db_unavailable' });
  }
  const db = _db;

  const subId = payload.sub_id ?? ''
  const linkRow = subId
    ? await db.prepare('SELECT id, tenant_id FROM affiliate_links WHERE sub_id = ? LIMIT 1')
        .bind(subId).first<{ id: string; tenant_id: string }>()
    : null

  const tenantId = linkRow?.tenant_id ?? (process.env.SOPHIA_TENANT_ID ?? 'sophia-global')
  const linkId = linkRow?.id ?? 'unknown'
  const grossAmount = payload.order_value ?? 0
  const commissionUsd = payload.commission ?? 0
  const status = payload.status === 'approved' ? 'approved' : 'pending'
  const now = Math.floor(Date.now() / 1000)

  try {
    // Atomic idempotency: INSERT OR IGNORE + rows_written check (eliminates SELECT pre-check race)
    const result = await db.prepare(
      `INSERT OR IGNORE INTO conversion_events
        (id, tenant_id, link_id, click_id, network_transaction_id,
         gross_amount_usd, commission_usd, status, attributed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), tenantId, linkId,
      payload.click_id ?? null,
      conversionId, grossAmount, commissionUsd, status, now
    ).run()
    if (!result.meta.rows_written || result.meta.rows_written === 0) {
      return NextResponse.json({ ok: true, skipped: 'duplicate' })
    }
  } catch (err) {
    logger.warn('[accesstrade-webhook] insert error', { error: err instanceof Error ? err.message : String(err) })
  }

  return NextResponse.json({ ok: true })
}
