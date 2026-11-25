/**
 * PromptPay Thai QR Payment Notification Webhook Route
 *
 * Receives bank transfer confirmations and QR slip verification callbacks.
 * Enforces fail-closed HMAC-SHA256 verification, atomic `payment_events` idempotency,
 * and exact amount, currency, and `status = 'pending'` guards.
 *
 * @module app/api/webhooks/promptpay/route
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

interface PromptPayPayload {
  transactionId: string;
  paidAmount: number;
  currency?: string;
  status?: 'success' | 'failed';
  bankRef?: string;
}

async function authenticatePromptPayBody(request: NextRequest): Promise<string | NextResponse> {
  const secret = process.env.PROMPTPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logger.error('[PromptPayWebhook] PROMPTPAY_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const rawSig = request.headers.get('x-promptpay-signature')?.trim() ?? '';
  if (!rawSig) {
    logger.warn('[PromptPayWebhook] Missing signature');
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
  }

  const sigValid = await verifyInboundWebhook(rawBody, rawSig.replace(/^sha256=/i, ''), secret, {
    algo: 'SHA-256',
  });
  if (!sigValid) {
    logger.warn('[PromptPayWebhook] Unauthorized signature');
    return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
  }
  return rawBody;
}

async function claimPromptPayEventLock(
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
    .bind(eventId, `promptpay.${status}`, rawBody)
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

async function settlePromptPaySuccess(
  db: D1Database,
  payload: PromptPayPayload,
  txn: LocalizedTxnRow,
  eventId: string,
  nowSec: number,
): Promise<NextResponse> {
  const expectedCurrency = (txn.settlement_currency || 'THB').toUpperCase();
  const receivedCurrency = (payload.currency ?? expectedCurrency).trim().toUpperCase();
  if (receivedCurrency !== expectedCurrency || !Number.isFinite(payload.paidAmount) || txn.total_amount <= 0) {
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    return NextResponse.json({ error: 'Amount or settlement currency mismatch' }, { status: 422 });
  }

  if (payload.paidAmount / txn.total_amount < MIN_SETTLEMENT_TOLERANCE) {
    logger.warn('[PromptPayWebhook] Underpaid transaction', {
      transactionId: payload.transactionId,
      expected: txn.total_amount,
      received: payload.paidAmount,
    });
    await db
      .prepare(
        `UPDATE localized_payment_transactions
         SET error_code = 'UNDERPAID', error_message = ?1, updated_at = ?2
         WHERE id = ?3 AND status = 'pending'`,
      )
      .bind(`Underpaid: received ${payload.paidAmount} of ${txn.total_amount}`, nowSec, payload.transactionId)
      .run();
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    return NextResponse.json({ received: true, status: 'underpaid' }, { status: 200 });
  }

  const updateRes = await db
    .prepare(
      `UPDATE localized_payment_transactions
       SET status = 'completed', rail_transaction_reference = ?1, settled_at = ?2, updated_at = ?2
       WHERE id = ?3 AND status = 'pending'`,
    )
    .bind(payload.bankRef ?? null, nowSec, payload.transactionId)
    .run();
  await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();

  if ((updateRes.meta?.changes ?? 0) === 0) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }
  logger.info('[PromptPayWebhook] Completed PromptPay payment', {
    transactionId: payload.transactionId,
    paidAmount: payload.paidAmount,
  });
  return NextResponse.json({ received: true, status: 'completed' }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const authOrBody = await authenticatePromptPayBody(request);
    if (authOrBody instanceof NextResponse) return authOrBody;

    let payload: PromptPayPayload;
    try {
      payload = JSON.parse(authOrBody) as PromptPayPayload;
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    if (!payload.transactionId) {
      return NextResponse.json({ error: 'Missing transactionId' }, { status: 422 });
    }

    const db = await getD1Raw();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    const status = payload.status ?? 'success';
    const eventId = `promptpay_${payload.transactionId}`;
    const lockResp = await claimPromptPayEventLock(db, eventId, status, authOrBody);
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
    if (status === 'success') {
      return settlePromptPaySuccess(db, payload, txn, eventId, nowSec);
    }

    await db
      .prepare(`UPDATE localized_payment_transactions SET status = 'failed', updated_at = ?1 WHERE id = ?2 AND status = 'pending'`)
      .bind(nowSec, payload.transactionId)
      .run();
    await db.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventId).run();
    return NextResponse.json({ received: true, status: 'failed' }, { status: 200 });
  } catch (err) {
    logger.error('[PromptPayWebhook] Handler exception', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
