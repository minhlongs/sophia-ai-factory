import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { captureServer } from '@/forest/telemetry/posthog-capture';
import { Events } from '@/forest/telemetry/event-types';
import type { Tier } from '@/seed/types';
import type { StatusUpdater, UserNotifier } from './types';

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

export async function runPollVideo(
  params: PollVideoParams,
): Promise<{ video_url: string; thumbnail_url: string }> {
  const { campaignId, userId, tier, resume, resumeFrom, videoJobId, topic, updateStatus, notifyUser } = params;
  if (resume && resumeFrom === 'finalize') {
    const db = createServerClient();
    const { data: campaign } = await db
      .from('campaigns')
      .select('video_url, thumbnail_url')
      .eq('id', campaignId)
      .single();
    const typed = campaign as { video_url: string | null; thumbnail_url: string | null } | null;
    if (!typed?.video_url) throw new Error('Cannot resume: video URL not found');
    return { video_url: typed.video_url, thumbnail_url: typed.thumbnail_url || '' };
  }
  if (!videoJobId) throw new Error('Video Job ID missing');
  const { pollVideoStatus } = await import('@/land/video/generation/generate-campaign-video-poller');
  const videoAssets = await pollVideoStatus(videoJobId, tier, campaignId, {
    onUpdate: updateStatus,
    onNotify: notifyUser,
    topic,
  });

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
