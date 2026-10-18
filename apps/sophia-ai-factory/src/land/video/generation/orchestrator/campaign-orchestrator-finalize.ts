import { logger } from '@/seed/utils/logger-utility';
import { SmartResumeEngine } from '@/tree/gateway/smart-resume-engine';
import { emit } from '@/land/webhooks/emitter';
import { captureServer } from '@/tree/signals/posthog-capture';
import { Events } from '@/tree/signals/event-types';
import type { RunCampaignWorkflowArgs } from './types';
import { getD1ForWebhooks } from './callback-processor';

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
