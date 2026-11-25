/**
 * Paid Ads Creative & Pre-Lander Kit for Crypto + SaaS Affiliates.
 *
 * Prevents direct-linking ad account bans on Meta, TikTok, and Google/YouTube Ads by:
 * 1. Scanning scripts & copy for banned profit-guarantee / hype phrases (VI + EN).
 * 2. Generating platform-tailored Ad Copy (Primary Text, Headline, Description, CTA)
 *    pointing to a clean Bridge Page (`/c/[slug]?utm_source=...`) rather than raw affiliate URLs.
 *
 * @module tree/ads/paid-ads-creative-kit
 */

import type { AffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-prompt';

export type PaidAdPlatform = 'meta_ads' | 'tiktok_ads' | 'youtube_ads';

export interface AdPolicyViolation {
  readonly phrase: string;
  readonly reason: string;
}

export interface PaidAdVariant {
  readonly platform: PaidAdPlatform;
  readonly aspectRatio: '9:16' | '16:9';
  readonly headline: string;
  readonly primaryText: string;
  readonly description: string;
  readonly callToAction: string;
  readonly bridgeDestinationUrl: string;
}

export interface PaidAdsCreativeKit {
  readonly policyStatus: 'SAFE' | 'RISK_DETECTED';
  readonly violations: readonly AdPolicyViolation[];
  readonly variants: readonly PaidAdVariant[];
}

const BANNED_AD_RULES: ReadonlyArray<{ readonly pattern: RegExp; readonly reason: string }> = [
  { pattern: /guaranteed\s+(profit|roi|income|returns?)/i, reason: 'Profit guarantee banned on Meta/TikTok/Google Ads' },
  { pattern: /get\s+rich\s+quick|10x\s+your\s+money|risk[-\s]?free\s+crypto/i, reason: 'Unrealistic financial claim triggers instant ad ban' },
  { pattern: /đảm\s+bảo\s+(lợi\s+nhuận|lãi|thu\s+nhập)/i, reason: 'Cam kết lợi nhuận bị cấm trên Meta/TikTok/Google Ads' },
  { pattern: /x10\s+tài\s+khoản|giàu\s+nhanh|không\s+rủi\s+ro/i, reason: 'Tuyên bố tài chính phóng đại dễ gây khóa tài khoản Ads' },
];

export function scanPaidAdsPolicyViolations(text: string): readonly AdPolicyViolation[] {
  const violations: AdPolicyViolation[] = [];
  for (const rule of BANNED_AD_RULES) {
    const match = text.match(rule.pattern);
    if (match?.[0]) {
      violations.push({ phrase: match[0], reason: rule.reason });
    }
  }
  return violations;
}

export function buildPaidAdsCreativeKit(args: {
  readonly pack: AffiliateCampaignPack;
  readonly slug: string;
  readonly canonicalBaseUrl?: string;
}): PaidAdsCreativeKit {
  const baseUrl = (
    args.canonicalBaseUrl || 'https://sophia-ai-factory.agencyos-openclaw.workers.dev'
  ).replace(/\/$/, '');
  const safeSlug = args.slug.replace(/[^a-z0-9_-]/gi, '-').slice(0, 64) || 'review';

  const scanSurface = [
    args.pack.campaignTitle,
    args.pack.hook,
    args.pack.valueProposition,
    args.pack.callToAction,
    ...args.pack.shortFormScript.scenes.map((s) => s.narration),
  ].join(' ');

  const violations = scanPaidAdsPolicyViolations(scanSurface);
  const headline = args.pack.campaignTitle.slice(0, 40);
  const description = args.pack.valueProposition.slice(0, 90);
  const cta = 'Learn More';

  const variants: readonly PaidAdVariant[] = [
    {
      platform: 'meta_ads',
      aspectRatio: '9:16',
      headline,
      primaryText: `${args.pack.hook}\n\n${args.pack.valueProposition}\n\n${args.pack.affiliateDisclosure}`,
      description,
      callToAction: cta,
      bridgeDestinationUrl: `${baseUrl}/c/${safeSlug}?utm_source=meta_ads&utm_medium=paid_video`,
    },
    {
      platform: 'tiktok_ads',
      aspectRatio: '9:16',
      headline,
      primaryText: `${args.pack.hook} ${args.pack.affiliateDisclosure}`,
      description,
      callToAction: cta,
      bridgeDestinationUrl: `${baseUrl}/c/${safeSlug}?utm_source=tiktok_ads&utm_medium=paid_video`,
    },
    {
      platform: 'youtube_ads',
      aspectRatio: '16:9',
      headline,
      primaryText: `${args.pack.hook}\n${args.pack.valueProposition}\n${args.pack.affiliateDisclosure}`,
      description,
      callToAction: cta,
      bridgeDestinationUrl: `${baseUrl}/c/${safeSlug}?utm_source=youtube_ads&utm_medium=paid_video`,
    },
  ];

  return {
    policyStatus: violations.length === 0 ? 'SAFE' : 'RISK_DETECTED',
    violations,
    variants,
  };
}
