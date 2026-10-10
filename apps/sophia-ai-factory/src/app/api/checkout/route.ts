import { NextResponse, NextRequest } from 'next/server';
import { NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client';
import { checkoutSchema } from '@/land/schemas';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { logger } from '@/seed/utils/logger-utility';
import { findActivePendingOrder } from '@/land/orders/pending-order-repo';
import { derivePeriod, assertPeriodAllowed } from '@/land/checkout/checkout-validators';
import type { Tier } from '@/seed/types';
import type { PendingOrderPeriod, PaymentMethod } from '@/land/orders/pending-order-types';
import { verifyCsrfToken } from '@/seed/security/csrf';
import {
  getUserId,
  handleCheckoutGet,
  processPromoReservation,
  executeFreeOrderHandover,
  dispatchPaymentMethod,
} from './modules';

export const GET = withRateLimit(handleCheckoutGet, {
  addHeaders: true,
  config: { intervalMs: 60000, maxRequests: 10 },
});

export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tier: rawTier, period: rawPeriod, paymentMethod: rawMethod, promoCode, customerEmail } = parsed.data;
    const paymentMethod = (rawMethod ?? 'nowpayments') as PaymentMethod;
    const tier = rawTier as Tier;

    if (!NOWPAYMENTS_TIERS[tier]) {
      return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });
    }

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Login required before checkout. Please sign in first.',
          redirectTo: `/vi/login?next=${encodeURIComponent('/vi/pricing')}`,
        },
        { status: 401 }
      );
    }

    if (!verifyCsrfToken(request)) {
      return NextResponse.json({ error: 'CSRF token missing or invalid' }, { status: 403 });
    }

    const period = (rawPeriod ?? derivePeriod(tier)) as PendingOrderPeriod;
    try {
      assertPeriodAllowed(tier, period);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid period' },
        { status: 400 }
      );
    }

    try {
      const existing = await findActivePendingOrder({
        userId,
        tier,
        period,
        paymentMethod,
        sinceMs: 24 * 60 * 60 * 1000,
      });
      if (existing?.invoice_url) {
        logger.info('[Checkout] Reusing active pending order', {
          orderId: existing.order_id,
          userId,
          tier,
        });
        return NextResponse.json({
          url: existing.invoice_url,
          orderId: existing.order_id,
          deduped: true,
        });
      }
    } catch (err) {
      logger.warn('[Checkout] Dedupe lookup failed (non-fatal)', {
        userId,
        tier,
        error: err instanceof Error ? err.message : String(err),
      });
    }

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

    return await dispatchPaymentMethod({
      paymentMethod,
      tier,
      userId,
      period,
      promoCode,
      customerEmail,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Checkout] Unexpected error', new Error(errorMessage), {});
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });
