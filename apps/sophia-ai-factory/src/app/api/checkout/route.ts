import { NextResponse, NextRequest } from 'next/server';
import { NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client';
import { checkoutSchema } from '@/land/schemas';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { logger } from '@/seed/utils/logger-utility';
import { derivePeriod, assertPeriodAllowed } from '@/land/checkout/checkout-validators';
import type { Tier } from '@/seed/types';
import type { PendingOrderPeriod, PaymentMethod } from '@/land/orders/pending-order-types';
import { verifyCsrfToken } from '@/seed/security/csrf';
import {
  getUserId,
  handleCheckoutGet,
  dispatchPaymentMethod,
} from './modules';
import {
  tryReusePendingOrder,
  tryHandleFreePromoOrder,
} from './checkout-route-helpers';

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

    const dedupedResponse = await tryReusePendingOrder({
      userId,
      tier,
      period,
      paymentMethod,
    });
    if (dedupedResponse) return dedupedResponse;

    const freeOrderResponse = await tryHandleFreePromoOrder({
      userId,
      tier,
      period,
      promoCode,
      customerEmail,
    });
    if (freeOrderResponse) return freeOrderResponse;

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
