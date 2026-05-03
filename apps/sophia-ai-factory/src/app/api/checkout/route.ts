import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { createInvoiceUrl, NOWPAYMENTS_TIERS } from '@/lib/clients/nowpayments-client';
import { checkoutSchema } from '@/lib/schemas';
import { withRateLimit } from '@/middleware/rate-limit-wrapper';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';

/**
 * Extract user ID from Better Auth session headers.
 * Returns null if not authenticated — checkout requires login.
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

const checkoutWithEmailSchema = z.object({
  tier: z.string(),
  customerEmail: z.string().email().optional(),
});

// POST handler — returns NOWPayments invoice URL for frontend redirect
export const POST = withRateLimit(async function POST(request: Request) {
  try {
    const body = await request.json();

    const baseValidation = checkoutSchema.safeParse(body);
    if (!baseValidation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: baseValidation.error.flatten() },
        { status: 400 }
      );
    }

    const emailParsed = checkoutWithEmailSchema.safeParse(body);
    const customerEmail = emailParsed.success ? emailParsed.data.customerEmail : undefined;

    const { tier } = baseValidation.data;

    if (!NOWPAYMENTS_TIERS[tier]) {
      return NextResponse.json(
        { error: `Unknown tier: ${tier}` },
        { status: 400 }
      );
    }

    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Login required before checkout. Please sign in first.' },
        { status: 401 }
      );
    }
    const checkoutUrl = createInvoiceUrl(tier, userId, customerEmail);

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });
