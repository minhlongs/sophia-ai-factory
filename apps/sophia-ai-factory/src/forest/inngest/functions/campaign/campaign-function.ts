import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { TIER_RANK } from '@/seed/types';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { SmartResumeEngine } from '@/tree/gateway/smart-resume-engine';
import { notifyUserByTelegram } from '@/tree/telegram/user-notifier';
import { getExperiment } from '@/forest/ab/experiment-store';
import { NonRetriableError } from 'inngest';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import type { CampaignCreatedEventData, AffiliateOfferSelectedRow } from './types';
import { runGenerateScript, runGenerateVoiceover } from './step-prompt-runner';
import { runStartVideo, runPollVideo, runDistribution } from './asset-dispatcher';
import { runStepSafely } from './step-runner-helper';
import { runFinalizeCampaign } from './campaign-finalizer';

const resumeEngine = new SmartResumeEngine();

export const generateCampaign = inngest.createFunction(
  { id: 'generate-campaign', retries: 3 },
  { event: 'campaign.created' },
  async ({ event, step }) => {
    const eventData = event.data as unknown as CampaignCreatedEventData;
    const { campaignId, userId, topic, audience, tier, resume, resumeFrom, abExperimentId } = eventData;

    const { updateCampaignStatus, markEngineMissionFailed } = await import('@/land/video/generation/generate-campaign-db');
    const { notifyRefundRequired, notifyProviderError } = await import('@/land/video/generation/generate-campaign-refund-notify');

    if (!resume) {
      const idempotencyDb = createServerClient();
      const { data: existingCampaign } = await idempotencyDb
        .from('campaigns')
        .select('id, status')
        .eq('id', campaignId)
        .single() as { data: { id: string; status: string } | null };
      if (existingCampaign && ['processing_script', 'processing_video', 'completed'].includes(existingCampaign.status)) {
        logger.info('[generateCampaign] Campaign already processed — skipping', { campaignId, status: existingCampaign.status });
        return { skipped: true, campaignId };
      }
    }

    const updateStatus = (status: Parameters<typeof updateCampaignStatus>[1], progress: number, data?: Record<string, unknown>) =>
      updateCampaignStatus(campaignId, status, progress, data);
    const notifyUser = (message: string) => notifyUserByTelegram(userId, message);
    const stepOpts = { campaignId, markEngineMissionFailed, notifyUser };

    try {
      await runStepSafely(step, 'notify-start', async () => {
        await notifyUser(
          resume
            ? `🔄 **Sophia AI**: Resuming campaign for "${topic}" from ${resumeFrom} step...`
            : `🎬 **Sophia AI**: Starting campaign generation for "${topic}"...`,
        );
      }, stepOpts);

      const affiliateOffer = await step.run('load-affiliate-offer', async () => {
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
      });

      const script = await runStepSafely(step, 'generate-script', async () => {
        return runGenerateScript({
          campaignId, userId, topic, audience, tier, resume, resumeFrom, affiliateOffer,
          updateStatus,
          checkpoint: async (name) => { await resumeEngine.checkpoint(campaignId, name); },
          notifyRefundRequired, notifyProviderError,
        });
      }, stepOpts);

      await runStepSafely(step, 'generate-voiceover', async () => {
        return runGenerateVoiceover({
          campaignId, userId, tier, resume, resumeFrom, script,
          updateStatus,
          checkpoint: async (name) => { await resumeEngine.checkpoint(campaignId, name); },
          notifyRefundRequired, notifyProviderError, notifyUser,
        });
      }, stepOpts);

      const videoJobId = await runStepSafely(step, 'start-video-generation', async () => {
        return runStartVideo({
          campaignId, userId, tier, resume, resumeFrom,
          script: script as unknown as ScriptOutput,
          updateStatus, notifyUser, notifyRefundRequired, notifyProviderError,
        });
      }, stepOpts);

      const videoAssets = await runStepSafely(step, 'poll-video-status', async () => {
        return runPollVideo({
          campaignId, userId, tier, resume, resumeFrom, videoJobId, topic,
          updateStatus, notifyUser,
        });
      }, stepOpts);

      await runStepSafely(step, 'checkpoint-video-ready', async () => {
        await resumeEngine.checkpoint(campaignId, 'poll-video-status', { video_url: videoAssets.video_url, thumbnail_url: videoAssets.thumbnail_url });
      }, stepOpts);

      const currentTier = await step.run('validate-tier-mid-flight', async () => {
        return resolveUserTier(userId);
      });
      const eventTierRank = TIER_RANK[tier] ?? 0;
      const currentTierRank = TIER_RANK[currentTier] ?? 0;
      if (currentTierRank < eventTierRank) {
        logger.warn('[generateCampaign] Tier downgrade mid-flight — aborting distribution', {
          campaignId, userId, eventTier: tier, currentTier,
        });
        await updateCampaignStatus(campaignId, 'failed', 0, {
          error_message: `Tier downgraded mid-flight from ${tier} to ${currentTier}. Campaign aborted.`,
        }).catch((err) => {
          logger.warn('Failed to update campaign status after tier downgrade', {
            error: String(err), context: 'generateCampaign', campaignId,
          });
        });
        throw new NonRetriableError(
          `Tier downgrade mid-flight: ${tier} → ${currentTier}. Please re-run with an active tier.`,
        );
      }

      const campaignTitle = await step.run('resolve-ab-title', async () => {
        if (!abExperimentId) return topic || `Campaign ${campaignId}`;
        try {
          const experiment = await getExperiment(abExperimentId);
          if (experiment?.variantACaption) return experiment.variantACaption;
        } catch (err) {
          logger.warn('[generateCampaign] AB experiment lookup failed — using original title', {
            campaignId, abExperimentId, error: String(err),
          });
        }
        return topic || `Campaign ${campaignId}`;
      });

      const distributionResult = await runStepSafely(step, 'distribute-channels', async () => {
        const result = await runDistribution({
          campaignId, videoUrl: videoAssets.video_url, thumbnailUrl: videoAssets.thumbnail_url,
          title: campaignTitle, audience, tier, affiliateOffer,
        });
        await resumeEngine.checkpoint(campaignId, 'distribute-channels', { allSucceeded: result.allSucceeded, channelCount: result.results.length });
        return result;
      }, stepOpts);

      await runStepSafely(step, 'finalize-campaign', async () => {
        return runFinalizeCampaign({
          campaignId, userId, topic, videoAssets, distributionResult,
          updateStatus, notifyUser, resumeEngine,
        });
      }, stepOpts);

      return { success: true, campaignId };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await updateCampaignStatus(campaignId, 'failed', 0, { error_message: errorMessage });
      await notifyUser(`❌ **Campaign Failed**\nYour campaign for "${topic}" encountered an error:\n${errorMessage}`).catch((catchErr) => {
        logger.warn('Failed to notify user of campaign failure in outer catch', {
          error: String(catchErr), context: 'generateCampaign', campaignId,
        });
      });
      throw new NonRetriableError(`Campaign generation failed: ${errorMessage}`, { cause: err });
    }
  },
);
