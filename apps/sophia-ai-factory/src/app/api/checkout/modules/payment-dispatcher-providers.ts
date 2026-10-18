import { NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { writeOrder } from '@/land/orders/pending-order-repo';
import { createPayOsInvoice, getPayOsTierConfig } from '@/land/payments/payos';
import type { MethodDispatcherInput } from './payment-dispatcher';

export async function dispatchPayOsMethod(input: MethodDispatcherInput): Promise<NextResponse> {
  const { tier, userId, period, promoCode, customerEmail } = input;
  const orderId = `sophia_${userId}_${Date.now()}`;
  try {
    const payOsResult = await createPayOsInvoice({
      tier,
      period,
      userId,
      orderId,
      customerEmail,
    });
    const pricing = getPayOsTierConfig(tier, period);
    await writeOrder({
      order_id: orderId,
      user_id: userId,
      tier,
      period: period || 'monthly',
      payment_method: 'payos',
      amount_usd_cents: Math.round(pricing.usdAmount * 100),
      amount_vnd: pricing.vndAmount,
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

export async function dispatchOfflineMethod(input: MethodDispatcherInput): Promise<NextResponse> {
  const { paymentMethod, tier, userId, period, promoCode, customerEmail } = input;
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
