import { NextResponse } from 'next/server';
import { processTopupIpn } from '@/land/billing/overage-topup';
import { confirmCommercePayment } from '@/land/commerce/commerce-payment';
import { logger } from '@/seed/utils/logger-utility';
import type { IpnPayload } from './types';

export { handlePostPaymentSideEffects } from './post-payment-side-effects';

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
    invoice_id: ipn.invoice_id,
    pay_amount: ipn.pay_amount,
    pay_currency: ipn.pay_currency,
    actually_paid: ipn.actually_paid,
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
