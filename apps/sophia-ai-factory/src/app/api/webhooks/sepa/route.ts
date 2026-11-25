/**
 * SEPA Direct Debit Clearing & Return Webhook Route
 * Enforces fail-closed HMAC-SHA256 verification, atomic `payment_events` idempotency,
 * and exact amount, currency, and `status = 'pending'` guards on clearing.
 *
 * @module app/api/webhooks/sepa/route
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

interface SepaPayload {
  eventType: string;
  mandateReference: string;
  transactionId: string;
  settledAmountEur?: number;
  currency?: string;
  returnReasonCode?: string;
}

async function authenticateSepaBody(request: NextRequest): Promise<string | NextResponse> {
  const secret = process.env.SEPA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logger.error('[SepaWebhook] SEPA_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const rawSig = request.headers.get('x-sepa-signature')?.trim() ?? '';
  if (!rawSig) {
    logger.warn('[SepaWebhook] Missing signature');
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
  }

  const sigValid = await verifyInboundWebhook(rawBody, rawSig.replace(/^sha256=/i, ''), secret, {
    algo: 'SHA-256',
  });
  if (!sigValid) {
    logger.warn('[SepaWebhook] Invalid signature');
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
  }
  return rawBody;
}

async function claimSepaEventLock(
  db: D1Database,
  eventId: string,
  eventType: string,
  rawBody: string,
): Promise<NextResponse | null> {
  const lockRes = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed)
       VALUES (?1, ?2, ?3, 0)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, `sepa.${eventType}`, rawBody)
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

function isValidSepaClearing(payload: SepaPayload, txn: LocalizedTxnRow): boolean {
  const expectedCurrency = (txn.settlement_currency || 'EUR').toUpperCase();
  const receivedCurrency = (payload.currency ?? 'EUR').trim().toUpperCase();
  return (
    expectedCurrency === 'EUR' &&
    receivedCurrency === 'EUR' &&
    typeof payload.settledAmountEur === 'number' &&
    Number.isFinite(payload.settledAmountEur) &&
    txn.total_amount > 0 &&
    payload.settledAmountEur >= txn.total_amount * MIN_SETTLEMENT_TOLERANCE
  );
}

async function handleSepaCleared(
  db: D1Database,
  payload: SepaPayload,
  txn: LocalizedTxnRow,
  eventId: string,
  nowSec: number,
): Promise<NextResponse> {
  if (txn.status !== 'pending') {
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    return NextResponse.json({ received: true, duplicate: true, status: txn.status }, { status: 200 });
  }

  if (!isValidSepaClearing(payload, txn)) {
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    await db
      .prepare(
        `UPDATE localized_payment_transactions
         SET error_code = 'AMOUNT_OR_CURRENCY_MISMATCH', error_message = ?1, updated_at = ?2
         WHERE id = ?3 AND status = 'pending'`,
      )
      .bind(
        `Rejected SEPA settlement: received ${String(payload.settledAmountEur)} vs expected ${txn.total_amount} EUR`,
        nowSec,
        payload.transactionId,
      )
      .run();
    return NextResponse.json({ error: 'Amount or currency mismatch' }, { status: 422 });
  }

  const updateRes = await db
    .prepare(
      `UPDATE localized_payment_transactions
       SET status = 'completed', settled_at = ?1, updated_at = ?1
       WHERE id = ?2 AND status = 'pending'`,
    )
    .bind(nowSec, payload.transactionId)
    .run();
  await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();

  if ((updateRes.meta?.changes ?? 0) === 0) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }
  logger.info('[SepaWebhook] Transaction cleared successfully', {
    transactionId: payload.transactionId,
    mandateReference: payload.mandateReference,
  });
  return NextResponse.json({ received: true, status: 'completed' }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const authOrBody = await authenticateSepaBody(request);
    if (authOrBody instanceof NextResponse) return authOrBody;

    let payload: SepaPayload;
    try {
      payload = JSON.parse(authOrBody) as SepaPayload;
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    if (!payload.transactionId) {
      return NextResponse.json({ error: 'Missing transactionId in payload' }, { status: 422 });
    }

    const db = await getD1Raw();
    if (!db) return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });

    const eventId =
      payload.eventType === 'charged_back'
        ? `sepa_${payload.transactionId}_chargeback`
        : `sepa_${payload.transactionId}`;
    const lockResp = await claimSepaEventLock(db, eventId, payload.eventType, authOrBody);
    if (lockResp) return lockResp;

    const txn = await db
      .prepare('SELECT id, total_amount, settlement_currency, status FROM localized_payment_transactions WHERE id = ?1 LIMIT 1')
      .bind(payload.transactionId)
      .first<LocalizedTxnRow>();

    if (!txn) {
      await db.prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0').bind(eventId).run();
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.eventType === 'cleared') {
      return handleSepaCleared(db, payload, txn, eventId, nowSec);
    }

    if (payload.eventType === 'charged_back' || payload.eventType === 'failed') {
      const targetStatus = payload.eventType === 'charged_back' ? 'charged_back' : 'failed';
      const allowedFromSql =
        payload.eventType === 'charged_back' ? `status IN ('pending', 'completed')` : `status = 'pending'`;
      await db
        .prepare(`UPDATE localized_payment_transactions SET status = ?1, error_code = ?2, updated_at = ?3 WHERE id = ?4 AND ${allowedFromSql}`)
        .bind(targetStatus, payload.returnReasonCode ?? 'REVERSED', nowSec, payload.transactionId)
        .run();
      await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
      logger.warn('[SepaWebhook] Transaction returned or charged back', {
        transactionId: payload.transactionId,
        status: targetStatus,
        reason: payload.returnReasonCode,
      });
      return NextResponse.json({ received: true, status: targetStatus }, { status: 200 });
    }

    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    return NextResponse.json({ received: true, note: 'unhandled_event' }, { status: 200 });
  } catch (err) {
    logger.error('[SepaWebhook] Unexpected handler error', { error: String(err) });
    return NextResponse.json({ error: 'Internal webhook error' }, { status: 500 });
  }
}
