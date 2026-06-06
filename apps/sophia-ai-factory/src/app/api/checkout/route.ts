import { NextResponse, NextRequest } from 'next/server';
import { createInvoiceUrl, NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { checkoutSchema } from '@/land/schemas';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { getCurrentUserFromHeaders, AuthSystemError } from '@/seed/auth/better-auth-session';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { recordRedemption } from '@/land/promo/promo-repo';
import { calculateDiscount } from '@/land/promo/promo-discount-calculator';
import { logger } from '@/seed/utils/logger-utility';
import { writeOrder, findActivePendingOrder } from '@/land/orders/pending-order-repo';
import { derivePeriod, assertPeriodAllowed, assertPaymentMethodAllowed } from '@/land/checkout/checkout-validators';
import type { PendingOrderPeriod, PaymentMethod } from '@/land/orders/pending-order-types';
import { createPayOsInvoice } from '@/land/payments/payos';
import { track } from '@/land/signals/track';
import { D1Events } from '@/land/signals/d1-event-types';

/**
 * Extract user ID from Better Auth session headers.
 * Returns null if not authenticated.
 */
async function getUserId(request: Request): Promise<string | null> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (user?.id) return user.id;
  } catch (err) {
    if (err instanceof AuthSystemError) throw err;
  }
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
// @ts-ignore
export const POST = withRateLimit(async function POST(request: NextRequest) {
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

    // Dedupe: reuse an active pending order created within last 24h
    // for the same (user, tier, period, paymentMethod) to prevent double-pay.
    // 24h window matches NOWPayments invoice TTL — prevents user paying twice
    // if they abandon and return within the same billing day.
    // (Previously 30 min — too short; invoices stay payable for hours.)
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

          // NOTE: incrementUsedCount is intentionally NOT called here.
          // Calling it before payment confirmation causes TOCTOU: abandoned checkouts
          // permanently consume promo quota. Usage is incremented in the IPN handler
          // (nowpayments-ipn-subscription.ts handleFinished) after payment is confirmed.
          // Reserved redemptions older than 2h should be cleaned up by a cron job.
          await recordRedemption({
            promoCcodeId: validation.codeId,
            promoCode,
            userId,
            appliedToTier: tier,
            discountAppliedCents: promoDiscountCents,
            trialDaysGranted: promoTrialDays,
            status: 'reserved',
          });

          // NOTE: Trial grant deferred to IPN handler (after payment confirmed).
          // Previously granted here, but that allowed exploit: enter promo → get
          // trial → abandon checkout → enjoy free access. The redemption row with
          // status='reserved' + trialDaysGranted is enough for IPN to grant later.

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

    // ── NOWPayments path (crypto, default) ───────────────────────────────────
        if (paymentMethod === 'nowpayments') {
          const orderId = `sophia_${userId}_${Date.now()}`;
          try {
            const invoiceUrl = createInvoiceUrl(tier, userId);
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
            logger.error('[Checkout/NOWPayments] Failed to create invoice', new Error(msg), { userId, tier });
            return NextResponse.json({ error: `NOWPayments checkout failed: ${msg}` }, { status: 500 });
          }
        } // ── PayOS path (VND bank transfer for VN users) ───────────────────────────
    if (paymentMethod === 'payos') {
      // PayOS does not support yearly billing — reject explicitly instead of silent fallback.
      // When PayOS adds yearly support, remove this guard and pass period directly.
      if (period === 'yearly') {
        return NextResponse.json(
          { error: 'PayOS does not support yearly billing. Please choose monthly or use NOWPayments (USDT) for annual plans. / PayOS không hỗ trợ thanh toán theo năm. Vui lòng chọn hàng tháng hoặc dùng NOWPayments (USDT) cho gói năm.' },
          { status: 400 }
        );
      }
      const orderId = `sophia_${userId}_${Date.now()}`;
      try {
        const payOsResult = await createPayOsInvoice({
          tier: tier as import('@/seed/types').Tier,
          period: period as 'monthly' | 'lifetime',
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
// ── Offline / cash payment path (first customer or manual bank transfer) ────
if (paymentMethod === 'offline' || paymentMethod === 'cash') {
  const orderId = `sophia_${userId}_${Date.now()}`;
  try {
    await writeOrder({
      order_id: orderId,
      user_id: userId,
      tier,
      period,
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
    message: 'Your order has been received. Our team will contact you to confirm payment. / Don hang cua ban da duoc nhan. Doi ngu se lien he xac nhan thanh toan.',
  });
}

} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error('[Checkout] Unexpected error', new Error(errorMessage), {});
  return NextResponse.json(
    { error: `Failed to create checkout session: ${errorMessage}` },
    { status: 500 }
  );
}
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });


