/**
 * Finalization and cost tracking steps for video generation.
 *
 * @module forest/inngest/functions/video-generate-finalize
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { computeTtsCost, computeVisualCost } from '@/land/video/pipeline-pricing';
import { insertAiPromptVideo } from '@/seed/db/repositories/videos-repo';

export async function updateEngineMission(params: {
  missionId: string;
  muxedUrl: string;
  audioDurationSec: number;
  wanJobId?: string;
}): Promise<void> {
  const db = createServerClient();
  await db.from('engine_missions').update({
    status: 'succeeded',
    result: JSON.stringify({ output_video_url: params.muxedUrl, audio_duration_sec: params.audioDurationSec }),
    output_video_url: params.muxedUrl,
    output_audio_url: null,
    video_job_id: params.wanJobId,
    completed_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
  }).eq('id', params.missionId);
  logger.info('[videoGenerate] engine_mission updated to succeeded', { missionId: params.missionId });
}

export async function recordGalleryVideo(params: {
  userId: string;
  missionId: string;
  videoUrl: string;
  r2Key: string;
}): Promise<{ videoId: string | null }> {
  try {
    const res = await insertAiPromptVideo({
      userId: params.userId,
      missionId: params.missionId,
      videoUrl: params.videoUrl,
      r2Key: params.r2Key,
    });
    return { videoId: res.videoId };
  } catch (err) {
    logger.error('[videoGenerate] insert-videos-row failed (non-fatal)', err instanceof Error ? err : new Error(String(err)), { missionId: params.missionId });
    return { videoId: null };
  }
}

export async function recordGenerationUsage(params: {
  missionId: string;
  ttsProvider: string;
  selectedVisualProvider: string;
  audioDurationSec: number;
}): Promise<void> {
  const ttsCostUsd = computeTtsCost(params.ttsProvider);
  const visualCostUsd = computeVisualCost(params.selectedVisualProvider, params.audioDurationSec);
  const totalCostUsd = ttsCostUsd + visualCostUsd;
  const providers = `tts:${params.ttsProvider},visual:${params.selectedVisualProvider}`;

  await recordCost({
    jobId: params.missionId,
    stage: 'video-generate',
    provider: providers,
    units: 1,
    costUsd: totalCostUsd,
  });
  logger.info('[videoGenerate] Usage cost recorded', {
    missionId: params.missionId,
    costUsd: totalCostUsd,
    ttsCostUsd,
    visualCostUsd,
    ttsProvider: params.ttsProvider,
    visualProvider: params.selectedVisualProvider,
  });
}
