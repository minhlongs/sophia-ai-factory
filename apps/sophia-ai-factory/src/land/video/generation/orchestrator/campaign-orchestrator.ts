import { NonRetriableError } from 'inngest';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { Tier, TIER_RANK } from '@/seed/types';
import { SmartResumeEngine } from '@/tree/gateway/smart-resume-engine';
import type { PipelineStep } from '@/tree/gateway/pipeline-step-navigator';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { markEngineMissionFailed } from '../generate-campaign-db';
import { emit } from '@/land/webhooks/emitter';
import { captureServer } from '@/tree/signals/posthog-capture';
import { Events } from '@/tree/signals/event-types';
import type { RunCampaignWorkflowArgs } from './types';
import { loadAffiliateOfferStep, runScriptStep, runVoiceoverStep, runVideoGenStep } from './render-queue-dispatcher';
import { getD1ForWebhooks, runPollVideoStep, runDistributeStep } from './callback-processor';

const resumeEngine = new SmartResumeEngine();

export async function runCampaignWorkflow(args: RunCampaignWorkflowArgs): Promise<{ success: boolean; campaignId: string; skipped?: boolean }> {
  const { campaignId, userId, topic, audience, tier, resume, resumeFrom, abVariantACaption: _abVariantACaption, abExperimentId, step, updateStatus, notifyUser } = args;

  async function runStepSafely<T>(stepName: string, fn: () => Promise<T>): Promise<T> {
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

    const affiliateOffer = await loadAffiliateOfferStep(step, campaignId);

    const script = await runStepSafely('generate-script', async () => {
      return runScriptStep({
        campaignId, userId, topic, audience, tier, resume, resumeFrom, affiliateOffer,
        updateStatus,
        checkpoint: async (name) => { await resumeEngine.checkpoint(campaignId, name as PipelineStep); },
      });
    });

    await runStepSafely('generate-voiceover', async () => {
      return runVoiceoverStep({
        campaignId, userId, tier, resume, resumeFrom, script,
        updateStatus, notifyUser,
        checkpoint: async (name) => { await resumeEngine.checkpoint(campaignId, name as PipelineStep); },
      });
    });

    const videoJobId = await runStepSafely('start-video-generation', async () => {
      return runVideoGenStep({
        campaignId, userId, tier, resume, resumeFrom, script,
        updateStatus, notifyUser,
      });
    });

    const videoAssets = await runStepSafely('poll-video-status', async () => {
      return runPollVideoStep({
        campaignId, userId, tier, resume, resumeFrom, videoJobId, topic,
        updateStatus, notifyUser,
      });
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
      const result = await runDistributeStep({
        campaignId, videoUrl: videoAssets.video_url, thumbnailUrl: videoAssets.thumbnail_url,
        title: campaignTitle, audience, tier, affiliateOffer,
      });
      await resumeEngine.checkpoint(campaignId, 'distribute-channels', { allSucceeded: result.allSucceeded, channelCount: result.results.length });
      return result;
    });

    await runStepSafely('finalize-campaign', async () => {
      await updateStatus('completed', 100, { video_url: videoAssets.video_url, thumbnail_url: videoAssets.thumbnail_url });
      const distributedChannels = distributionResult.results.filter((r) => r.success).map((r) => r.channelId).join(', ');
      const statusLine = distributionResult.allSucceeded
        ? `Published to: ${distributedChannels}`
        : `Partially published (${distributedChannels}). Some channels failed.`;
      await notifyUser(`✅ **Campaign Ready!**\nYour video for "${topic}" is ready.\n${statusLine}\n[Watch Video](${videoAssets.video_url})`);

      void captureServer({
        event: Events.CAMPAIGN_PUBLISHED,
        distinctId: userId,
        source: 'server',
        properties: { campaign_type: topic, channels: distributedChannels },
      }).catch((err) => {
        logger.warn('[runCampaignWorkflow] capture campaign_published failed', { error: String(err) });
      });

      await resumeEngine.checkpoint(campaignId, 'finalize-campaign');
      await resumeEngine.clearCheckpoints(campaignId);

      const db = getD1ForWebhooks();
      if (db) {
        const webhookEnv = { DB: db };
        emit(webhookEnv, 'mission.completed', {
          missionId: campaignId, tenantId: userId, status: 'completed',
          videoUrl: videoAssets.video_url, durationSec: null, costUsd: null,
        }, userId);
        emit(webhookEnv, 'video.ready', {
          videoId: videoAssets.video_url, missionId: campaignId, tenantId: userId,
          r2Key: null, publicUrl: videoAssets.video_url, durationSec: null,
        }, userId);
      }
    });

    return { success: true, campaignId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await updateStatus('failed', 0, { error_message: errorMessage });
    await notifyUser(`❌ **Campaign Failed**\nYour campaign for "${topic}" encountered an error:\n${errorMessage}`).catch((catchErr) => {
      logger.warn('Failed to notify user of campaign failure', { error: String(catchErr), context: 'runCampaignWorkflow' });
    });
    throw new NonRetriableError(`Campaign generation failed: ${errorMessage}`, { cause: err });
  }
}
