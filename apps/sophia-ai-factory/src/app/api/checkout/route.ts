import { NextResponse, NextRequest } from 'next/server';
import { createInvoiceUrl, NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client';
import { checkoutSchema } from '@/lib/schemas';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { validatePromoCode } from '@/lib/promo/promo-validator';
import { recordRedemption, incrementUsedCount } from '@/lib/promo/promo-repo';
import { logger } from '@/seed/utils/logger-utility';
import { writeOrder } from '@/lib/orders/pending-order-repo';
import { derivePeriod, assertPeriodAllowed, assertPaymentMethodAllowed } from '@/lib/checkout/checkout-validators';
import type { PendingOrderPeriod, PaymentMethod } from '@/lib/orders/pending-order-types';

/**
 * Extract user ID from Better Auth session headers.
 * Returns null if not authenticated.
 */
async function getUserId(request: Request): Promise<string | null> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) return user.id;
  } catch { /* auth failed */ }
  return null;
}

/**
 * GET handler for Telegram URL buttons which open in browser.
 * Reads tier from query params, builds NOWPayments invoice URL, and redirects.
 * NOTE: GET path does NOT write pending_orders (no userId guaranteed).
 */
export const GET = withRateLimit(async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';
  try {
    const rawTier = request.nextUrl.searchParams.get('tier')?.toUpperCase();

    const tierMap: Record<string, string> = {
      STARTER: 'BASIC', BASIC: 'BASIC',
      GROWTH: 'PREMIUM', PREMIUM: 'PREMIUM',
      PREMIUM_TIER: 'ENTERPRISE', ENTERPRISE: 'ENTERPRISE',
      MASTER: 'MASTER',
    };
    const mappedTier = rawTier ? tierMap[rawTier] : undefined;

    if (!mappedTier || !NOWPAYMENTS_TIERS[mappedTier]) {
      return NextResponse.redirect(`${appUrl}/pricing`);
    }

    const userId = await getUserId(request);
    if (!userId) {
      const redirectUrl = encodeURIComponent(`/api/checkout?tier=${rawTier}`);
      return NextResponse.redirect(`${appUrl}/login?redirect=${redirectUrl}`);
    }
    const checkoutUrl = createInvoiceUrl(mappedTier, userId);
    return NextResponse.redirect(checkoutUrl);
  } catch {
    return NextResponse.redirect(`${appUrl}/pricing`);
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });

/**
 * POST handler — returns NOWPayments invoice URL for frontend redirect.
 * Writes pending_orders row for tracking before returning URL.
 * Returns { url: string, orderId: string }
 */
export const POST = withRateLimit(async function POST(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';
  try {
    const body = await request.json();

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tier, period: rawPeriod, paymentMethod: rawMethod, promoCode, customerEmail } = parsed.data;
    const paymentMethod = (rawMethod ?? 'nowpayments') as PaymentMethod;

    // Validate payment method
    try {
      assertPaymentMethodAllowed(paymentMethod);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid payment method' },
        { status: 400 }
      );
    }

    if (!NOWPAYMENTS_TIERS[tier]) {
      return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });
    }

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Login required before checkout. Please sign in first.',
          redirectTo: `/login?next=${encodeURIComponent('/pricing')}`,
        },
        { status: 401 }
      );
    }

    // Derive and validate period
    const period = (rawPeriod ?? derivePeriod(tier)) as PendingOrderPeriod;
    try {
      assertPeriodAllowed(tier, period);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid period' },
        { status: 400 }
      );
    }

    // Reserve promo code redemption if provided
    if (promoCode) {
      try {
        const validation = await validatePromoCode(promoCode, { userId, tier });
        if (validation.valid && (validation.discountType === 'percent_off' || validation.discountType === 'fixed_off')) {
          await incrementUsedCount(validation.codeId);
          await recordRedemption({
            promoCcodeId: validation.codeId,
            promoCode,
            userId,
            appliedToTier: tier,
            discountAppliedCents: 0, // finalized on IPN
            trialDaysGranted: 0,
            status: 'reserved',
          });
          logger.info('[Checkout] Promo reserved', { promoCode, userId, tier });
        }
      } catch (err) {
        logger.warn('[Checkout] Promo reservation failed (non-fatal)', { promoCode, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Build NOWPayments invoice URL
    const invoiceUrl = createInvoiceUrl(tier, userId, customerEmail);

    // Extract order_id from the URL (embedded by createInvoiceUrl)
    const urlObj = new URL(invoiceUrl);
    const orderId = urlObj.searchParams.get('order_id') ?? `sophia_${userId}_${Date.now()}`;

    const amountUsdCents = Math.round((NOWPAYMENTS_TIERS[tier].price ?? 0) * 100);

    // Write pending order — fail gracefully if D1 write fails (do not block checkout)
    try {
      await writeOrder({
        order_id: orderId,
        user_id: userId,
        tier,
        period,
        payment_method: paymentMethod,
        amount_usd_cents: amountUsdCents,
        promo_code: promoCode,
        customer_email: customerEmail,
        invoice_url: invoiceUrl,
      });
    } catch (dbErr) {
      // Non-fatal: log metric but still return checkout URL
      logger.warn('[Checkout] Failed to write pending_order (non-fatal)', {
        orderId,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }

    return NextResponse.json({ url: invoiceUrl, orderId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Checkout] Unexpected error', new Error(errorMessage), {});
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });
