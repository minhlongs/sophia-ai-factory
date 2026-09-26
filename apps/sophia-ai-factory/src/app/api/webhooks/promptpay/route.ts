/**
 * PromptPay Thai QR Payment Notification Webhook Route
 *
 * Receives bank transfer confirmations and QR slip verification callbacks.
 *
 * Layer: app/api/webhooks (Edge API route)
 *
 * @module app/api/webhooks/promptpay/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Raw } from '@/seed/db/client';

const PROMPTPAY_WEBHOOK_SECRET = process.env.PROMPTPAY_WEBHOOK_SECRET ?? 'promptpay_mock_secret';
const MIN_SETTLEMENT_TOLERANCE = 0.995; // 99.5% tolerance threshold

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-promptpay-signature') ?? request.headers.get('authorization');

    if (process.env.NODE_ENV === 'production' && (!signature || signature !== PROMPTPAY_WEBHOOK_SECRET)) {
      logger.warn('[PromptPayWebhook] Unauthorized signature');
      return NextResponse.json({ error: 'Unauthorized signature' }, { status: 401 });
    }

    let payload: {
      transactionId: string;
      paidAmount: number;
      currency?: string;
      status?: 'success' | 'failed';
      bankRef?: string;
    };

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const { transactionId, paidAmount, bankRef, status = 'success' } = payload;
    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transactionId' }, { status: 422 });
    }

    const db = await getD1Raw();
    if (!db) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }

    const txn = await db
      .prepare(
        `SELECT id, total_amount, status FROM localized_payment_transactions WHERE id = ?1 LIMIT 1`,
      )
      .bind(transactionId)
      .first<{ id: string; total_amount: number; status: string }>();

    if (!txn) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const nowSec = Math.floor(Date.now() / 1000);

    if (status === 'success') {
      // Validate tolerance threshold (>= 99.5%)
      const ratio = paidAmount / txn.total_amount;
      if (ratio < MIN_SETTLEMENT_TOLERANCE) {
        logger.warn('[PromptPayWebhook] Underpaid transaction', {
          transactionId,
          expected: txn.total_amount,
          received: paidAmount,
        });

        await db
          .prepare(
            `UPDATE localized_payment_transactions
             SET error_code = 'UNDERPAID',
                 error_message = ?1,
                 updated_at = ?2
             WHERE id = ?3`,
          )
          .bind(`Underpaid: received ${paidAmount} of ${txn.total_amount}`, nowSec, transactionId)
          .run();

        return NextResponse.json({ received: true, status: 'underpaid' }, { status: 200 });
      }

      await db
        .prepare(
          `UPDATE localized_payment_transactions
           SET status = 'completed',
               rail_transaction_reference = ?1,
               settled_at = ?2,
               updated_at = ?2
           WHERE id = ?3`,
        )
        .bind(bankRef ?? null, nowSec, transactionId)
        .run();

      logger.info('[PromptPayWebhook] Completed PromptPay payment', { transactionId, paidAmount });
      return NextResponse.json({ received: true, status: 'completed' }, { status: 200 });
    }

    // Payment failed or cancelled
    await db
      .prepare(
        `UPDATE localized_payment_transactions
         SET status = 'failed',
             updated_at = ?1
         WHERE id = ?2`,
      )
      .bind(nowSec, transactionId)
      .run();

    return NextResponse.json({ received: true, status: 'failed' }, { status: 200 });
  } catch (err) {
    logger.error('[PromptPayWebhook] Handler exception', { error: String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
