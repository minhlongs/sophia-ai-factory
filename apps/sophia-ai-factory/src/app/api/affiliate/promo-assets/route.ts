/**
 * GET /api/affiliate/promo-assets
 *
 * Returns the affiliate promo library filtered to caller's tier.
 * Optional `?locale=en|vi` filters copy templates + outreach scripts.
 *
 * Tier resolved server-side via `resolveUserTier(user.id)`.
 *
 * @module app/api/affiliate/promo-assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { listPromoAssetsForTier, type PromoLocale, type PromoNiche, type PromoTier } from '@/land/affiliates/promo-library';
import { logger } from '@/seed/utils/logger-utility';

const VALID_TIERS: ReadonlyArray<PromoTier> = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
const VALID_NICHES: ReadonlyArray<PromoNiche> = ['creators', 'agency', 'coaches', 'dropshippers', 'universal', 'sop_marketplace'];

function normaliseNiche(niche: string | null | undefined): PromoNiche | undefined {
  if (!niche) return undefined;
  const lower = niche.toLowerCase() as PromoNiche;
  return VALID_NICHES.includes(lower) ? lower : undefined;
}

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
    const raw = await resolveUserTier(user.id);
    tier = normaliseTier(typeof raw === 'string' ? raw : null);
  } catch (err) {
    logger.warn('[promo-assets] getUserTier failed', { userId: user.id, error: String(err) });
    return NextResponse.json({ error: 'Failed to resolve tier' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const localeParam = searchParams.get('locale');
  const locale: PromoLocale | undefined =
    localeParam === 'en' || localeParam === 'vi' ? localeParam : undefined;

  const niche = normaliseNiche(searchParams.get('niche'));

  const library = listPromoAssetsForTier(tier, locale, niche);
  return NextResponse.json({ tier, locale: locale ?? null, niche: niche ?? null, ...library });
}
