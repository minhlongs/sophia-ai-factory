import { NextResponse } from 'next/server';
import { createInvoiceUrl, createCheckout } from '@/tree/clients/nowpayments-client';
import { logger } from '@/seed/utils/logger-utility';
import { writeOrder } from '@/land/orders/pending-order-repo';
import type { Tier } from '@/seed/types';
import type { PendingOrderPeriod, PaymentMethod } from '@/land/orders/pending-order-types';
import { dispatchPayOsMethod, dispatchOfflineMethod } from './payment-dispatcher-providers';

export interface MethodDispatcherInput {
  paymentMethod: PaymentMethod;
  tier: Tier;
  userId: string;
  period: PendingOrderPeriod;
  promoCode?: string;
  customerEmail?: string;
}

async function resolveNowPaymentsInvoiceUrl(
  input: MethodDispatcherInput,
  orderId: string,
): Promise<string> {
  const { tier, userId, period, customerEmail } = input;
  const normalizedPeriod = period === 'monthly' || period === 'yearly' ? period : undefined;
  try {
    const result = await createCheckout({
      tierId: tier,
      userId,
      customerEmail,
      period: normalizedPeriod,
      orderId,
    });
    return result.invoiceUrl;
  } catch (sdkErr) {
    logger.warn('[Checkout/POST] SDK checkout failed, falling back to pre-created invoice', {
      error: sdkErr instanceof Error ? sdkErr.message : String(sdkErr),
      tier,
    });
    return createInvoiceUrl(tier, userId, customerEmail, normalizedPeriod, orderId);
  }
}

export async function dispatchPaymentMethod(input: MethodDispatcherInput): Promise<NextResponse> {
  const { paymentMethod, tier, userId, period, promoCode, customerEmail } = input;

  if (paymentMethod === 'nowpayments') {
    const orderId = `sophia_${userId}_${Date.now()}`;
    try {
      const invoiceUrl = await resolveNowPaymentsInvoiceUrl(input, orderId);
      await writeOrder({
        order_id: orderId,
        user_id: userId,
        tier,
        period: period || 'monthly',
        payment_method: 'nowpayments',
        amount_usd_cents: 0,
        promo_code: promoCode,
        customer_email: customerEmail,
        invoice_url: invoiceUrl,
      });

      return NextResponse.json({ url: invoiceUrl, orderId });
    } catch (npErr) {
      const msg = npErr instanceof Error ? npErr.message : String(npErr);
      logger.error('[Checkout/NOWPayments] Invoice creation failed', new Error(msg), { userId, tier });
      return NextResponse.json(
        { error: `NOWPayments invoice creation failed: ${msg}` },
        { status: 500 }
      );
    }
  }

  if (paymentMethod === 'payos') {
    return dispatchPayOsMethod(input);
  }

  if (paymentMethod === 'offline' || paymentMethod === 'cash') {
    return dispatchOfflineMethod(input);
  }

  return NextResponse.json({ error: `Unsupported payment method: ${paymentMethod}` }, { status: 400 });
}
