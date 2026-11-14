import { OpenClawGateway } from '@/tree/gateway/openclaw-gateway';
import { YouTubeChannelAdapter } from '@/tree/gateway/adapters/youtube-channel-adapter';
import { TikTokChannelAdapter } from '@/tree/gateway/adapters/tiktok-channel-adapter';
import { TelegramNotificationAdapter } from '@/tree/gateway/adapters/telegram-notification-adapter';
import type { YouTubeOAuthClient, TikTokOAuthClient } from '@/tree/types/oauth-client-types';
import type { Tier } from '@/seed/types';
import type { ProvenanceInput } from '@/seed/types/provenance';
import { logger } from '@/seed/utils/logger-utility';
import { resolveAudienceJurisdiction } from '@/tree/affiliates/audience-jurisdiction';
import { decidePublishCompliance } from '@/tree/affiliates/publish-compliance-decision';
import {
  producePublishProvenance,
  type ScriptContentLike,
} from '@/tree/youtube-strategy/provenance-producer';
import type { AffiliateOfferResult } from './types';

export function getD1ForWebhooks(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    return (ctx?.env?.DB as D1Database) ?? null;
  } catch {
    return null;
  }
}

export async function createDistributionGateway(userId?: string): Promise<OpenClawGateway> {
  const { uploadVideo, refreshAccessToken } = await import('@/land/youtube/youtube-oauth-client');
  const { publishVideo, checkPublishStatus } = await import('@/land/tiktok/tiktok-oauth-client');
  const youtubeOAuthClient: YouTubeOAuthClient = { uploadVideo, refreshAccessToken };
  const tiktokOAuthClient: TikTokOAuthClient = { publishVideo, checkPublishStatus };
  const gateway = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 2000 });
  gateway.registerChannel({ id: 'youtube', name: 'YouTube', adapter: new YouTubeChannelAdapter(youtubeOAuthClient, userId), enabled: true, rateLimitPerHour: 6 });
  gateway.registerChannel({ id: 'tiktok', name: 'TikTok', adapter: new TikTokChannelAdapter(tiktokOAuthClient), enabled: true, rateLimitPerHour: 10 });
  gateway.registerChannel({ id: 'telegram', name: 'Telegram Notifications', adapter: new TelegramNotificationAdapter(), enabled: true, rateLimitPerHour: 60 });
  return gateway;
}

export interface DistributeParams {
  campaignId: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  audience: string;
  tier: Tier;
  affiliateOffer: AffiliateOfferResult | null;
  locale?: 'en' | 'vi';
  script?: ScriptContentLike | Record<string, unknown> | null;
  sources?: readonly Record<string, unknown>[];
  provenance?: ProvenanceInput;
}

export interface DistributionComplianceRecord {
  published: boolean;
  reason?: string;
  detail: string;
  vertical: string;
  affiliateDisclosureEmitted: boolean;
  financialDisclaimerEmitted: boolean;
}

export async function runDistribution(
  params: DistributeParams,
): Promise<Awaited<ReturnType<OpenClawGateway['distribute']>> & { compliance: DistributionComplianceRecord }> {
  const { campaignId, userId, videoUrl, thumbnailUrl, title, audience, tier, affiliateOffer } = params;
  const baseDesc = `AI-generated video content for ${audience || 'general audience'}`;
  const jurisdiction = await resolveAudienceJurisdiction(userId);
  const resolvedLocale: 'en' | 'vi' = params.locale ?? (jurisdiction?.toUpperCase() === 'VN' ? 'vi' : 'en');
  const decision = decidePublishCompliance({
    baseDescription: baseDesc,
    offer: affiliateOffer
      ? { productName: affiliateOffer.productName, shortUrl: affiliateOffer.shortUrl, category: affiliateOffer.category ?? null }
      : null,
    jurisdiction,
    locale: resolvedLocale,
  });

  if (!decision.mayPublish) {
    logger.warn('[distribute] compliance gate withheld publishing', {
      campaignId,
      userId,
      vertical: decision.vertical,
      reason: decision.reason,
      detail: decision.detail,
    });
    return {
      campaignId,
      results: [],
      allSucceeded: false,
      compliance: {
        published: false,
        reason: decision.reason,
        detail: decision.detail,
        vertical: decision.vertical,
        affiliateDisclosureEmitted: false,
        financialDisclaimerEmitted: false,
      },
    };
  }

  const provenance = producePublishProvenance({
    title,
    description: decision.description,
    script: params.script,
    sources: params.sources,
    provenance: params.provenance,
  });

  const payload = {
    campaignId,
    videoUrl,
    thumbnailUrl: thumbnailUrl || undefined,
    title,
    description: decision.description,
    tags: ['sophia-ai', 'auto-generated', tier.toLowerCase()],
    provenance,
  };
  const compliance: DistributionComplianceRecord = {
    published: true,
    detail: decision.detail,
    vertical: decision.vertical,
    affiliateDisclosureEmitted: decision.affiliateDisclosureEmitted,
    financialDisclaimerEmitted: decision.financialDisclaimerEmitted,
  };
  const gateway = await createDistributionGateway(userId);
  const result = await gateway.distribute(payload);
  if (!result.allSucceeded) {
    const healed = await gateway.selfHeal(payload, result);
    return { ...healed, compliance };
  }
  return { ...result, compliance };
}
