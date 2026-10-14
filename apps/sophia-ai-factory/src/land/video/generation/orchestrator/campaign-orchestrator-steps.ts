import { NonRetriableError } from 'inngest';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { Tier, TIER_RANK } from '@/seed/types';
import { SmartResumeEngine } from '@/tree/gateway/smart-resume-engine';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { emit } from '@/land/webhooks/emitter';
import { captureServer } from '@/tree/signals/posthog-capture';
import { Events } from '@/tree/signals/event-types';
import type { RunCampaignWorkflowArgs } from './types';
import { getD1ForWebhooks } from './callback-processor';

export async function isCampaignAlreadyProcessed(
  campaignId: string,
  resume?: boolean,
): Promise<boolean> {
  if (resume) return false;
  const idempotencyDb = createServerClient();
  const { data: existingCampaign } = (await idempotencyDb
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .single()) as { data: { id: string; status: string } | null };

  if (
    existingCampaign &&
    ['processing_script', 'processing_video', 'completed'].includes(existingCampaign.status)
  ) {
    logger.info('[generateCampaign] Campaign already processed — skipping', {
      campaignId,
      status: existingCampaign.status,
    });
    return true;
  }
  return false;
}

export async function assertMidFlightTierNotDowngraded(
  step: RunCampaignWorkflowArgs['step'],
  campaignId: string,
  userId: string,
  tier: Tier,
  updateStatus: RunCampaignWorkflowArgs['updateStatus'],
): Promise<void> {
  const currentTier = (await step.run('validate-tier-mid-flight', async () => {
    return resolveUserTier(userId);
  })) as Tier;

  const eventTierRank = TIER_RANK[tier] ?? 0;
  const currentTierRank = TIER_RANK[currentTier] ?? 0;
  if (currentTierRank < eventTierRank) {
    logger.warn('[generateCampaign] Tier downgrade mid-flight — aborting distribution', {
      campaignId,
      userId,
      eventTier: tier,
      currentTier,
    });
    await updateStatus('failed', 0, {
      error_message: `Tier downgraded mid-flight from ${tier} to ${currentTier}. Campaign aborted.`,
    }).catch((err) => {
      logger.warn('Failed to update status after tier downgrade', {
        error: String(err),
        context: 'runCampaignWorkflow',
      });
    });
    throw new NonRetriableError(
      `Tier downgrade mid-flight: ${tier} → ${currentTier}. Please re-run with an active tier.`,
    );
  }
}

export async function resolveAbCampaignTitle(
  step: RunCampaignWorkflowArgs['step'],
  campaignId: string,
  topic: string,
  abExperimentId?: string,
): Promise<string> {
  return (await step.run('resolve-ab-title', async () => {
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
        campaignId,
        abExperimentId,
        error: String(err),
      });
    }
    return topic || `Campaign ${campaignId}`;
  })) as string;
}

export async function finalizeCampaignStep(params: {
  campaignId: string;
  userId: string;
  topic: string;
  videoAssets: { video_url: string; thumbnail_url?: string };
  distributionResult: { allSucceeded: boolean; results: Array<{ channelId: string; success: boolean }> };
  updateStatus: RunCampaignWorkflowArgs['updateStatus'];
  notifyUser: RunCampaignWorkflowArgs['notifyUser'];
  resumeEngine: SmartResumeEngine;
}): Promise<void> {
  const { campaignId, userId, topic, videoAssets, distributionResult, updateStatus, notifyUser, resumeEngine } = params;
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
}
