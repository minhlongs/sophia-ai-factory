/**
 * Amazon Associates Webhook Handler
 *
 * Receives conversion postbacks from Amazon Associates.
 * HMAC-SHA256 verification via X-Amazon-Signature header.
 * Idempotent on network_transaction_id.
 *
 * Note: Amazon Associates uses standard SNS-style signature verification.
 *
 * @module app/api/webhooks/amazon/route
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

interface AmazonConversionPayload {
  order_id?: string
  asin?: string
  revenue?: number
  commission?: number
  tag?: string
  status?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.AMAZON_WEBHOOK_SECRET
  if (!secret) {
    logger.error('[amazon-webhook] AMAZON_WEBHOOK_SECRET not configured — rejecting unsigned payload')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-amazon-signature') ?? ''

  const isValid = await verifyHmac(rawBody, signature, secret)
  if (!isValid) {
    logger.warn('[amazon-webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: AmazonConversionPayload
  try {
    payload = JSON.parse(rawBody) as AmazonConversionPayload
  } catch {
    return NextResponse.json({ ok: true, skipped: 'parse_error' })
  }

  const orderId = payload.order_id
  if (!orderId) return NextResponse.json({ ok: true, skipped: 'no_order_id' })

  const _db = await getD1();
  if (!_db) {
    logger.warn('[amazon-webhook] D1 unavailable');
    return NextResponse.json({ ok: true, skipped: 'db_unavailable' });
  }
  const db = _db;

  // Lookup link by partner tag used as sub_id.
  // LIMITATION: Amazon's `tag` is a shared Associates ID across all clicks from the same account.
  // Per-click attribution requires a composite tag suffix (e.g. `${PARTNER_TAG}-${linkIdShort}`)
  // appended at redirect time and stored as sub_id. Without that, we match the first link with
  // PLANNED(phase-13): implement per-click tag suffix for accurate per-link attribution.
 // Current behavior: matches first link with matching tag; cross-attribution possible.
  const tag = payload.tag ?? ''
  const linkRow = tag
    ? await db.prepare('SELECT id, tenant_id FROM affiliate_links WHERE sub_id = ? LIMIT 1')
        .bind(tag).first<{ id: string; tenant_id: string }>()
    : null

  const tenantId = linkRow?.tenant_id ?? (process.env.SOPHIA_TENANT_ID ?? 'sophia-global')
  const linkId = linkRow?.id ?? 'unknown'
  const grossAmount = payload.revenue ?? 0
  const commissionUsd = payload.commission ?? 0
  const status = payload.status === 'shipped' ? 'approved' : 'pending'
  const now = Math.floor(Date.now() / 1000)

  try {
    // Atomic idempotency: INSERT OR IGNORE + rows_written check (eliminates SELECT pre-check race)
    const result = await db.prepare(
      `INSERT OR IGNORE INTO conversion_events
        (id, tenant_id, link_id, click_id, network_transaction_id,
         gross_amount_usd, commission_usd, status, attributed_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), tenantId, linkId,
      orderId, grossAmount, commissionUsd, status, now
    ).run()
    if (!result.meta.rows_written || result.meta.rows_written === 0) {
      return NextResponse.json({ ok: true, skipped: 'duplicate' })
    }
  } catch (err) {
    logger.warn('[amazon-webhook] insert error', { error: err instanceof Error ? err.message : String(err) })
  }

  return NextResponse.json({ ok: true })
}
