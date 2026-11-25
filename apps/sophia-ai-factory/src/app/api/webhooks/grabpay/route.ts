/**
 * GrabPay Payment Notification Webhook Route
 *
 * Receives GrabPay checkout completion callbacks across SEA (SG, MY, TH, ID, VN).
 * Enforces fail-closed HMAC-SHA256 verification, atomic `payment_events` idempotency,
 * and exact amount, currency, and `status = 'pending'` guards.
 *
 * @module app/api/webhooks/grabpay/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Raw } from '@/seed/db/client';
import { verifyInboundWebhook } from '@/seed/security/signature';

const MIN_SETTLEMENT_TOLERANCE = 0.995;

interface LocalizedTxnRow {
  id: string;
  total_amount: number;
  settlement_currency: string;
  status: string;
}

interface GrabPayPayload {
  transactionId: string;
  grabSessionId?: string;
  status: 'SUCCESS' | 'FAILED' | 'EXPIRED';
  amount: number;
  currency: string;
}

async function authenticateGrabPayBody(request: NextRequest): Promise<string | NextResponse> {
  const secret = process.env.GRABPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logger.error('[GrabPayWebhook] GRABPAY_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const rawSig = request.headers.get('x-grab-signature')?.trim() ?? '';
  if (!rawSig) {
    logger.warn('[GrabPayWebhook] Missing signature');
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
  }

  const sigValid = await verifyInboundWebhook(rawBody, rawSig.replace(/^sha256=/i, ''), secret, {
    algo: 'SHA-256',
  });
  if (!sigValid) {
    logger.warn('[GrabPayWebhook] Invalid signature');
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
  }
  return rawBody;
}

async function claimGrabPayEventLock(
  db: D1Database,
  eventId: string,
  status: string,
  rawBody: string,
): Promise<NextResponse | null> {
  const lockRes = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed)
       VALUES (?1, ?2, ?3, 0)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, `grabpay.${status.toLowerCase()}`, rawBody)
    .run();

  if ((lockRes.meta?.changes ?? 0) > 0) return null;

  const existing = await db
    .prepare('SELECT processed FROM payment_events WHERE event_id = ?1 LIMIT 1')
    .bind(eventId)
    .first<{ processed: number }>();
  if (existing?.processed === 1) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }
  return NextResponse.json({ error: 'Webhook event already in progress' }, { status: 409 });
}

function isGrabPaySettlementValid(payload: GrabPayPayload, txn: LocalizedTxnRow): boolean {
  return (
    typeof payload.currency === 'string' &&
    payload.currency.trim().toUpperCase() === txn.settlement_currency.toUpperCase() &&
    Number.isFinite(payload.amount) &&
    txn.total_amount > 0 &&
    payload.amount >= txn.total_amount * MIN_SETTLEMENT_TOLERANCE
  );
}

async function handleGrabPaySuccess(
  db: D1Database,
  payload: GrabPayPayload,
  txn: LocalizedTxnRow,
  eventId: string,
  nowSec: number,
): Promise<NextResponse> {
  if (!isGrabPaySettlementValid(payload, txn)) {
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    await db
      .prepare(
        `UPDATE localized_payment_transactions
         SET error_code = 'AMOUNT_OR_CURRENCY_MISMATCH',
             error_message = ?1,
             updated_at = ?2
         WHERE id = ?3 AND status = 'pending'`,
      )
      .bind(
        `Rejected settlement: received ${String(payload.amount)} ${String(payload.currency)} vs expected ${txn.total_amount} ${txn.settlement_currency}`,
        nowSec,
        payload.transactionId,
      )
      .run();
    return NextResponse.json({ error: 'Amount or currency mismatch' }, { status: 422 });
  }

  const updateRes = await db
    .prepare(
      `UPDATE localized_payment_transactions
       SET status = 'completed',
           rail_transaction_reference = ?1,
           settled_at = ?2,
           updated_at = ?2
       WHERE id = ?3 AND status = 'pending'`,
    )
    .bind(payload.grabSessionId ?? null, nowSec, payload.transactionId)
    .run();
  await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();

  if ((updateRes.meta?.changes ?? 0) === 0) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }
  logger.info('[GrabPayWebhook] GrabPay transaction completed', { transactionId: payload.transactionId });
  return NextResponse.json({ received: true, status: 'completed' }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const authOrBody = await authenticateGrabPayBody(request);
    if (authOrBody instanceof NextResponse) return authOrBody;

    let payload: GrabPayPayload;
    try {
      payload = JSON.parse(authOrBody) as GrabPayPayload;
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    if (!payload.transactionId) {
      return NextResponse.json({ error: 'Missing transactionId' }, { status: 422 });
    }

    const db = await getD1Raw();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const eventId = `grabpay_${payload.transactionId}`;
    const lockResp = await claimGrabPayEventLock(db, eventId, payload.status, authOrBody);
    if (lockResp) return lockResp;

    const txn = await db
      .prepare('SELECT id, total_amount, settlement_currency, status FROM localized_payment_transactions WHERE id = ?1 LIMIT 1')
      .bind(payload.transactionId)
      .first<LocalizedTxnRow>();

    if (!txn) {
      await db.prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0').bind(eventId).run();
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    if (txn.status !== 'pending') {
      await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
      return NextResponse.json({ received: true, duplicate: true, status: txn.status }, { status: 200 });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.status === 'SUCCESS') {
      return handleGrabPaySuccess(db, payload, txn, eventId, nowSec);
    }

    const finalStatus = payload.status === 'EXPIRED' ? 'expired' : 'failed';
    await db
      .prepare(`UPDATE localized_payment_transactions SET status = ?1, updated_at = ?2 WHERE id = ?3 AND status = 'pending'`)
      .bind(finalStatus, nowSec, payload.transactionId)
      .run();
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();

    return NextResponse.json({ received: true, status: finalStatus }, { status: 200 });
  } catch (err) {
    logger.error('[GrabPayWebhook] Unexpected error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
