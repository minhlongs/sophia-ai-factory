import { OpenClawGateway } from '@/tree/gateway/openclaw-gateway';
import { YouTubeChannelAdapter } from '@/tree/gateway/adapters/youtube-channel-adapter';
import { TikTokChannelAdapter } from '@/tree/gateway/adapters/tiktok-channel-adapter';
import { TelegramNotificationAdapter } from '@/tree/gateway/adapters/telegram-notification-adapter';
import type { YouTubeOAuthClient, TikTokOAuthClient } from '@/tree/types/oauth-client-types';
import type { Tier } from '@/seed/types';
import type { AffiliateOfferResult } from './types';

export function getD1ForWebhooks(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

export async function createDistributionGateway(): Promise<OpenClawGateway> {
  const { uploadVideo, refreshAccessToken } = await import('@/land/youtube/youtube-oauth-client');
  const { publishVideo, checkPublishStatus } = await import('@/land/tiktok/tiktok-oauth-client');
  const youtubeOAuthClient: YouTubeOAuthClient = { uploadVideo, refreshAccessToken };
  const tiktokOAuthClient: TikTokOAuthClient = { publishVideo, checkPublishStatus };
  const gateway = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 2000 });
  gateway.registerChannel({
    id: 'youtube',
    name: 'YouTube',
    adapter: new YouTubeChannelAdapter(youtubeOAuthClient),
    enabled: true,
    rateLimitPerHour: 6,
  });
  gateway.registerChannel({
    id: 'tiktok',
    name: 'TikTok',
    adapter: new TikTokChannelAdapter(tiktokOAuthClient),
    enabled: true,
    rateLimitPerHour: 10,
  });
  gateway.registerChannel({
    id: 'telegram',
    name: 'Telegram Notifications',
    adapter: new TelegramNotificationAdapter(),
    enabled: true,
    rateLimitPerHour: 60,
  });
  return gateway;
}

export interface DistributeParams {
  campaignId: string;
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  audience: string;
  tier: Tier;
  affiliateOffer: AffiliateOfferResult | null;
}

export async function runDistribution(params: DistributeParams) {
  const { campaignId, videoUrl, thumbnailUrl, title, audience, tier, affiliateOffer } = params;
  const gateway = await createDistributionGateway();
  const baseDesc = `AI-generated video content for ${audience || 'general audience'}`;
  const description = affiliateOffer ? `${baseDesc}\n\n👉 ${affiliateOffer.shortUrl}` : baseDesc;
  const payload = {
    campaignId,
    videoUrl,
    thumbnailUrl: thumbnailUrl || undefined,
    title,
    description,
    tags: ['sophia-ai', 'auto-generated', tier.toLowerCase()],
  };
  const result = await gateway.distribute(payload);
  if (!result.allSucceeded) {
    const healed = await gateway.selfHeal({ ...payload, description }, result);
    return healed;
  }
  return result;
}
