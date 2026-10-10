import { NextResponse, NextRequest } from 'next/server';
import { createInvoiceUrl, createCheckout, NOWPAYMENTS_TIERS } from '@/tree/clients/nowpayments-client';
import { logger } from '@/seed/utils/logger-utility';
import { getUserId } from './checkout-auth';

/**
 * GET handler for Telegram URL buttons which open in browser.
 * Reads tier from query params, builds NOWPayments invoice URL, and redirects.
 * NOTE: GET path does NOT write pending_orders (no userId guaranteed).
 */
export async function handleCheckoutGet(request: NextRequest): Promise<NextResponse> {
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
      return NextResponse.redirect(`${appUrl}/vi/pricing`);
    }

    const userId = await getUserId(request);
    if (!userId) {
      const redirectUrl = encodeURIComponent(`/api/checkout?tier=${rawTier}`);
      return NextResponse.redirect(`${appUrl}/vi/login?redirect=${redirectUrl}`);
    }
    let checkoutUrl: string;
    try {
      const result = await createCheckout({ tierId: mappedTier, userId });
      checkoutUrl = result.invoiceUrl;
    } catch (sdkErr) {
      logger.warn('[Checkout/GET] SDK checkout failed, falling back to pre-created invoice', {
        error: sdkErr instanceof Error ? sdkErr.message : String(sdkErr),
        tier: mappedTier,
      });
      checkoutUrl = createInvoiceUrl(mappedTier, userId);
    }
    return NextResponse.redirect(checkoutUrl);
  } catch {
    return NextResponse.redirect(`${appUrl}/vi/pricing`);
  }
}
