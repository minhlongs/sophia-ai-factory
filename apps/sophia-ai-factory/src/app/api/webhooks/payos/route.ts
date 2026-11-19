import { validatePayOsPaymentIdentity, cancelPayOsPayment } from './modules/payos-payment-identity';
/**
 * PayOS IPN Webhook Route
 * Verifies the PayOS webhook body signature and activates the matching paid order.
 * Gated by FEATURE_PAYOS — returns 503 when flag is off.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isPayOsTestPing } from '@/land/payments/payos-gateway';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import type { Tier } from '@/seed/types';
import {
  verifyPayOsRequest,
  checkAndRecordPaymentIdempotency,
  activatePayOsSubscription,
  processPayOsPostFulfillment,
} from './modules';
import { getContractById, fulfillPayOsContractOrder } from '@/land/contracts/quote-to-cash-workflow';
import { resolveOrgId } from '@/seed/auth/org-resolver';

export async function POST(request: NextRequest) {
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  const verification = await verifyPayOsRequest(request, checksumKey);
  if (!verification.ok) {
    return verification.response;
  }

  const { ipn, sanitizedBody } = verification.data;

  if (isPayOsTestPing(ipn.data)) {
    logger.info('[PayOS Webhook] Ignored PayOS test ping', {
      orderCode: ipn.data.orderCode,
      description: ipn.data.description,
    });
    return NextResponse.json({ received: true, ignored: 'test_ping' });
  }

  const db = createServerClient();
  const { orderCode, amount, paymentLinkId } = ipn.data;
  const identity = await validatePayOsPaymentIdentity({ db, orderCode, paymentLinkId, amount, currency: ipn.data.currency });
  if (!identity.ok) return NextResponse.json({ error: identity.error }, { status: identity.status });
  if (identity.order.status !== 'pending') return NextResponse.json({ received: true, duplicate: true });

  // Idempotency: INSERT-first with UNIQUE constraint check
  const idempotency = await checkAndRecordPaymentIdempotency({
    db,
    paymentLinkId,
    sanitizedBody,
  });

  if (!idempotency.shouldProcess) {
    return idempotency.response ?? NextResponse.json({ received: true });
  }

  const validation = identity;
  const { order } = identity;
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
    if (ipn.data.code !== '00') {
      await cancelPayOsPayment({ db, order, eventId: `payos_${paymentLinkId}`, lockCreatedAt: idempotency.lockCreatedAt, table: 'payment_events' });
      return NextResponse.json({ received: true });
    }
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
      if (contract.paymentRail && contract.paymentRail !== 'PAYOS') {
        throw new Error('Contract payment rail mismatch');
      }
      if (contract.status && contract.status !== 'signed' && contract.status !== 'active') {
        throw new Error('Contract is not payable in current status');
      }
      if (contract.orgId && typeof d1?.prepare === 'function') {
        const ownerOrgId = await resolveOrgId(userId, d1);
        if (!ownerOrgId || ownerOrgId !== contract.orgId) {
          throw new Error('Order owner does not belong to contract organization');
        }
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
