import { NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { writeOrder } from '@/land/orders/pending-order-repo';
import { createPayOsInvoice, getPayOsTierConfig } from '@/land/payments/payos';
import { isPayOsEnabled } from '@/seed/config/flags';
import { dispatchManualPilotOfflineCheckout } from './manual-pilot-offline-checkout';
import { validatePilotAgreementInput } from './manual-pilot-agreement-acceptance';
import type { MethodDispatcherInput } from './payment-dispatcher';

export async function dispatchPayOsMethod(input: MethodDispatcherInput): Promise<NextResponse> {
  const { tier, userId, period, promoCode, customerEmail } = input;
  if (period === 'pilot_14d') {
    try { if (!input.agreement) throw new Error('Pilot agreement required'); validatePilotAgreementInput(input.agreement); }
    catch (error) { return NextResponse.json({ code: 'PILOT_AGREEMENT_REQUIRED', error: error instanceof Error ? error.message : 'Pilot agreement required' }, { status: 400 }); }
    return dispatchManualPilotOfflineCheckout({ ...input, agreement: input.agreement });
  }
  const orderId = `sophia_${userId}_${Date.now()}`;
  try {
    if (!isPayOsEnabled()) return NextResponse.json({ error: 'PayOS not currently available' }, { status: 503 });
    const result = await createPayOsInvoice({ tier, period, userId, orderId, customerEmail });
    const pricing = getPayOsTierConfig(tier, period);
    await writeOrder({ order_id: orderId, user_id: userId, tier, period: period || 'monthly', payment_method: 'payos', amount_usd_cents: Math.round(pricing.usdAmount * 100), amount_vnd: pricing.vndAmount, promo_code: promoCode, customer_email: customerEmail, invoice_url: result.checkoutUrl, provider_payment_id: result.paymentLinkId, provider_order_code: result.orderCode });
    return NextResponse.json({ url: result.checkoutUrl, orderId, provider: 'payos', orderCode: result.orderCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[Checkout/PayOS] Invoice creation failed', new Error(message), { userId, tier });
    return NextResponse.json({ error: `PayOS checkout failed: ${message}` }, { status: 500 });
  }
}

export async function dispatchOfflineMethod(input: MethodDispatcherInput): Promise<NextResponse> {
  if (input.period === 'pilot_14d') {
    try { if (!input.agreement) throw new Error('Pilot agreement required'); validatePilotAgreementInput(input.agreement); }
    catch (error) { return NextResponse.json({ code: 'PILOT_AGREEMENT_REQUIRED', error: error instanceof Error ? error.message : 'Pilot agreement required' }, { status: 400 }); }
    return dispatchManualPilotOfflineCheckout({ ...input, agreement: input.agreement });
  }
  const { paymentMethod, tier, userId, period, promoCode, customerEmail } = input;
  const orderId = `sophia_${userId}_${Date.now()}`;
  try {
    await writeOrder({ order_id: orderId, user_id: userId, tier, period: period || 'monthly', payment_method: paymentMethod, amount_usd_cents: 0, promo_code: promoCode, customer_email: customerEmail, invoice_url: undefined });
    logger.info('[Checkout/Offline] Order created for manual payment', { orderId, userId, tier, paymentMethod });
  } catch (error) {
    logger.warn('[Checkout/Offline] Failed to write pending_order (non-fatal)', { orderId, error: error instanceof Error ? error.message : String(error) });
  }
  return NextResponse.json({ status: 'pending_manual_payment', orderId, message: 'Your order has been received. Our team will contact you to confirm payment. / Don hang cua ban da duoc nhan. Doi ngu se lien he xac nhan thanh toan.' });
}
