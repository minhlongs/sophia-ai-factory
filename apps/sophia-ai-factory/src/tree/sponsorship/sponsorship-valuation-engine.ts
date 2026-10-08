/**
 * @file sponsorship-valuation-engine.ts
 * @description Pure algorithmic engine for Dynamic Sponsorship Rate Card Valuation
 * @layer tree
 */

import type {
  ContentNiche,
  SponsorshipValuationInput,
  SponsorshipRateCard,
  BrandPitchEmail,
} from '@/seed/types/growth-triad-v7-types';

const NICHE_MULTIPLIERS: Record<ContentNiche, number> = {
  FINANCE: 2.2,
  SAAS: 1.8,
  CRYPTO: 2.0,
  TECH: 1.5,
  LIFESTYLE: 0.9,
};

/**
 * Calculates dynamic sponsorship rate cards based on views, niche CPM, and audience quality
 */
export function calculateSponsorshipValuation(
  input: SponsorshipValuationInput
): SponsorshipRateCard {
  const nicheMultiplier = NICHE_MULTIPLIERS[input.niche] ?? 1.0;
  const engagementBoost = Math.min(0.5, input.engagementRate * 10);
  const geoMultiplier = 0.5 + 0.5 * (Math.min(100, Math.max(0, input.tier1AudiencePct)) / 100);

  const thousandsOfViews = input.expected30dViews / 1000;
  const baseRate = input.baseCpmUsd * thousandsOfViews;

  const dedicated = baseRate * nicheMultiplier * (1 + engagementBoost) * geoMultiplier;
  const sixtySecMidRoll = dedicated * 0.5;
  const thirtySecPreRoll = dedicated * 0.3;
  const shoutout = dedicated * 0.15;

  const effectiveCpm = dedicated / Math.max(1, thousandsOfViews);

  return {
    dedicatedVideoUsd: Number(dedicated.toFixed(2)),
    sixtySecMidRollUsd: Number(sixtySecMidRoll.toFixed(2)),
    thirtySecPreRollUsd: Number(thirtySecPreRoll.toFixed(2)),
    shoutoutOrCommunityUsd: Number(shoutout.toFixed(2)),
    effectiveCpmUsd: Number(effectiveCpm.toFixed(2)),
  };
}

/**
 * Generates an automated B2B sponsorship pitch email for brand partners
 */
export function generateBrandPitchEmail(
  channelName: string,
  niche: ContentNiche,
  expected30dViews: number,
  rateCard: SponsorshipRateCard,
  brandName = 'Partner Brand'
): BrandPitchEmail {
  const subject = `Partnership Proposal: ${channelName} x ${brandName} (${expected30dViews.toLocaleString()} Est. 30D Views)`;
  const body = [
    `Hi ${brandName} Team,`,
    ``,
    `We love what you are building. Our channel ${channelName} reaches an engaged community in the ${niche} space with over ${expected30dViews.toLocaleString()} targeted monthly views.`,
    ``,
    `Here is our verified sponsorship rate card:`,
    `- Dedicated Video Integration: $${rateCard.dedicatedVideoUsd.toLocaleString()} USD`,
    `- 60-Second Mid-Roll Feature: $${rateCard.sixtySecMidRollUsd.toLocaleString()} USD`,
    `- 30-Second Pre-Roll Mention: $${rateCard.thirtySecPreRollUsd.toLocaleString()} USD`,
    `- Community & Social Shoutout: $${rateCard.shoutoutOrCommunityUsd.toLocaleString()} USD`,
    ``,
    `Let us know if you'd like to collaborate this upcoming month.`,
    ``,
    `Best regards,`,
    `${channelName} Growth Team`,
  ].join('\n');

  return {
    subject,
    body,
    rateCard,
  };
}
