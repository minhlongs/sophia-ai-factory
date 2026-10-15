import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { captureServer } from '@/forest/telemetry/posthog-capture';
import { Events } from '@/forest/telemetry/event-types';
import { startVideoGeneration } from '@/seed/ai/video-generator';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { OpenClawGateway } from '@/tree/gateway/openclaw-gateway';
import { YouTubeChannelAdapter } from '@/tree/gateway/adapters/youtube-channel-adapter';
import { TikTokChannelAdapter } from '@/tree/gateway/adapters/tiktok-channel-adapter';
import { TelegramNotificationAdapter } from '@/tree/gateway/adapters/telegram-notification-adapter';
import type { YouTubeOAuthClient, TikTokOAuthClient } from '@/tree/types/oauth-client-types';
import { NonRetriableError } from 'inngest';
import type { Tier } from '@/seed/types';
import type { AffiliateOfferResult, StatusUpdater, UserNotifier, ProviderErrorNotifier } from './types';

export function getD1ForWebhooks(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
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
  gateway.registerChannel({ id: 'youtube', name: 'YouTube', adapter: new YouTubeChannelAdapter(youtubeOAuthClient), enabled: true, rateLimitPerHour: 6 });
  gateway.registerChannel({ id: 'tiktok', name: 'TikTok', adapter: new TikTokChannelAdapter(tiktokOAuthClient), enabled: true, rateLimitPerHour: 10 });
  gateway.registerChannel({ id: 'telegram', name: 'Telegram Notifications', adapter: new TelegramNotificationAdapter(), enabled: true, rateLimitPerHour: 60 });
  return gateway;
}

export interface StartVideoParams {
  campaignId: string;
  userId: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  script: ScriptOutput;
  updateStatus: StatusUpdater;
  notifyUser: UserNotifier;
  notifyRefundRequired: (userId: string, campaignId: string, key: string) => Promise<void>;
  notifyProviderError: ProviderErrorNotifier;
}

export async function runStartVideo(params: StartVideoParams): Promise<string | null> {
  const { campaignId, userId, tier, resume, resumeFrom, script, updateStatus, notifyUser, notifyRefundRequired, notifyProviderError } = params;
  if (resume && resumeFrom === 'finalize') return null;
  await updateStatus('processing_video', 70);
  if (!resume) await notifyUser('🎤 Voiceover ready! Now rendering video...');

  try {
    const { MissingCredentialsError, ProviderQuotaExceededError, ProviderInvalidKeyError } = await import('@/land/services/errors');
    try {
      const jobId = await startVideoGeneration({ script, tier, userId });
      void captureServer({
        event: Events.FIRST_VIDEO_STARTED,
        distinctId: userId,
        source: 'server',
        properties: { campaign_id: campaignId, tier },
      }).catch((err) => {
        logger.warn('[generateCampaign] capture first_video_started failed', { error: String(err) });
      });
      return jobId;
    } catch (innerErr) {
      if (innerErr instanceof MissingCredentialsError) {
        await notifyRefundRequired(userId, campaignId, innerErr.key);
        throw new NonRetriableError(`Missing AI credential: ${innerErr.key}`, { cause: innerErr });
      }
      if (innerErr instanceof ProviderQuotaExceededError) {
        await notifyProviderError(userId, campaignId, innerErr.service, 'quota', innerErr.message);
        throw new NonRetriableError(innerErr.message, { cause: innerErr });
      }
      if (innerErr instanceof ProviderInvalidKeyError) {
        await notifyProviderError(userId, campaignId, innerErr.service, 'key', innerErr.message);
        throw new NonRetriableError(innerErr.message, { cause: innerErr });
      }
      throw innerErr;
    }
  } catch (outerErr) {
    throw outerErr;
  }
}

export interface PollVideoParams {
  campaignId: string;
  userId: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  videoJobId: string | null;
  topic: string;
  updateStatus: StatusUpdater;
  notifyUser: UserNotifier;
}

export async function runPollVideo(params: PollVideoParams): Promise<{ video_url: string; thumbnail_url: string }> {
  const { campaignId, userId, tier, resume, resumeFrom, videoJobId, topic, updateStatus, notifyUser } = params;
  if (resume && resumeFrom === 'finalize') {
    const db = createServerClient();
    const { data: campaign } = await db.from('campaigns').select('video_url, thumbnail_url').eq('id', campaignId).single();
    const typed = campaign as { video_url: string | null; thumbnail_url: string | null } | null;
    if (!typed?.video_url) throw new Error('Cannot resume: video URL not found');
    return { video_url: typed.video_url, thumbnail_url: typed.thumbnail_url || '' };
  }
  if (!videoJobId) throw new Error('Video Job ID missing');
  const { pollVideoStatus } = await import('@/land/video/generation/generate-campaign-video-poller');
  const videoAssets = await pollVideoStatus(videoJobId, tier, campaignId, { onUpdate: updateStatus, onNotify: notifyUser, topic });

  void captureServer({
    event: Events.FIRST_VIDEO_COMPLETED,
    distinctId: userId,
    source: 'server',
    properties: { campaign_id: campaignId, tier },
  }).catch((err) => {
    logger.warn('[generateCampaign] capture first_video_completed failed', { error: String(err) });
  });

  return videoAssets;
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
