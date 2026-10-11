import { NextResponse } from 'next/server';
import { processTopupIpn } from '@/land/billing/overage-topup';
import { confirmCommercePayment } from '@/land/commerce/commerce-payment';
import { lookupInvoice } from '@/tree/clients/nowpayments-client';
import { captureTierUpgraded } from '@/tree/signals/posthog-capture';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { emit } from '@/land/webhooks/emitter';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getD1 } from '@/seed/db/client';
import { writeDeadLetterToR2, generateDeadLetterKey } from '@/seed/r2/bucket-ops';
import { logger } from '@/seed/utils/logger-utility';
import type { IpnPayload } from './types';

export async function routeCommerceIpn(ipn: IpnPayload): Promise<NextResponse | null> {
  if (!ipn.order_id || (ipn.payment_status !== 'confirmed' && ipn.payment_status !== 'finished')) {
    return null;
  }

  const commerceResult = await confirmCommercePayment({
    orderId: ipn.order_id,
    paymentId: ipn.payment_id,
    paymentStatus: ipn.payment_status,
    paidAmount: ipn.actually_paid,
    paidCurrency: ipn.pay_currency,
  });

  if (commerceResult.ok) {
    return NextResponse.json({ received: true, commerce: true });
  }

  if (commerceResult.error.code === 'ORDER_NOT_FOUND') {
    return null;
  }

  logger.error('[NOWPayments Webhook] Commerce IPN processing failed', new Error(commerceResult.error.message), {
    payment_id: ipn.payment_id,
    payment_status: ipn.payment_status,
    order_id: ipn.order_id,
  });
  return NextResponse.json({ error: commerceResult.error.message }, { status: 500 });
}

export async function processTopupIfApplicable(ipn: IpnPayload): Promise<NextResponse | null> {
  if (!ipn.order_id?.startsWith('topup_')) {
    return null;
  }

  const topupResult = await processTopupIpn({
    payment_id: ipn.payment_id,
    payment_status: ipn.payment_status,
    order_id: ipn.order_id,
    price_amount: ipn.price_amount,
    price_currency: ipn.price_currency,
  });

  if (!topupResult.success) {
    logger.error('[NOWPayments Webhook] Top-up IPN processing failed', new Error(topupResult.message), {
      payment_id: ipn.payment_id,
      payment_status: ipn.payment_status,
      order_id: ipn.order_id,
    });
    return NextResponse.json({ error: topupResult.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

export async function handlePostPaymentSideEffects(ipn: IpnPayload): Promise<void> {
  if (ipn.payment_status !== 'finished' || !ipn.order_id) {
    return;
  }

  const userId = ipn.order_id.split('_')[1] ?? ipn.order_id;
  const tierLookup = ipn.invoice_id ? lookupInvoice(ipn.invoice_id) : null;
  const tierName = tierLookup?.kind === 'subscription' ? tierLookup.tier : 'unknown';

  void captureTierUpgraded({
    distinctId: userId,
    tier: tierName,
    amount: ipn.price_amount,
    currency: ipn.price_currency,
  }).catch((e) => logger.warn('[NOWPayments Webhook] captureTierUpgraded failed', { error: String(e) }));

  track(D1Events.PAYMENT_SUCCESS, 'webhook', {
    amount_usd: ipn.price_amount,
    currency: ipn.price_currency,
    provider: 'nowpayments',
    payment_id: ipn.payment_id,
  }, userId);

  let fromTier = 'unknown';
  try {
    const d1Check = await getD1();
    if (!d1Check) {
      await writeDeadLetterToR2(generateDeadLetterKey('nowpayments', `resolve_tier_${ipn.payment_id}`), {
        webhookType: 'nowpayments',
        operation: 'resolveUserTier',
        timestamp: new Date().toISOString(),
        payload: ipn,
        error: 'D1 binding unavailable',
        userId,
      });
      logger.warn('[NOWPayments Webhook] D1 unavailable — resolveUserTier skipped, dead-letter written', {
        paymentId: ipn.payment_id,
      });
    } else {
      fromTier = await resolveUserTier(userId);
    }
  } catch (tierErr) {
    logger.warn('[NOWPayments Webhook] resolveUserTier failed, using fallback', tierErr instanceof Error ? tierErr : new Error(String(tierErr)));
  }

  track(D1Events.TIER_CONVERSION, userId, {
    from_tier: fromTier,
    to_tier: tierName,
    amount_usd: ipn.price_amount,
    provider: 'nowpayments',
  }, userId);

  const db = await getD1();
  if (db) {
    emit({ DB: db }, 'payment.received', {
      tenantId: userId,
      amountUsd: ipn.price_amount,
      tier: tierName,
      paymentId: ipn.payment_id,
      paidAt: new Date().toISOString(),
    }, userId);
  } else {
    await writeDeadLetterToR2(generateDeadLetterKey('nowpayments', `emit_${ipn.payment_id}`), {
      webhookType: 'nowpayments',
      operation: 'emit_payment_received',
      timestamp: new Date().toISOString(),
      payload: {
        tenantId: userId,
        amountUsd: ipn.price_amount,
        tier: tierName,
        paymentId: ipn.payment_id,
        paidAt: new Date().toISOString(),
      },
      error: 'D1 binding unavailable',
      userId,
    });
    logger.warn('[NOWPayments Webhook] D1 unavailable — emit skipped, dead-letter written', {
      paymentId: ipn.payment_id,
    });
  }
}
