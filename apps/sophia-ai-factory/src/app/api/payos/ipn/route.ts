/**
 * POST /api/payos/ipn — PayOS IPN (webhook) handler.
 * Verifies HMAC-SHA256, activates tier atomically, marks order completed.
 * Idempotent via payos_events.event_id UNIQUE constraint.
 */

import { validatePayOsPaymentIdentity, cancelPayOsPayment } from '@/app/api/webhooks/payos/modules/payos-payment-identity';
import { releaseEventLock } from './modules/event-locker';
import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_PAYOS, isPayOsEnabled } from '@/land/payments/payos';
import { isPayOsTestPing } from '@/land/payments/payos-gateway';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient, getD1 } from '@/seed/db/client';
import {
  validatePayOsRequest,
  acquireEventLock,
  activatePayOsTier,
} from './modules';

export async function POST(request: NextRequest) {
  const payosActive = process.env.FEATURE_PAYOS !== undefined ? isPayOsEnabled() : FEATURE_PAYOS;
  if (!payosActive) {
    return NextResponse.json({ error: 'PayOS not enabled' }, { status: 503 });
  }

  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!checksumKey) {
    logger.error('[PayOS IPN] PAYOS_CHECKSUM_KEY not configured');
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  const validation = await validatePayOsRequest(request, checksumKey);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const { bodyJson, ipnData, success } = validation.data;
  const { orderCode, amount, paymentLinkId } = ipnData;

  if (isPayOsTestPing(ipnData)) {
    logger.info('[PayOS IPN] Ignored PayOS test ping', {
      orderCode,
      description: ipnData.description,
    });
    return NextResponse.json({ received: true, ignored: 'test_ping' });
  }

  const eventId = `payos_${orderCode}`;
  const db = createServerClient();
  const d1 = await getD1();

  if (!d1) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

  const identity = await validatePayOsPaymentIdentity({ db, orderCode, paymentLinkId, amount, currency: ipnData.currency });
  if (!identity.ok) return NextResponse.json({ error: identity.error }, { status: identity.status });
  if (identity.order.purpose === 'contract') return NextResponse.json({ error: 'Contract requires canonical endpoint' }, { status: 400 });
  if (identity.order.status !== 'pending') return NextResponse.json({ received: true, duplicate: true });

  const lock = await acquireEventLock(d1, eventId, orderCode, success, amount, bodyJson);
  if (lock.status === 'already_processed') {
    return NextResponse.json({ received: true, note: 'Already processed' });
  }
  if (lock.status === 'already_processing') {
    return NextResponse.json({ error: 'Already processing' }, { status: 409 });
  }
  if (lock.status === 'error') {
    return NextResponse.json({ error: lock.message }, { status: lock.statusCode });
  }

  try {
    if (!success) {
      await cancelPayOsPayment({ db, order: identity.order, eventId, lockCreatedAt: lock.lockCreatedAt, table: 'payos_events' });
      return NextResponse.json({ received: true });
    }
    const activation = await activatePayOsTier({
      db,
      d1,
      orderCode,
      paymentLinkId,
      amount,
      eventId,
      lockCreatedAt: lock.lockCreatedAt,
      order: identity.order,
    });

    if (!activation.ok) {
      try {
        await releaseEventLock(d1, eventId, lock.lockCreatedAt);
      } catch (delErr) {
        logger.warn('[PayOS IPN] Failed to release lock on rejected activation', { orderCode, error: String(delErr) });
      }
      return NextResponse.json({ error: activation.error }, { status: activation.status });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error('[PayOS IPN] Processing failed', errorObj, { orderCode });
    try {
      await releaseEventLock(d1, eventId, lock.lockCreatedAt);
    } catch (delErr) {
      logger.warn('[PayOS IPN] Failed to release lock on failure', { orderCode, error: String(delErr) });
    }
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}
