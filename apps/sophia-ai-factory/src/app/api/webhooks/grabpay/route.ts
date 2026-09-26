/**
 * GrabPay Payment Notification Webhook Route
 *
 * Receives GrabPay checkout completion callbacks across SEA (SG, MY, TH, ID, VN).
 *
 * Layer: app/api/webhooks (Edge API route)
 *
 * @module app/api/webhooks/grabpay/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Raw } from '@/seed/db/client';

const GRABPAY_WEBHOOK_SECRET = process.env.GRABPAY_WEBHOOK_SECRET ?? 'grabpay_mock_secret';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-grab-signature') ?? request.headers.get('authorization');

    if (process.env.NODE_ENV === 'production' && (!signature || signature !== GRABPAY_WEBHOOK_SECRET)) {
      logger.warn('[GrabPayWebhook] Invalid signature');
      return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
    }

    let payload: {
      transactionId: string;
      grabSessionId?: string;
      status: 'SUCCESS' | 'FAILED' | 'EXPIRED';
      amount: number;
      currency: string;
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const { transactionId, status, grabSessionId } = payload;
    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transactionId' }, { status: 422 });
    }

    const db = await getD1Raw();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const nowSec = Math.floor(Date.now() / 1000);

    if (status === 'SUCCESS') {
      await db
        .prepare(
          `UPDATE localized_payment_transactions
           SET status = 'completed',
               rail_transaction_reference = ?1,
               settled_at = ?2,
               updated_at = ?2
           WHERE id = ?3`,
        )
        .bind(grabSessionId ?? null, nowSec, transactionId)
        .run();

      logger.info('[GrabPayWebhook] GrabPay transaction completed', { transactionId });
      return NextResponse.json({ received: true, status: 'completed' }, { status: 200 });
    }

    const finalStatus = status === 'EXPIRED' ? 'expired' : 'failed';
    await db
      .prepare(
        `UPDATE localized_payment_transactions
         SET status = ?1,
             updated_at = ?2
         WHERE id = ?3`,
      )
      .bind(finalStatus, nowSec, transactionId)
      .run();

    return NextResponse.json({ received: true, status: finalStatus }, { status: 200 });
  } catch (err) {
    logger.error('[GrabPayWebhook] Unexpected error', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
