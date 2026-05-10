/**
 * GET /api/affiliate/promo-assets
 *
 * Returns the affiliate promo library filtered to caller's tier.
 * Optional `?locale=en|vi` filters copy templates + outreach scripts.
 *
 * Tier resolved server-side via `getUserTier(user.id)`.
 *
 * @module app/api/affiliate/promo-assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { listPromoAssetsForTier, type PromoLocale, type PromoTier } from '@/land/affiliates/promo-library';
import { logger } from '@/seed/utils/logger-utility';

const VALID_TIERS: ReadonlyArray<PromoTier> = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

function normaliseTier(tier: string | null | undefined): PromoTier {
  if (!tier) return 'BASIC';
  const upper = tier.toUpperCase() as PromoTier;
  return VALID_TIERS.includes(upper) ? upper : 'BASIC';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tier: PromoTier;
  try {
    const raw = await getUserTier(user.id);
    tier = normaliseTier(typeof raw === 'string' ? raw : null);
  } catch (err) {
    logger.warn('[promo-assets] getUserTier failed', { userId: user.id, error: String(err) });
    return NextResponse.json({ error: 'Failed to resolve tier' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get('locale');
  const locale: PromoLocale | undefined =
    localeParam === 'en' || localeParam === 'vi' ? localeParam : undefined;

  const library = listPromoAssetsForTier(tier, locale);
  return NextResponse.json({ tier, locale: locale ?? null, ...library });
}
