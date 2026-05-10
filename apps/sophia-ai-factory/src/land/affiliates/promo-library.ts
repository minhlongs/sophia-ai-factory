/**
 * Affiliate Promo Library
 *
 * Static registry of paste-ready promo assets affiliates can use to launch fast:
 *   - Copy templates: short, niche-targeted social posts (en + vi)
 *   - Outreach drafts: cold DM scripts for partners/clients
 *   - Banner specs: standard ad-network dimensions + placeholder asset paths
 *
 * Stored as code (not D1) — ships with deploy, zero runtime cost, easy review/PR diff.
 * Tier gating in `listPromoAssetsForTier`: BASIC sees the 3 universal niches,
 * higher tiers unlock niche-specific + outreach scripts.
 *
 * @module land/affiliates/promo-library
 */

export type PromoLocale = 'en' | 'vi';
export type PromoTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
const TIER_RANK: Record<PromoTier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

export interface CopyTemplate {
  id: string;
  niche: 'creators' | 'agency' | 'coaches' | 'dropshippers' | 'universal';
  locale: PromoLocale;
  channel: 'twitter' | 'linkedin' | 'instagram' | 'tiktok-caption';
  /** Plain-text body. `{{REF_LINK}}` is replaced client-side with the affiliate's link. */
  body: string;
  minTier: PromoTier;
}

export interface OutreachScript {
  id: string;
  locale: PromoLocale;
  channel: 'email' | 'twitter-dm' | 'linkedin-dm';
  subject?: string;
  body: string;
  minTier: PromoTier;
}

export interface BannerSpec {
  id: string;
  /** Industry-standard ad slot sizes (IAB). */
  size: '728x90' | '300x250' | '160x600' | '320x50' | '300x600';
  format: 'png' | 'svg';
  /** Path under /public/affiliate-assets/ — empty until art provisioned. */
  assetPath: string | null;
  minTier: PromoTier;
}

export const COPY_TEMPLATES: readonly CopyTemplate[] = [
  // Universal — BASIC tier
  {
    id: 'twitter-universal-en',
    niche: 'universal',
    locale: 'en',
    channel: 'twitter',
    body: 'Tired of burning hours on AI video tools that ship slop? Sophia AI Factory turns 1 brief into 10 channel-ready clips. Free trial, no credit card: {{REF_LINK}}',
    minTier: 'BASIC',
  },
  {
    id: 'twitter-universal-vi',
    niche: 'universal',
    locale: 'vi',
    channel: 'twitter',
    body: 'Một brief, mười clip ready-to-post. Sophia tự dựng video + dàn dòng + đẩy đa kênh, không tốn editor. Thử miễn phí: {{REF_LINK}}',
    minTier: 'BASIC',
  },
  {
    id: 'linkedin-universal-en',
    niche: 'universal',
    locale: 'en',
    channel: 'linkedin',
    body: 'I cut my client video pipeline from 6h to 18min using Sophia AI Factory. One workflow handles brief → script → render → publish. If you bill creative hours, this changes the math. {{REF_LINK}}',
    minTier: 'BASIC',
  },

  // Creators niche — PREMIUM
  {
    id: 'tiktok-creators-en',
    niche: 'creators',
    locale: 'en',
    channel: 'tiktok-caption',
    body: 'POV: you stopped editing at 2am because AI does your B-roll, captions, and cuts. Sophia is the unfair stack: {{REF_LINK}} #creatortools',
    minTier: 'PREMIUM',
  },
  {
    id: 'instagram-creators-vi',
    niche: 'creators',
    locale: 'vi',
    channel: 'instagram',
    body: 'Stop dựng video một mình. Sophia render hộ B-roll + caption + cắt cảnh, deadline 1 ngày làm 10 video không vấn đề. Link tool: {{REF_LINK}}',
    minTier: 'PREMIUM',
  },

  // Agency niche — ENTERPRISE
  {
    id: 'linkedin-agency-en',
    niche: 'agency',
    locale: 'en',
    channel: 'linkedin',
    body: 'Agency owners: stop billing $80/hr to render. Sophia runs your 10-deliverable monthly retainer in one afternoon. White-label and tiered pricing live. Audit your margins → {{REF_LINK}}',
    minTier: 'ENTERPRISE',
  },

  // Coaches niche — PREMIUM
  {
    id: 'twitter-coaches-en',
    niche: 'coaches',
    locale: 'en',
    channel: 'twitter',
    body: '47 short videos a month is the new minimum if you want clients. Sophia produces them while you coach. Same brief, ten variants. {{REF_LINK}}',
    minTier: 'PREMIUM',
  },

  // Dropshippers niche — PREMIUM
  {
    id: 'tiktok-dropshippers-en',
    niche: 'dropshippers',
    locale: 'en',
    channel: 'tiktok-caption',
    body: 'Test 20 winning angles in a weekend. Sophia spits product videos in batches — you focus on creatives that print. {{REF_LINK}}',
    minTier: 'PREMIUM',
  },
];

export const OUTREACH_SCRIPTS: readonly OutreachScript[] = [
  {
    id: 'email-cold-creator-en',
    locale: 'en',
    channel: 'email',
    subject: 'Saw your last 3 reels — quick idea',
    body: `Hey {first_name},\n\nWatched your last 3 posts — your hook game is solid but the post cadence felt rough. I help creators like you cut editing time ~80% with Sophia AI Factory; a brief becomes 10 channel-ready clips.\n\nIf I'm right that you're posting <3x/week because of bandwidth, this fixes it. Free to try, my affiliate link if you wanna kick the tires: {{REF_LINK}}\n\nNo pressure either way.\n\n— {sender_name}`,
    minTier: 'PREMIUM',
  },
  {
    id: 'linkedin-dm-agency-en',
    locale: 'en',
    channel: 'linkedin-dm',
    body: `Hey {first_name}, saw your agency does retainer video work for {industry}. I run a similar shop — switched to Sophia AI Factory 2 months ago and shaved ~60% off our render costs. Worth a 10-min look if margins are tight: {{REF_LINK}}`,
    minTier: 'ENTERPRISE',
  },
  {
    id: 'email-coach-en',
    locale: 'en',
    channel: 'email',
    subject: 'Your daily content is the bottleneck — fix in 1 tool',
    body: `Hi {first_name},\n\nYou're a coach who lives or dies by daily content. Sophia turns a 5-min voice memo into a week of posts (script, visuals, captions, schedule). That alone is the unlock — but it also tracks which posts convert into discovery calls.\n\nI'm an affiliate so full transparency: {{REF_LINK}}. 14-day free trial, no card.\n\n— {sender_name}`,
    minTier: 'PREMIUM',
  },
];

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

export interface PromoLibraryFiltered {
  copyTemplates: CopyTemplate[];
  outreachScripts: OutreachScript[];
  banners: BannerSpec[];
}

/**
 * Filter the static registry to assets visible to a given tier.
 * Optional locale filter narrows copy templates + outreach scripts.
 */
export function listPromoAssetsForTier(
  tier: PromoTier,
  locale?: PromoLocale,
): PromoLibraryFiltered {
  const tierRank = TIER_RANK[tier];
  const matchTier = <T extends { minTier: PromoTier }>(asset: T): boolean =>
    TIER_RANK[asset.minTier] <= tierRank;
  const matchLocale = <T extends { locale: PromoLocale }>(asset: T): boolean =>
    !locale || asset.locale === locale;

  return {
    copyTemplates: COPY_TEMPLATES.filter(matchTier).filter(matchLocale),
    outreachScripts: OUTREACH_SCRIPTS.filter(matchTier).filter(matchLocale),
    banners: BANNER_SPECS.filter(matchTier),
  };
}

/** Substitute {{REF_LINK}} placeholder in a body string. */
export function fillRefLink(body: string, refLink: string): string {
  return body.replaceAll('{{REF_LINK}}', refLink);
}
