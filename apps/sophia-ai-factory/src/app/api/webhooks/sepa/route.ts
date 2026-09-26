/**
 * SEPA Direct Debit Clearing & Return Webhook Route
 *
 * Processes bank clearing notifications (pacs.008 / camt.054) and
 * debtor reversal/chargeback R-transactions (pain.002).
 *
 * Layer: app/api/webhooks (Edge API route)
 *
 * @module app/api/webhooks/sepa/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Raw } from '@/seed/db/client';

const SEPA_WEBHOOK_SECRET = process.env.SEPA_WEBHOOK_SECRET ?? 'sepa_mock_secret_key';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-sepa-signature') ?? request.headers.get('authorization');

    // Secret verification (in development/test, permit test keys)
    if (process.env.NODE_ENV === 'production' && (!signature || signature !== SEPA_WEBHOOK_SECRET)) {
      logger.warn('[SepaWebhook] Invalid or missing signature');
      return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
    }

    let payload: {
      eventType: string; // 'cleared' | 'failed' | 'charged_back'
      mandateReference: string;
      transactionId: string;
      settledAmountEur?: number;
      returnReasonCode?: string;
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const { eventType, transactionId, mandateReference, returnReasonCode } = payload;
    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transactionId in payload' }, { status: 422 });
    }

    const db = await getD1Raw();
    if (!db) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const nowSec = Math.floor(Date.now() / 1000);

    if (eventType === 'cleared') {
      await db
        .prepare(
          `UPDATE localized_payment_transactions
           SET status = 'completed',
               settled_at = ?1,
               updated_at = ?1
           WHERE id = ?2`,
        )
        .bind(nowSec, transactionId)
        .run();

      logger.info('[SepaWebhook] Transaction cleared successfully', { transactionId, mandateReference });
      return NextResponse.json({ received: true, status: 'completed' }, { status: 200 });
    }

    if (eventType === 'charged_back' || eventType === 'failed') {
      const targetStatus = eventType === 'charged_back' ? 'charged_back' : 'failed';
      await db
        .prepare(
          `UPDATE localized_payment_transactions
           SET status = ?1,
               error_code = ?2,
               updated_at = ?3
           WHERE id = ?4`,
        )
        .bind(targetStatus, returnReasonCode ?? 'REVERSED', nowSec, transactionId)
        .run();

      logger.warn('[SepaWebhook] Transaction returned or charged back', {
        transactionId,
        status: targetStatus,
        reason: returnReasonCode,
      });

      return NextResponse.json({ received: true, status: targetStatus }, { status: 200 });
    }

    return NextResponse.json({ received: true, note: 'unhandled_event' }, { status: 200 });
  } catch (err) {
    logger.error('[SepaWebhook] Unexpected handler error', { error: String(err) });
    return NextResponse.json({ error: 'Internal webhook error' }, { status: 500 });
  }
}
