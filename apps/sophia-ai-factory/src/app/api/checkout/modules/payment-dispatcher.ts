import { NextResponse } from 'next/server';
import { createInvoiceUrl, createCheckout } from '@/tree/clients/nowpayments-client';
import { logger } from '@/seed/utils/logger-utility';
import { writeOrder } from '@/land/orders/pending-order-repo';
import { createPayOsInvoice } from '@/land/payments/payos';
import type { Tier } from '@/seed/types';
import type { PendingOrderPeriod, PaymentMethod } from '@/land/orders/pending-order-types';

export interface MethodDispatcherInput {
  paymentMethod: PaymentMethod;
  tier: Tier;
  userId: string;
  period: PendingOrderPeriod;
  promoCode?: string;
  customerEmail?: string;
}

export async function dispatchPaymentMethod(input: MethodDispatcherInput): Promise<NextResponse> {
  const { paymentMethod, tier, userId, period, promoCode, customerEmail } = input;

  if (paymentMethod === 'nowpayments') {
    const orderId = `sophia_${userId}_${Date.now()}`;
    try {
      let invoiceUrl: string;
      try {
        const result = await createCheckout({
          tierId: tier,
          userId,
          customerEmail,
          period: period === 'monthly' || period === 'yearly' ? period : undefined,
          orderId,
        });
        invoiceUrl = result.invoiceUrl;
      } catch (sdkErr) {
        logger.warn('[Checkout/POST] SDK checkout failed, falling back to pre-created invoice', {
          error: sdkErr instanceof Error ? sdkErr.message : String(sdkErr),
          tier,
        });
        invoiceUrl = createInvoiceUrl(
          tier,
          userId,
          customerEmail,
          period === 'monthly' || period === 'yearly' ? period : undefined,
          orderId,
        );
      }
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
    const orderId = `sophia_${userId}_${Date.now()}`;
    try {
      const payOsResult = await createPayOsInvoice({
        tier,
        period: period as 'monthly' | 'lifetime',
        userId,
        orderId,
        customerEmail,
      });
      await writeOrder({
        order_id: orderId,
        user_id: userId,
        tier,
        period: period || 'monthly',
        payment_method: 'payos',
        amount_usd_cents: 0,
        promo_code: promoCode,
        customer_email: customerEmail,
        invoice_url: payOsResult.checkoutUrl,
        provider_payment_id: payOsResult.paymentLinkId,
      });

      return NextResponse.json({
        url: payOsResult.checkoutUrl,
        orderId,
        provider: 'payos',
        orderCode: payOsResult.orderCode,
      });
    } catch (payosErr) {
      const msg = payosErr instanceof Error ? payosErr.message : String(payosErr);
      logger.error('[Checkout/PayOS] Invoice creation failed', new Error(msg), { userId, tier });
      return NextResponse.json(
        { error: `PayOS checkout failed: ${msg}` },
        { status: 500 }
      );
    }
  }

  if (paymentMethod === 'offline' || paymentMethod === 'cash') {
    const orderId = `sophia_${userId}_${Date.now()}`;
    try {
      await writeOrder({
        order_id: orderId,
        user_id: userId,
        tier,
        period: period || 'monthly',
        payment_method: paymentMethod,
        amount_usd_cents: 0,
        promo_code: promoCode,
        customer_email: customerEmail,
        invoice_url: undefined,
      });
      logger.info('[Checkout/Offline] Order created for manual payment', { orderId, userId, tier, paymentMethod });
    } catch (dbErr) {
      logger.warn('[Checkout/Offline] Failed to write pending_order (non-fatal)', {
        orderId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }

    return NextResponse.json({
      status: 'pending_manual_payment',
      orderId,
      message:
        'Your order has been received. Our team will contact you to confirm payment. / Don hang cua ban da duoc nhan. Doi ngu se lien he xac nhan thanh toan.',
    });
  }

  return NextResponse.json({ error: `Unsupported payment method: ${paymentMethod}` }, { status: 400 });
}
