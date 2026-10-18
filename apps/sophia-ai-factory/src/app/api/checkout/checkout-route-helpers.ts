import { NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { findActivePendingOrder } from '@/land/orders/pending-order-repo';
import type { Tier } from '@/seed/types';
import type { PendingOrderPeriod, PaymentMethod } from '@/land/orders/pending-order-types';
import {
  processPromoReservation,
  executeFreeOrderHandover,
} from './modules';

export async function tryReusePendingOrder(params: {
  userId: string;
  tier: Tier;
  period: PendingOrderPeriod;
  paymentMethod: PaymentMethod;
}): Promise<NextResponse | null> {
  try {
    const existing = await findActivePendingOrder({
      ...params,
      sinceMs: 24 * 60 * 60 * 1000,
    });
    if (existing?.invoice_url) {
      logger.info('[Checkout] Reusing active pending order', {
        orderId: existing.order_id,
        userId: params.userId,
        tier: params.tier,
      });
      return NextResponse.json({
        url: existing.invoice_url,
        orderId: existing.order_id,
        deduped: true,
      });
    }
  } catch (err) {
    logger.warn('[Checkout] Dedupe lookup failed (non-fatal)', {
      userId: params.userId,
      tier: params.tier,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

export async function tryHandleFreePromoOrder(params: {
  userId: string;
  tier: Tier;
  period: PendingOrderPeriod;
  promoCode?: string;
  customerEmail?: string;
}): Promise<NextResponse | null> {
  const { userId, tier, period, promoCode, customerEmail } = params;
  const { promoDiscountCents, promoTrialDays, calc, validation } = await processPromoReservation({
    promoCode,
    userId,
    tier,
  });

  if (promoCode && validation?.valid && calc.isFreeOrder && validation.discountType === 'free_full') {
    try {
      const freeResult = await executeFreeOrderHandover({
        userId,
        tier,
        period,
        promoCode,
        customerEmail,
        validation,
        promoDiscountCents,
        promoTrialDays,
      });
      return NextResponse.json({
        status: 'free_order_completed',
        orderId: freeResult.freeOrderId,
        handoverId: freeResult.handoverId,
        magicLink: freeResult.magicLink,
      });
    } catch (freeErr) {
      const msg = freeErr instanceof Error ? freeErr.message : String(freeErr);
      logger.error('[Checkout/FREE] Handover failed', new Error(msg), { userId, tier, promoCode });
      return NextResponse.json(
        { error: `FREE order activation failed: ${msg}` },
        { status: 500 }
      );
    }
  }

  return null;
}
