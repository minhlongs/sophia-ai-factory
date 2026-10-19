/**
 * PayOS IPN Webhook Route
 * Verifies the PayOS webhook body signature and activates the matching paid order.
 * Gated by FEATURE_PAYOS — returns 503 when flag is off.
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { getContractById, fulfillPayOsContractOrder } from '@/land/contracts/quote-to-cash-workflow';

const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

export async function POST(request: NextRequest) {
  const verification = await verifyPayOsRequest(request, PAYOS_CHECKSUM_KEY);
  if (!verification.ok) {
    return verification.response;
  }

  const { ipn, sanitizedBody } = verification.data;

  if (ipn.data.code !== '00') {
    logger.info('[PayOS Webhook] Non-success payment event', {
      dataCode: ipn.data.code,
      dataDesc: ipn.data.desc,
    });
    return NextResponse.json({ received: true });
  }

  const db = createServerClient();
  const { orderCode, amount, paymentLinkId } = ipn.data;

  // Idempotency: INSERT-first with UNIQUE constraint check
  const idempotency = await checkAndRecordPaymentIdempotency({
    db,
    paymentLinkId,
    sanitizedBody,
  });

  if (!idempotency.shouldProcess) {
    return idempotency.response ?? NextResponse.json({ received: true });
  }

  // Reserve the order and validate expected amount
  const validation = await validatePendingPayOsOrder({
    db,
    paymentLinkId,
    orderCode,
    amount,
    currency: ipn.data.currency,
    lockCreatedAt: idempotency.lockCreatedAt,
  });

  if (!validation.ok) {
    return validation.response;
  }

  const { order } = validation;
  const userId = order.user_id;
  if (!userId) {
    logger.error('[PayOS Webhook] Pending order has no user owner', new Error('Missing user_id'), {
      orderId: order.order_id,
      paymentLinkId,
    });
    try {
      await db
        .from('payment_events')
        .delete()
        .eq('event_id', `payos_${paymentLinkId}`)
        .eq('created_at', idempotency.lockCreatedAt)
        .eq('processed', 0);
    } catch (error) {
      logger.warn('[PayOS Webhook] Failed to release lock for ownerless order', {
        paymentLinkId,
        error: String(error),
      });
    }
    return NextResponse.json({ error: 'Order owner unavailable' }, { status: 500 });
  }

  const tier = order.tier as Tier;

  try {
    if (order.purpose === 'contract') {
      const d1 = db.unwrap();
      const contractId = order.contract_id;
      const invoiceId = order.invoice_id;
      if (!contractId || !invoiceId || order.provider_order_code == null) {
        throw new Error('Contract payment correlation is incomplete');
      }
      const contract = await getContractById(d1, contractId);
      if (!contract || contract.lastInvoiceId !== invoiceId) {
        throw new Error('Contract invoice is missing or no longer current');
      }
      await fulfillPayOsContractOrder(d1, {
        contract,
        invoiceId,
        orderId: order.order_id,
        paidByUserId: userId,
        paymentReference: String(paymentLinkId),
        providerOrderCode: order.provider_order_code,
        amountVnd: validation.expectedVndAmount,
        lockCreatedAt: idempotency.lockCreatedAt,
      });
      return NextResponse.json({ received: true, fulfillment: 'contract' });
    }

    const activation = await activatePayOsSubscription({
      db,
      userId,
      tier,
      order,
      paymentLinkId,
      lockCreatedAt: idempotency.lockCreatedAt,
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
      await db
        .from('payment_events')
        .delete()
        .eq('event_id', `payos_${paymentLinkId}`)
        .eq('created_at', idempotency.lockCreatedAt)
        .eq('processed', 0);
    } catch (delErr) {
      logger.warn('[PayOS Webhook] Failed to release lock on failure', { paymentLinkId, error: String(delErr) });
    }
    return NextResponse.json({ error: `Activation failed: ${msg}` }, { status: 500 });
  }
}
