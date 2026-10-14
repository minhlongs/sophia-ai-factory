import { NonRetriableError } from 'inngest';
import { logger } from '@/seed/utils/logger-utility';
import { SmartResumeEngine } from '@/tree/gateway/smart-resume-engine';
import type { PipelineStep } from '@/tree/gateway/pipeline-step-navigator';
import { markEngineMissionFailed } from '../generate-campaign-db';
import type { RunCampaignWorkflowArgs } from './types';
import { loadAffiliateOfferStep, runScriptStep, runVoiceoverStep, runVideoGenStep } from './render-queue-dispatcher';
import { runPollVideoStep, runDistributeStep } from './callback-processor';
import {
  isCampaignAlreadyProcessed,
  assertMidFlightTierNotDowngraded,
  resolveAbCampaignTitle,
  finalizeCampaignStep,
} from './campaign-orchestrator-steps';

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

  if (await isCampaignAlreadyProcessed(campaignId as string, resume)) {
    return { success: true, campaignId, skipped: true };
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

    await assertMidFlightTierNotDowngraded(step, campaignId, userId, tier, updateStatus);

    const campaignTitle = await resolveAbCampaignTitle(step, campaignId, topic, abExperimentId);

    const distributionResult = await runStepSafely('distribute-channels', async () => {
      const result = await runDistributeStep({
        campaignId, videoUrl: videoAssets.video_url, thumbnailUrl: videoAssets.thumbnail_url,
        title: campaignTitle, audience, tier, affiliateOffer,
      });
      await resumeEngine.checkpoint(campaignId, 'distribute-channels', { allSucceeded: result.allSucceeded, channelCount: result.results.length });
      return result;
    });

    await runStepSafely('finalize-campaign', async () => {
      await finalizeCampaignStep({
        campaignId, userId, topic, videoAssets, distributionResult,
        updateStatus, notifyUser, resumeEngine,
      });
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
