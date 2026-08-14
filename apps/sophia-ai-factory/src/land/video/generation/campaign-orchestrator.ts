/**
 * Pure campaign workflow — no Inngest dependencies.
 * Extracted from forest/inngest/functions/generate-campaign.ts
 */

import { NonRetriableError } from 'inngest';
import { logger } from '@/seed/utils/logger-utility';
import { ServiceFactory } from '@/land/services/factory';
import { MissingCredentialsError, ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/land/services/errors';
import { startVideoGeneration } from '@/seed/ai/video-generator';
import { type ScriptOutput } from '@/seed/ai/script-generator'
import { createServerClient } from '@/seed/db/client';
import { Tier, TIER_RANK } from '@/seed/types';
import { OpenClawGateway } from '@/tree/gateway/openclaw-gateway'
import { SmartResumeEngine } from '@/tree/gateway/smart-resume-engine';
import { YouTubeChannelAdapter } from '@/tree/gateway/adapters/youtube-channel-adapter';
import { TikTokChannelAdapter } from '@/tree/gateway/adapters/tiktok-channel-adapter';
import { TelegramNotificationAdapter } from '@/tree/gateway/adapters/telegram-notification-adapter';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { markEngineMissionFailed } from './generate-campaign-db';
import { notifyRefundRequired, notifyProviderError } from './generate-campaign-refund-notify';
import { pollVideoStatus } from './generate-campaign-video-poller';
import { emit } from '@/land/webhooks/emitter';
import { uploadVideo, refreshAccessToken } from '@/land/youtube/youtube-oauth-client';
import { publishVideo, checkPublishStatus } from '@/land/tiktok/tiktok-oauth-client';
import { captureServer } from '@/tree/signals/posthog-capture';
import { Events } from '@/tree/signals/event-types';
import type { YouTubeOAuthClient, TikTokOAuthClient } from '@/tree/types/oauth-client-types';

export interface Step {
  sleep(name: string, duration: string): Promise<void>;
  run<T>(name: string, fn: () => Promise<T>): Promise<unknown>;
}

export interface RunCampaignWorkflowArgs {
  campaignId: string;
  userId: string;
  topic: string;
  audience: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  abVariantACaption?: string;
  abExperimentId?: string;
  step: Step;
  updateStatus: (status: string, progress: number, data?: Record<string, unknown>) => Promise<void>;
  notifyUser: (message: string) => Promise<void>;
}

function getD1ForWebhooks(): D1Database | null {
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

const resumeEngine = new SmartResumeEngine();

const youtubeOAuthClient: YouTubeOAuthClient = { uploadVideo, refreshAccessToken };
const tiktokOAuthClient: TikTokOAuthClient = { publishVideo, checkPublishStatus };

function createGateway(): OpenClawGateway {
  const gateway = new OpenClawGateway({ maxRetries: 2, baseDelayMs: 2000 });
  gateway.registerChannel({ id: 'youtube', name: 'YouTube', adapter: new YouTubeChannelAdapter(youtubeOAuthClient), enabled: true, rateLimitPerHour: 6 });
  gateway.registerChannel({ id: 'tiktok', name: 'TikTok', adapter: new TikTokChannelAdapter(tiktokOAuthClient), enabled: true, rateLimitPerHour: 10 });
  gateway.registerChannel({ id: 'telegram', name: 'Telegram Notifications', adapter: new TelegramNotificationAdapter(), enabled: true, rateLimitPerHour: 60 });
  return gateway;
}

interface AffiliateOfferSelectedRow {
  short_code: string;
  offer_name: string;
  affiliate_link: string;
}

export async function runCampaignWorkflow(args: RunCampaignWorkflowArgs): Promise<{ success: boolean; campaignId: string; skipped?: boolean }> {
  const { campaignId, userId, topic, audience, tier, resume, resumeFrom, abVariantACaption: _abVariantACaption, abExperimentId, step, updateStatus, notifyUser } = args;

  async function runStepSafely<T>(
    stepName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return (await step.run(stepName, fn)) as T;
    } catch (rawErr) {
      if (rawErr instanceof NonRetriableError) throw rawErr;
      const errMsg = rawErr instanceof Error ? rawErr.message : String(rawErr);
      await markEngineMissionFailed(campaignId, `[${stepName}] ${errMsg}`).catch((err) => {
        logger.warn('Failed to mark engine mission failed during step safety net', { error: String(err), context: 'runStepSafely' });
      });
      await notifyUser(`\u{1F4E9} Campaign failed at step "${stepName}". Contact support for assistance.`).catch((err) => {
        logger.warn('Failed to notify user during step safety net', { error: String(err), context: 'runStepSafely' });
      });
      throw new NonRetriableError(`[${stepName}] ${errMsg}`, { cause: rawErr });
    }
  }

  if (!resume) {
    const idempotencyDb = createServerClient();
    const { data: existingCampaign } = await idempotencyDb
      .from('campaigns')
      .select('id, status')
      .eq('id', campaignId as string)
      .single() as { data: { id: string; status: string } | null };
    if (existingCampaign && ['processing_script', 'processing_video', 'completed'].includes(existingCampaign.status)) {
      logger.info('[generateCampaign] Campaign already processed — skipping', { campaignId, status: existingCampaign.status });
      return { success: true, campaignId, skipped: true };
    }
  }

  try {
    await runStepSafely('notify-start', async () => {
      await notifyUser(
        resume
          ? `🔄 **Sophia AI**: Resuming campaign for "${topic}" from ${resumeFrom} step...`
          : `🎬 **Sophia AI**: Starting campaign generation for "${topic}"...`,
      );
    });

    const affiliateOffer = (await step.run('load-affiliate-offer', async () => {
      try {
        const db = createServerClient();
        const { data } = await db
          .from('affiliate_offers_selected')
          .select('short_code, offer_name, affiliate_link')
          .eq('campaign_id', campaignId)
          .single();
        const row = data as AffiliateOfferSelectedRow | null;
        if (!row) return null;
        const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'}/r/${row.short_code}`;
        return { productName: row.offer_name, shortUrl };
      } catch (error) {
        logger.warn('[generate-campaign] failed to load affiliate offer for campaign', { campaignId, error: String(error) });
        return null;
      }
    })) as { productName: string; shortUrl: string } | null;

    const script = await runStepSafely('generate-script', async () => {
      if (resume && (resumeFrom === 'tts' || resumeFrom === 'video' || resumeFrom === 'finalize')) {
        const db = createServerClient();
        const { data: campaign } = await db.from('campaigns').select('script_content').eq('id', campaignId as string).single();
        const typedCampaign = campaign as { script_content: Record<string, unknown> | null } | null;
        if (!typedCampaign?.script_content) throw new Error('Cannot resume: script content not found');
        return typedCampaign.script_content;
      }
      await updateStatus('processing_script', 10);
      try {
        const scriptService = await ServiceFactory.getScriptService(userId);
        const resolvedOrgId = (await resolveOrgId(userId)) ?? userId;
        const result = await scriptService.generateScript({
          topic,
          audience,
          tier,
          orgId: resolvedOrgId,
          userId,
          affiliateOffer: affiliateOffer ?? undefined,
        });
        await updateStatus('processing_script', 35, { script_content: result });
        await resumeEngine.checkpoint(campaignId, 'generate-script');
        return result;
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key);
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err });
        }
        if (err instanceof ProviderQuotaExceededError) {
          await notifyProviderError(userId, campaignId, err.service, 'quota', err.message);
          throw new NonRetriableError(err.message, { cause: err });
        }
        if (err instanceof ProviderInvalidKeyError) {
          await notifyProviderError(userId, campaignId, err.service, 'key', err.message);
          throw new NonRetriableError(err.message, { cause: err });
        }
        throw err;
      }
    });

    await runStepSafely('generate-voiceover', async () => {
      if (resume && (resumeFrom === 'video' || resumeFrom === 'finalize')) {
        const db = createServerClient();
        const { data: campaign } = await db.from('campaigns').select('audio_url').eq('id', campaignId as string).single();
        const typedCampaign = campaign as { audio_url: string | null } | null;
        if (!typedCampaign?.audio_url) throw new Error('Cannot resume: audio URL not found');
        return typedCampaign.audio_url;
      }
      const scriptData = script as { scenes: Array<{ narration: string }> };
      const fullNarration = scriptData.scenes.map(s => s.narration).join(' ');
      await updateStatus('processing_script', 45);
      if (!resume) await notifyUser('📝 Script ready! Now generating voiceover...');
      try {
        const voiceService = await ServiceFactory.getVoiceService(userId);
        const voiceoverResult = await voiceService.generateVoiceover({ text: fullNarration, tier, userId });
        await updateStatus('processing_script', 60, { audio_url: voiceoverResult.audio_url });
        await resumeEngine.checkpoint(campaignId, 'generate-voiceover');
        return voiceoverResult.audio_url;
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key);
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err });
        }
        if (err instanceof ProviderQuotaExceededError) {
          await notifyProviderError(userId, campaignId, err.service, 'quota', err.message);
          throw new NonRetriableError(err.message, { cause: err });
        }
        if (err instanceof ProviderInvalidKeyError) {
          await notifyProviderError(userId, campaignId, err.service, 'key', err.message);
          throw new NonRetriableError(err.message, { cause: err });
        }
        throw err;
      }
    });

    const videoJobId = await runStepSafely('start-video-generation', async () => {
      if (resume && resumeFrom === 'finalize') return null;
      await updateStatus('processing_video', 70);
      if (!resume) await notifyUser('🎤 Voiceover ready! Now rendering video...');
      try {
        const jobId = await startVideoGeneration({ script: script as ScriptOutput, tier, userId });
        // Fire-and-forget PostHog event for first video started
        void captureServer({
          event: Events.FIRST_VIDEO_STARTED,
          distinctId: userId,
          source: 'server',
          properties: { campaign_id: campaignId, tier },
        }).catch((err) => {
          logger.warn('[runCampaignWorkflow] capture first_video_started failed', { error: String(err) });
        });
        return jobId;
      } catch (err) {
        if (err instanceof MissingCredentialsError) {
          await notifyRefundRequired(userId, campaignId, err.key);
          throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err });
        }
        if (err instanceof ProviderQuotaExceededError) {
          await notifyProviderError(userId, campaignId, err.service, 'quota', err.message);
          throw new NonRetriableError(err.message, { cause: err });
        }
        if (err instanceof ProviderInvalidKeyError) {
          await notifyProviderError(userId, campaignId, err.service, 'key', err.message);
          throw new NonRetriableError(err.message, { cause: err });
        }
        throw err;
      }
    });

    const videoAssets = await runStepSafely('poll-video-status', async () => {
      if (resume && resumeFrom === 'finalize') {
        const db = createServerClient();
        const { data: campaign } = await db.from('campaigns').select('video_url, thumbnail_url').eq('id', campaignId as string).single();
        const typedCampaign = campaign as { video_url: string | null; thumbnail_url: string | null } | null;
        if (!typedCampaign?.video_url) throw new Error('Cannot resume: video URL not found');
        return { video_url: typedCampaign.video_url, thumbnail_url: typedCampaign.thumbnail_url || '' };
      }
      if (!videoJobId) throw new Error('Video Job ID missing');
      return await pollVideoStatus(videoJobId, tier, campaignId, { onUpdate: updateStatus, onNotify: notifyUser, topic });
    });

    // Fire-and-forget PostHog event for first video completed
    void captureServer({
      event: Events.FIRST_VIDEO_COMPLETED,
      distinctId: userId,
      source: 'server',
      properties: { campaign_id: campaignId, tier },
    }).catch((err) => {
      logger.warn('[runCampaignWorkflow] capture first_video_completed failed', { error: String(err) });
    });

    await runStepSafely('checkpoint-video-ready', async () => {
      await resumeEngine.checkpoint(campaignId, 'poll-video-status', { video_url: videoAssets.video_url, thumbnail_url: videoAssets.thumbnail_url });
    });

    const currentTier = (await step.run('validate-tier-mid-flight', async () => {
      return resolveUserTier(userId);
    })) as Tier;

    const eventTierRank = TIER_RANK[tier] ?? 0;
    const currentTierRank = TIER_RANK[currentTier] ?? 0;
    if (currentTierRank < eventTierRank) {
      logger.warn('[generateCampaign] Tier downgrade mid-flight — aborting distribution', {
        campaignId, userId, eventTier: tier, currentTier,
      });
      await updateStatus('failed', 0, {
        error_message: `Tier downgraded mid-flight from ${tier} to ${currentTier}. Campaign aborted.`,
      }).catch((err) => {
        logger.warn('Failed to update status after tier downgrade', { error: String(err), context: 'runCampaignWorkflow' });
      });
      throw new NonRetriableError(
        `Tier downgrade mid-flight: ${tier} → ${currentTier}. Please re-run with an active tier.`,
      );
    }

    // Phase 03: Resolve A/B variant A caption as campaign title
    const campaignTitle = (await step.run('resolve-ab-title', async () => {
      if (!abExperimentId) return topic || `Campaign ${campaignId}`;
      try {
        const db = createServerClient();
  const { data: expData } = await db
  .from('ab_experiments')
  .select('variant_a_caption')
  .eq('id', abExperimentId)
  .maybeSingle();
if (expData?.variant_a_caption) return expData.variant_a_caption;
      } catch (err) {
        logger.warn('[runCampaignWorkflow] AB experiment lookup failed — using original title', {
          campaignId, abExperimentId, error: String(err),
        });
      }
      return topic || `Campaign ${campaignId}`;
    })) as string;

    const distributionResult = await runStepSafely('distribute-channels', async () => {
      const gateway = createGateway();
      const baseDesc = `AI-generated video content for ${audience || 'general audience'}`;
      const description = affiliateOffer
        ? `${baseDesc}\n\n👉 ${affiliateOffer.shortUrl}`
        : baseDesc;
      const payload = {
        campaignId,
        videoUrl: videoAssets.video_url,
        thumbnailUrl: videoAssets.thumbnail_url || undefined,
        title: campaignTitle,
        description,
        tags: ['sophia-ai', 'auto-generated', tier.toLowerCase()],
      };
      const result = await gateway.distribute(payload);
      if (!result.allSucceeded) {
        const healed = await gateway.selfHeal({ ...payload, description }, result);
        await resumeEngine.checkpoint(campaignId, 'distribute-channels', { allSucceeded: healed.allSucceeded, channelCount: healed.results.length });
        return healed;
      }
      await resumeEngine.checkpoint(campaignId, 'distribute-channels', { allSucceeded: result.allSucceeded, channelCount: result.results.length });
      return result;
    });

    await runStepSafely('finalize-campaign', async () => {
      await updateStatus('completed', 100, { video_url: videoAssets.video_url, thumbnail_url: videoAssets.thumbnail_url });
      const distributedChannels = distributionResult.results.filter(r => r.success).map(r => r.channelId).join(', ');
      const statusLine = distributionResult.allSucceeded
        ? `Published to: ${distributedChannels}`
        : `Partially published (${distributedChannels}). Some channels failed.`;
      await notifyUser(`✅ **Campaign Ready!**\nYour video for "${topic}" is ready.\n${statusLine}\n[Watch Video](${videoAssets.video_url})`);

      // Fire-and-forget PostHog event for campaign published
      void captureServer({
        event: Events.CAMPAIGN_PUBLISHED,
        distinctId: userId,
        source: 'server',
        properties: {
          campaign_type: topic,
          channels: distributedChannels,
        },
      }).catch((err) => {
        logger.warn('[runCampaignWorkflow] capture campaign_published failed', { error: String(err) });
      });

      await resumeEngine.checkpoint(campaignId, 'finalize-campaign');
      await resumeEngine.clearCheckpoints(campaignId);

      const db = getD1ForWebhooks();
      if (db) {
        const webhookEnv = { DB: db };
        emit(webhookEnv, 'mission.completed', {
          missionId: campaignId,
          tenantId: userId,
          status: 'completed',
          videoUrl: videoAssets.video_url,
          durationSec: null,
          costUsd: null,
        }, userId);
        emit(webhookEnv, 'video.ready', {
          videoId: videoAssets.video_url,
          missionId: campaignId,
          tenantId: userId,
          r2Key: null,
          publicUrl: videoAssets.video_url,
          durationSec: null,
        }, userId);
      }
    });

    return { success: true, campaignId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await updateStatus('failed', 0, { error_message: errorMessage });
    await notifyUser(`❌ **Campaign Failed**\nYour campaign for "${topic}" encountered an error:\n${errorMessage}`).catch((err) => {
      logger.warn('Failed to notify user of campaign failure', { error: String(err), context: 'runCampaignWorkflow' });
    });
    throw new NonRetriableError(`Campaign generation failed: ${errorMessage}`, { cause: err });
  }
}
