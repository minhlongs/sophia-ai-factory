export type PromoLocale = 'en' | 'vi';
export type PromoNiche = 'creators' | 'agency' | 'coaches' | 'dropshippers' | 'universal' | 'sop_marketplace';
export type PromoTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

export const TIER_RANK: Record<PromoTier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

export interface CopyTemplate {
  id: string;
  niche: PromoNiche;
  locale: PromoLocale;
  channel: 'twitter' | 'linkedin' | 'instagram' | 'tiktok-caption' | 'facebook' | 'reddit' | 'telegram';
  /** Plain-text body. `{{REF_LINK}}` is replaced client-side with the affiliate's link. `{{SOP_NAME}}` is replaced with the SOP title. */
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
  /** Niche tag used for optional category filtering. */
  niche?: PromoNiche;
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

export interface PromoLibraryFiltered {
  copyTemplates: CopyTemplate[];
  outreachScripts: OutreachScript[];
  banners: BannerSpec[];
}
