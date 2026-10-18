/**
 * Auto-Publisher Capability & Multi-Platform Syndication
 * Tree Layer - Deterministic multi-platform syndication and tracking payloads
 *
 * @module tree/autonomous/swarm-auto-publisher
 */

import type { ViralScriptOutput } from './swarm-content-producer';
import type { ApacMarket } from './swarm-types';
import {
  calculateNextApacPeakSlot,
  type ApacMarketConfig,
  type ApacMarketWindow,
  APAC_MARKET_CONFIGS,
  isApacPeakTime,
} from './swarm-apac-scheduler';
import { buildPlatformPublishPayload } from './swarm-platform-payloads';

// Re-export APAC scheduler utilities for seamless backward compatibility
export {
  calculateNextApacPeakSlot,
  type ApacMarketConfig,
  type ApacMarketWindow,
  APAC_MARKET_CONFIGS,
  isApacPeakTime,
};

export interface PlatformPublishPayload {
  platform: 'youtube' | 'tiktok' | 'instagram';
  title: string;
  caption: string;
  aspectRatio: '16:9' | '9:16';
  tags: string[];
  utmUrl: string;
  scheduledTimeUtc: string;
  targetMarket: ApacMarket;
}

export interface AutoPublisherInput {
  videoDraft?: Partial<ViralScriptOutput>;
  targetPlatforms?: Array<'youtube' | 'tiktok' | 'instagram'>;
  targetMarkets?: ApacMarket[];
  baseAffiliateUrl?: string;
  referenceDate?: Date;
}

export interface AutoPublisherOutput {
  publishedPayloads: PlatformPublishPayload[];
  targetMarkets: ApacMarket[];
  scheduledSlots: Record<ApacMarket, string>;
  syndicationSummary: {
    totalPlatforms: number;
    hasAffiliateDisclosure: boolean;
    utmLinksGenerated: number;
  };
}

/**
 * Builds deterministic UTM tracking link for syndication platforms.
 */
export function buildUtmUrl(
  baseUrl: string,
  platform: string,
  campaign: string = 'autonomous_swarm',
): string {
  const url = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
  url.searchParams.set('utm_source', platform);
  url.searchParams.set('utm_medium', 'social_syndication');
  url.searchParams.set('utm_campaign', campaign);
  url.searchParams.set('utm_content', 'chua_chum_v2');
  return url.toString();
}

/**
 * Generates syndication payloads for YouTube, TikTok, and Instagram with APAC peak time scheduling.
 */
export function generateMultiPlatformSyndication(
  input: AutoPublisherInput = {},
): AutoPublisherOutput {
  const platforms = input.targetPlatforms || ['youtube', 'tiktok', 'instagram'];
  const markets = input.targetMarkets || ['VN', 'JP'];
  const baseAffiliateUrl = input.baseAffiliateUrl || 'https://sophia.agencyos.network/offers/ai';
  const refDate = input.referenceDate || new Date();

  const publishedPayloads: PlatformPublishPayload[] = [];
  const scheduledSlots: Record<ApacMarket, string> = {} as Record<ApacMarket, string>;

  for (const market of markets) {
    const nextSlot = calculateNextApacPeakSlot(refDate, market);
    const slotIso = nextSlot.toISOString();
    scheduledSlots[market] = slotIso;

    for (const platform of platforms) {
      const utmUrl = buildUtmUrl(baseAffiliateUrl, platform);
      publishedPayloads.push(buildPlatformPublishPayload(platform, utmUrl, slotIso, market));
    }
  }

  return {
    publishedPayloads,
    targetMarkets: markets,
    scheduledSlots,
    syndicationSummary: {
      totalPlatforms: platforms.length,
      hasAffiliateDisclosure: true,
      utmLinksGenerated: publishedPayloads.length,
    },
  };
}
