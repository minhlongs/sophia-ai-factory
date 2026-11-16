import { NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import {
  PAID_PILOT_14_DAY_PRICE_CENTS,
  PAID_PILOT_14_DAY_PRICE_VND,
} from '@/tree/finance/pilot-unit-economics-types';
import { writeOrder } from '@/land/orders/pending-order-repo';
import { createPayOsInvoice, getPayOsTierConfig } from '@/land/payments/payos';
import { isPayOsEnabled } from '@/seed/config/flags';
import type { MethodDispatcherInput } from './payment-dispatcher';

export async function dispatchPayOsMethod(input: MethodDispatcherInput): Promise<NextResponse> {
  const { tier, userId, period, promoCode, customerEmail } = input;
  if (period === 'pilot_14d' && tier !== 'BASIC') {
    return NextResponse.json(
      { error: '14-day Paid Pilot billing is only available for BASIC tier' },
      { status: 400 },
    );
  }

  const payosActive = isPayOsEnabled();
  const orderId = `sophia_${userId}_${Date.now()}`;
  try {
    if (!payosActive) {
      if (period !== 'pilot_14d') {
        return NextResponse.json(
          { error: 'PayOS not currently available' },
          { status: 503 },
        );
      }
      await writeOrder({
        order_id: orderId,
        user_id: userId,
        tier: 'BASIC',
        period: 'pilot_14d',
        payment_method: 'offline',
        amount_usd_cents: PAID_PILOT_14_DAY_PRICE_CENTS,
        amount_vnd: PAID_PILOT_14_DAY_PRICE_VND,
        promo_code: promoCode,
        customer_email: customerEmail,
      });
      logger.info('[Checkout/PayOS] Created offline fallback order for 14-day Paid Pilot', {
        orderId,
        userId,
      });
      return NextResponse.json({
        status: 'pending_manual_payment',
        orderId,
        provider: 'offline_pilot_fallback',
        amountVnd: PAID_PILOT_14_DAY_PRICE_VND,
        amountUsd: PAID_PILOT_14_DAY_PRICE_CENTS / 100,
      });
    }

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
      provider_order_code: payOsResult.orderCode,
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
