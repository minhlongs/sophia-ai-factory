import type {
  PromoTier,
  PromoLocale,
  PromoNiche,
  PromoLibraryFiltered,
  BannerSpec,
} from './types';
import { TIER_RANK } from './types';
import {
  COPY_TEMPLATES,
  OUTREACH_SCRIPTS,
} from './asset-search';

export const BANNER_SPECS: readonly BannerSpec[] = [
  {
    id: 'banner-leaderboard',
    size: '728x90',
    format: 'png',
    assetPath: null,
    minTier: 'BASIC',
  },
  {
    id: 'banner-mediumrect',
    size: '300x250',
    format: 'png',
    assetPath: null,
    minTier: 'BASIC',
  },
  {
    id: 'banner-skyscraper',
    size: '160x600',
    format: 'png',
    assetPath: null,
    minTier: 'PREMIUM',
  },
  {
    id: 'banner-mobile',
    size: '320x50',
    format: 'png',
    assetPath: null,
    minTier: 'BASIC',
  },
  {
    id: 'banner-halfpage',
    size: '300x600',
    format: 'png',
    assetPath: null,
    minTier: 'PREMIUM',
  },
];

/**
 * Filter the static registry to assets visible to a given tier.
 * Optional locale filter narrows copy templates + outreach scripts.
 * Optional niche filter returns only templates for that niche (e.g. 'sop_marketplace').
 */
export function listPromoAssetsForTier(
  tier: PromoTier,
  locale?: PromoLocale,
  niche?: PromoNiche,
): PromoLibraryFiltered {
  const tierRank = TIER_RANK[tier];
  const matchTier = <T extends { minTier: PromoTier }>(asset: T): boolean =>
    TIER_RANK[asset.minTier] <= tierRank;
  const matchLocale = <T extends { locale: PromoLocale }>(asset: T): boolean =>
    !locale || asset.locale === locale;
  const matchNiche = <T extends { niche?: PromoNiche }>(asset: T): boolean =>
    !niche || asset.niche === niche;

  return {
    copyTemplates: COPY_TEMPLATES.filter(matchTier).filter(matchLocale).filter(matchNiche),
    outreachScripts: OUTREACH_SCRIPTS.filter(matchTier).filter(matchLocale).filter(matchNiche),
    banners: BANNER_SPECS.filter(matchTier),
  };
}

/** Substitute {{REF_LINK}} placeholder in a body string. */
export function fillRefLink(body: string, refLink: string): string {
  return body.replaceAll('{{REF_LINK}}', refLink);
}

/**
 * Substitute SOP marketplace placeholders in a body string.
 * Replaces `{{REF_LINK}}` and `{{SOP_NAME}}` in a single pass.
 */
export function fillSopPlaceholders(
  body: string,
  refLink: string,
  sopName: string,
): string {
  return body.replaceAll('{{REF_LINK}}', refLink).replaceAll('{{SOP_NAME}}', sopName);
}
