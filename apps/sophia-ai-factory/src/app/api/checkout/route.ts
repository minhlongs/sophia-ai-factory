import { NextResponse, NextRequest } from 'next/server';
import { createInvoiceUrl, NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { checkoutSchema } from '@/lib/schemas';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { recordRedemption, incrementUsedCount } from '@/land/promo/promo-repo';
import { calculateDiscount } from '@/land/promo/promo-discount-calculator';
import { setUserTrialExpiry } from '@/land/promo/promo-repo';
import { logger } from '@/seed/utils/logger-utility';
import { writeOrder, findActivePendingOrder } from '@/land/orders/pending-order-repo';
import { derivePeriod, assertPeriodAllowed, assertPaymentMethodAllowed } from '@/land/checkout/checkout-validators';
import type { PendingOrderPeriod, PaymentMethod } from '@/land/orders/pending-order-types';
import { createPayOsInvoice } from '@/land/payments/payos';
import { track } from '@/lib/signals/track';
import { D1Events } from '@/lib/signals/d1-event-types';

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

    // Dedupe: reuse an active pending order created within last 30 min
    // for the same (user, tier, period, paymentMethod) to prevent double-pay
    // on rapid checkout clicks. NOWPayments invoice URLs remain valid for
    // hours so reusing one is safer than minting a new charge.
    try {
      const existing = await findActivePendingOrder({
        userId,
        tier,
        period,
        paymentMethod,
        sinceMs: 30 * 60 * 1000,
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

    // Reserve promo code redemption if provided — calculate actual discount
    let promoDiscountCents = 0;
    let promoTrialDays = 0;
    if (promoCode) {
      try {
        const validation = await validatePromoCode(promoCode, { userId, tier });
        if (validation.valid) {
          const tierConfig = UNIFIED_TIERS[tier as import('@/seed/types').Tier];
          const baseCents = tierConfig ? tierConfig.price * 100 : 0;
          const calc = calculateDiscount({
            discountType: validation.discountType,
            discountValue: validation.discountValue,
            originalAmountCents: baseCents,
          });
          promoDiscountCents = calc.discountCents;
          promoTrialDays = calc.trialDays;

          await incrementUsedCount(validation.codeId);
          await recordRedemption({
            promoCcodeId: validation.codeId,
            promoCode,
            userId,
            appliedToTier: tier,
            discountAppliedCents: promoDiscountCents,
            trialDaysGranted: promoTrialDays,
            status: 'reserved',
          });

          // Grant trial period immediately for free_trial codes
          if (validation.discountType === 'free_trial' && promoTrialDays > 0) {
            const trialEndsAt = Math.floor(Date.now() / 1000) + promoTrialDays * 86400;
            await setUserTrialExpiry(userId, trialEndsAt);
          }

          logger.info('[Checkout] Promo reserved', {
            promoCode, userId, tier,
            discountCents: promoDiscountCents,
            trialDays: promoTrialDays,
            discountType: validation.discountType,
          });
        }
      } catch (err) {
        logger.warn('[Checkout] Promo reservation failed (non-fatal)', { promoCode, error: err instanceof Error ? err.message : String(err) });
      }
    }

    // ── PayOS path (VND bank transfer for VN users) ───────────────────────────
    if (paymentMethod === 'payos') {
      const orderId = `sophia_${userId}_${Date.now()}`;
      try {
        const payOsResult = await createPayOsInvoice({
          tier: tier as import('@/seed/types').Tier,
          // PayOS does not support yearly billing yet — treat yearly as monthly for VND checkout.
          // TODO(phase-07): add yearly PayOS support when PayOS invoice IDs are available.
          period: (period === 'yearly' ? 'monthly' : period) as 'monthly' | 'lifetime',
          userId,
          orderId,
          customerEmail,
        });

        // Write pending order (non-fatal)
        try {
          await writeOrder({
            order_id: orderId,
            user_id: userId,
            tier,
            period,
            payment_method: 'payos',
            amount_usd_cents: 0, // VND payment — USD amount not relevant
            promo_code: promoCode,
            customer_email: customerEmail,
            invoice_url: payOsResult.checkoutUrl,
          });
        } catch (dbErr) {
          logger.warn('[Checkout/PayOS] Failed to write pending_order (non-fatal)', {
            orderId,
            error: dbErr instanceof Error ? dbErr.message : String(dbErr),
          });
        }

        return NextResponse.json({ url: payOsResult.checkoutUrl, orderId });
      } catch (payOsErr) {
        const msg = payOsErr instanceof Error ? payOsErr.message : String(payOsErr);
        logger.error('[Checkout/PayOS] Failed to create PayOS invoice', new Error(msg), { userId, tier });
        return NextResponse.json({ error: `PayOS checkout failed: ${msg}` }, { status: 500 });
      }
    }

    // ── NOWPayments path (default — USDT crypto) ──────────────────────────────

    // Resolve amount: yearly invoices use yearlyPrice from unified config.
    // TODO(phase-07): NOWPayments does not yet have dedicated yearly invoice IDs.
    // For now, createInvoiceUrl uses the monthly invoice ID (which sets the description)
    // but we override amountUsdCents below so the actual charge reflects the annual price.
    // When NOWPayments yearly invoice IDs are configured in nowpayments-client.ts,
    // pass `period` to createInvoiceUrl and remove this override.
    const invoiceUrl = createInvoiceUrl(tier, userId, customerEmail);

    // Extract order_id from the URL (embedded by createInvoiceUrl)
    const urlObj = new URL(invoiceUrl);
    const orderId = urlObj.searchParams.get('order_id') ?? `sophia_${userId}_${Date.now()}`;

    // Use yearlyPrice for annual billing; fall back to monthly price from NOWPAYMENTS_TIERS
    const tierConfig = UNIFIED_TIERS[tier as import('@/seed/types').Tier];
    const amountUsdCents: number = (() => {
      if (period === 'yearly' && tierConfig && tierConfig.yearlyPrice > 0) {
        return tierConfig.yearlyPrice * 100;
      }
      return Math.round((NOWPAYMENTS_TIERS[tier].price ?? 0) * 100);
    })();

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

    // Fire-and-forget D1 signal for funnel analytics — non-blocking
    track(D1Events.CHECKOUT_STARTED, userId, {
      tier,
      period,
      payment_method: paymentMethod,
      order_id: orderId,
      has_promo: Boolean(promoCode),
    });

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
