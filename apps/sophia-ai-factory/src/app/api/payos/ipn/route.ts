/**
 * POST /api/payos/ipn — PayOS IPN (webhook) handler.
 * Verifies HMAC-SHA256, activates tier atomically, marks order completed.
 * Idempotent via payos_events.event_id UNIQUE constraint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_PAYOS } from '@/land/payments/payos';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient, getD1 } from '@/seed/db/client';
import {
  validatePayOsRequest,
  acquireEventLock,
  handleFailedPayment,
  activatePayOsTier,
} from './modules';

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

export async function POST(request: NextRequest) {
  if (!FEATURE_PAYOS) {
    return NextResponse.json({ error: 'PayOS not enabled' }, { status: 503 });
  }

  if (!PAYOS_CHECKSUM_KEY) {
    logger.error('[PayOS IPN] PAYOS_CHECKSUM_KEY not configured');
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  const validation = await validatePayOsRequest(request, PAYOS_CHECKSUM_KEY);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const { bodyJson, ipnData, success } = validation.data;
  const { orderCode, amount, paymentLinkId } = ipnData;
  const eventId = `payos_${orderCode}`;
  const db = createServerClient();
  const d1 = await getD1();

  if (!d1) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

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

  if (!success) {
    const failRes = await handleFailedPayment(db, d1, eventId, orderCode, paymentLinkId);
    if (!failRes.ok) {
      return NextResponse.json({ error: failRes.error }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  try {
    const activation = await activatePayOsTier({
      db,
      d1,
      orderCode,
      paymentLinkId,
      amount,
      eventId,
    });

    if (!activation.ok) {
      return NextResponse.json({ error: activation.error }, { status: activation.status });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error('[PayOS IPN] Processing failed', errorObj, { orderCode });
    try {
      await db.from('payos_events').delete().eq('event_id', eventId);
    } catch (delErr) {
      logger.warn('[PayOS IPN] Failed to release lock on failure', { orderCode, error: String(delErr) });
    }
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}
