/**
 * PayOS IPN Webhook Route
 * Verifies x-checksum header with HMAC-SHA256, activates tier on successful payment.
 * Gated by FEATURE_PAYOS — returns 503 when flag is off.
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseUserIdFromPayOsDescription } from '@/land/payments/payos';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import type { Tier } from '@/seed/types';
import {
  verifyPayOsRequest,
  checkAndRecordPaymentIdempotency,
  validatePendingPayOsOrder,
  activatePayOsSubscription,
  processPayOsPostFulfillment,
} from './modules';

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

export async function POST(request: NextRequest) {
  const verification = await verifyPayOsRequest(request, PAYOS_CHECKSUM_KEY);
  if (!verification.ok) {
    return verification.response;
  }

  const { ipn, sanitizedBody } = verification.data;

  if (!ipn.success || ipn.code !== '00') {
    logger.info('[PayOS Webhook] Non-success payment event', { code: ipn.code, desc: ipn.desc });
    return NextResponse.json({ received: true });
  }

  const db = createServerClient();
  const { orderCode, amount, description, paymentLinkId } = ipn.data;

  // Idempotency: INSERT-first with UNIQUE constraint check
  const idempotency = await checkAndRecordPaymentIdempotency({
    db,
    paymentLinkId,
    sanitizedBody,
  });

  if (!idempotency.shouldProcess) {
    return idempotency.response ?? NextResponse.json({ received: true });
  }

  const userId = parseUserIdFromPayOsDescription(description);
  if (!userId) {
    logger.warn('[PayOS Webhook] Cannot parse userId from description', { description, orderCode });
    return NextResponse.json({ error: 'Cannot resolve user' }, { status: 422 });
  }

  // Reserve the order and validate expected amount
  const validation = await validatePendingPayOsOrder({
    db,
    paymentLinkId,
    orderCode,
    amount,
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { order } = validation;
  const tier = order.tier as Tier;

  try {
    const activation = await activatePayOsSubscription({
      db,
      userId,
      tier,
      order,
      paymentLinkId,
    });

    await processPayOsPostFulfillment({
      db,
      userId,
      tier,
      order,
      paymentLinkId,
      amount,
      orgId: activation.orgId,
      periodEnd: activation.periodEnd,
      isLifetime: activation.isLifetime,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[PayOS Webhook] Activation failed', new Error(msg), { userId, tier });
    // Release lock on failure to enable retry
    try {
      await db.from('payment_events').delete().eq('event_id', `payos_${paymentLinkId}`);
    } catch (delErr) {
      logger.warn('[PayOS Webhook] Failed to release lock on failure', { paymentLinkId, error: String(delErr) });
    }
    return NextResponse.json({ error: `Activation failed: ${msg}` }, { status: 500 });
  }
}
