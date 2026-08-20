/**
 * Awin Webhook Handler
 *
 * Receives conversion postbacks from Awin Publisher API.
 * HMAC-SHA256 verification via X-Awin-Signature header.
 * Idempotent on network_transaction_id.
 *
 * @module app/api/webhooks/awin/route
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

interface AwinConversionPayload {
  id?: string | number
  click_ref?: string
  sale_amount?: number
  commission_amount?: number
  publisher_id?: string
  status?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.AWIN_WEBHOOK_SECRET
  if (!secret) {
    logger.error('[awin-webhook] AWIN_WEBHOOK_SECRET not configured — rejecting unsigned payload')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-awin-signature') ?? ''

  const isValid = await verifyHmac(rawBody, signature, secret)
  if (!isValid) {
    logger.warn('[awin-webhook] invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: AwinConversionPayload
  try {
    payload = JSON.parse(rawBody) as AwinConversionPayload
  } catch {
    return NextResponse.json({ ok: true, skipped: 'parse_error' })
  }

  const transactionId = String(payload.id ?? '')
  if (!transactionId) return NextResponse.json({ ok: true, skipped: 'no_transaction_id' })

  const _db = await getD1();
  if (!_db) {
    logger.warn('[awin-webhook] D1 unavailable');
    return NextResponse.json({ ok: true, skipped: 'db_unavailable' });
  }
  const db = _db;

  // Lookup link by click_ref (sub_id)
  const clickRef = payload.click_ref ?? ''
  const linkRow = clickRef
    ? await db.prepare('SELECT id, tenant_id FROM affiliate_links WHERE sub_id = ? LIMIT 1')
        .bind(clickRef).first<{ id: string; tenant_id: string }>()
    : null

  const tenantId = linkRow?.tenant_id ?? (process.env.SOPHIA_TENANT_ID ?? 'sophia-global')
  const linkId = linkRow?.id ?? 'unknown'
  const grossAmount = payload.sale_amount ?? 0
  const commissionUsd = payload.commission_amount ?? 0
  const status = payload.status === 'approved' ? 'approved' : 'pending'
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
      transactionId, grossAmount, commissionUsd, status, now
    ).run()
    if (!result.meta.rows_written || result.meta.rows_written === 0) {
      return NextResponse.json({ ok: true, skipped: 'duplicate' })
    }
  } catch (err) {
    logger.warn('[awin-webhook] insert error', { error: err instanceof Error ? err.message : String(err) })
  }

  return NextResponse.json({ ok: true })
}
