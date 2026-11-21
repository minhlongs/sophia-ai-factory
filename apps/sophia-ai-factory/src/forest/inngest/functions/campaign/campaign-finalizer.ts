import { logger } from '@/seed/utils/logger-utility';
import { captureServer } from '@/forest/telemetry/posthog-capture';
import { Events } from '@/forest/telemetry/event-types';
import type { SmartResumeEngine } from '@/tree/gateway/smart-resume-engine';
import { getD1ForWebhooks } from './asset-dispatcher';
import type { VideoAssets, DistributionResult, StatusUpdater } from './types';

export interface FinalizeTextOnlyCampaignArgs {
  campaignId: string;
  userId: string;
  topic: string;
  script: Record<string, unknown>;
  updateStatus: StatusUpdater;
  notifyUser: (msg: string) => Promise<unknown>;
  resumeEngine: SmartResumeEngine;
}

/**
 * Finalizes an Option A text-only campaign without cloud video rendering
 * or public social auto-publishing. Persists the structured script JSON
 * into `campaigns.script_content` and marks the campaign completed.
 */
export async function runFinalizeTextOnlyCampaign(
  args: FinalizeTextOnlyCampaignArgs,
): Promise<void> {
  const { campaignId, topic, script, updateStatus, notifyUser, resumeEngine } = args;

  await updateStatus('completed', 100, {
    script_content: JSON.stringify(script),
  });

  try {
    await notifyUser(
      `✅ **Campaign Script Ready!**\nYour script for "${topic}" is ready for private export (text-only delivery, 0 cloud video renders).\n**Kịch bản chiến dịch đã sẵn sàng!**\nKịch bản cho "${topic}" đã sẵn sàng để tải xuống riêng tư (chỉ có văn bản, không tạo video trên đám mây).`,
    );
  } catch (error) {
    logger.warn('[generateCampaign] Text-only completion notification failed', {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Persisted completion is authoritative; resume housekeeping must not invalidate delivery.
  try {
    await resumeEngine.checkpoint(campaignId, 'finalize-campaign');
  } catch (error) {
    logger.warn('[generateCampaign] Text-only completion checkpoint failed', {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    await resumeEngine.clearCheckpoints(campaignId);
  } catch (error) {
    logger.warn('[generateCampaign] Text-only checkpoint cleanup failed', {
      campaignId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface FinalizeCampaignArgs {
  campaignId: string;
  userId: string;
  topic: string;
  videoAssets: VideoAssets;
  distributionResult: DistributionResult;
  updateStatus: StatusUpdater;
  notifyUser: (msg: string) => Promise<unknown>;
  resumeEngine: SmartResumeEngine;
}

export async function runFinalizeCampaign(args: FinalizeCampaignArgs): Promise<void> {
  const { campaignId, userId, topic, videoAssets, distributionResult, updateStatus, notifyUser, resumeEngine } = args;
  const { emit } = await import('@/land/webhooks/emitter');

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
    logger.warn('[generateCampaign] capture campaign_published failed', { error: String(err) });
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
