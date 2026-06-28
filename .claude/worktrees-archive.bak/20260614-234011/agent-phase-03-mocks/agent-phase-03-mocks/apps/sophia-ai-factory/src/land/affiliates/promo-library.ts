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
export type PromoNiche = 'creators' | 'agency' | 'coaches' | 'dropshippers' | 'universal' | 'sop_marketplace';
export type PromoTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
const TIER_RANK: Record<PromoTier, number> = {
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

  // SOP Marketplace — BASIC tier (Twitter/X)
  {
    id: 'twitter-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'twitter',
    body: 'Just listed "{{SOP_NAME}}" on Sophia AI Factory marketplace 🚀\n\nOperational playbooks that actually ship — grab it here: {{REF_LINK}}\n\n#SOP #AItools #Automation',
    minTier: 'BASIC',
  },
  {
    id: 'twitter-sop-marketplace-vi',
    niche: 'sop_marketplace',
    locale: 'vi',
    channel: 'twitter',
    body: 'Vừa đăng "{{SOP_NAME}}" lên Sophia AI Factory marketplace.\n\nSOP thực chiến, ai dùng AI để scale doanh thu là cần cái này: {{REF_LINK}}\n\n#SOP #AI #TựĐộngHóa',
    minTier: 'BASIC',
  },

  // SOP Marketplace — BASIC tier (Facebook group)
  {
    id: 'facebook-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'facebook',
    body: `Hey everyone 👋\n\nI just published a new SOP on Sophia AI Factory — "{{SOP_NAME}}".\n\nThis playbook covers exactly how I [brief outcome — e.g. "cut client onboarding from 3 days to 4 hours"]. It's plug-and-play: download, customise your details, run it.\n\nIf you've been building your own systems for this, save yourself the rework. Link: {{REF_LINK}}\n\nHappy to answer questions below!`,
    minTier: 'BASIC',
  },

  // SOP Marketplace — PREMIUM tier (Reddit r/entrepreneur)
  {
    id: 'reddit-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'reddit',
    body: `**I packaged 2 years of trial-and-error into a single SOP — sharing it on Sophia's marketplace**\n\nAfter running [your use-case] for two years I finally wrote down every decision point, tool, and failure mode into a single document: "{{SOP_NAME}}".\n\nIt covers:\n- [Key step 1]\n- [Key step 2]\n- [Key step 3]\n\nI put it in the Sophia AI Factory marketplace so it's versioned and easy to update. Not a free doc — priced it to filter for people who'll actually use it.\n\nFull details + preview: {{REF_LINK}}\n\nHappy to answer questions in comments.`,
    minTier: 'PREMIUM',
  },

  // SOP Marketplace — BASIC tier (Telegram group)
  {
    id: 'telegram-sop-marketplace-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'telegram',
    body: `📋 New SOP dropped: "{{SOP_NAME}}"\n\nIf you're still building this process from scratch, here's the shortcut 👇\n{{REF_LINK}}\n\nLive on Sophia AI Factory marketplace — instant download, plug-and-play.`,
    minTier: 'BASIC',
  },
  {
    id: 'telegram-sop-marketplace-vi',
    niche: 'sop_marketplace',
    locale: 'vi',
    channel: 'telegram',
    body: `📋 SOP mới vừa lên: "{{SOP_NAME}}"\n\nNếu bạn đang tự build quy trình này từ đầu — đây là phím tắt 👇\n{{REF_LINK}}\n\nĐã có trên Sophia AI Factory marketplace, tải về và dùng ngay.`,
    minTier: 'BASIC',
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
  {
    id: 'email-sop-marketplace-beta-creator-en',
    niche: 'sop_marketplace',
    locale: 'en',
    channel: 'email',
    subject: 'Earn revenue from the SOPs you already have',
    body: `Hi {first_name},\n\nI noticed you've been sharing frameworks / playbooks in [community / newsletter / course] — the kind of structured process docs that take real expertise to build.\n\nSophia AI Factory just launched a SOP marketplace where operators can publish and sell those exact documents. Beta creators get:\n- First-mover visibility on the platform\n- 70% revenue share per sale\n- No listing fees during beta\n\nYou'd list your SOP, set your price, and Sophia handles discovery, checkout, and delivery. Your affiliate link also earns commission on any tier upgrades buyers make after downloading: {{REF_LINK}}\n\nIf you have even one battle-tested playbook sitting in a Notion doc, it's worth 15 minutes to list it. Happy to walk you through the process.\n\n— {sender_name}`,
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
