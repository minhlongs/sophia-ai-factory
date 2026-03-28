import { NextResponse, NextRequest } from 'next/server';
import { createInvoiceUrl, NOWPAYMENTS_TIERS } from '@/lib/clients/nowpayments-client';
import { checkoutSchema } from '@/lib/schemas';
import { withRateLimit } from '@/middleware/rate-limit-wrapper';
import { getCurrentUser } from '@/lib/db/auth';

/**
 * Extract user ID from JWT cookie (D1 auth), fallback to guest ID.
 */
async function getUserId(request: Request): Promise<string> {
  try {
    const cookie = request.headers.get('cookie') ?? '';
    const user = await getCurrentUser(cookie);
    if (user?.id) return user.id;
  } catch { /* ignore — guest checkout */ }
  return `guest-${Date.now()}`;
}

/**
 * GET handler for Telegram URL buttons which open in browser.
 * Reads tier from query params, builds NOWPayments invoice URL, and redirects.
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
    const checkoutUrl = createInvoiceUrl(mappedTier, userId);
    return NextResponse.redirect(checkoutUrl);
  } catch {
    return NextResponse.redirect(`${appUrl}/pricing`);
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });

// POST handler — returns NOWPayments invoice URL for frontend redirect
export const POST = withRateLimit(async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = checkoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { tier } = validation.data;

    if (!NOWPAYMENTS_TIERS[tier]) {
      return NextResponse.json(
        { error: `Unknown tier: ${tier}` },
        { status: 400 }
      );
    }

    const userId = await getUserId(request);
    const checkoutUrl = createInvoiceUrl(tier, userId);

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });
