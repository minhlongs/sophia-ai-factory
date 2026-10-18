/**
 * Niche Syndication Builder
 *
 * Assembles platform-specific posting metadata (YouTube Shorts, TikTok,
 * Instagram Reels) for high-converting SaaS & Crypto affiliate video campaigns.
 *
 * Layer: tree/video/syndication (Domain Reusable Logic)
 * @module tree/video/syndication/niche-syndication-builder
 */

import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import type { NicheSyndicationPackage } from './niche-syndication-types';
import {
  buildYoutubeShortsPayload,
  buildTiktokPayload,
  buildInstagramPayload,
} from './niche-platform-payloads';

export function buildNicheSyndicationPackage(
  plan: NicheVideoCampaignPlan,
  locale: 'en' | 'vi' = 'en',
): NicheSyndicationPackage {
  const isCrypto = plan.blueprint.niche === 'crypto_global';
  const niche = isCrypto ? 'crypto_global' : 'saas_global';

  return {
    planId: plan.planId,
    productName: plan.productName,
    niche,
    generatedAt: new Date().toISOString(),
    platforms: {
      youtube_shorts: buildYoutubeShortsPayload(plan, isCrypto, locale),
      tiktok: buildTiktokPayload(plan, isCrypto, locale),
      instagram_reels: buildInstagramPayload(plan, isCrypto, locale),
    },
  };
}
