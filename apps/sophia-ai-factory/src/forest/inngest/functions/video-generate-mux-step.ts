/**
 * Video Generation Step & Checkpoint Helpers
 *
 * Layer: forest/inngest/functions
 * @module forest/inngest/functions/video-generate-mux-step
 */

import { createServerClient } from '@/seed/db/client';
import { SophiaVideoTimelineSchema, type SophiaVideoTimeline } from '@/seed/types/video-timeline-schema';
import { logger } from '@/seed/utils/logger-utility';
import { getBrandKit } from '@/seed/db/repositories/brand-kits-repo';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getUserRoutingStrategy, getDefaultStrategyForTier } from '@/seed/db/get-user-routing-strategy';
import {
  createInMemorySegmentCache,
  createR2SegmentCache,
  createVideoRenderer,
  type R2LikeSegmentBucket,
  type VideoRenderOutput,
} from '@/tree/video/render/video-renderer-port';
import {
  writeStageCheckpoint,
  getVideoBucket,
  uploadBufferToR2,
  downloadToBuffer,
} from './video-generate-helpers';

export async function isMissionAlreadyProcessed(missionId: string): Promise<boolean> {
  const idempotencyDb = createServerClient();
  const { data: existingMission } = await idempotencyDb
    .from('engine_missions')
    .select('id, status')
    .eq('id', missionId)
    .single();
  if (existingMission && (existingMission.status === 'succeeded' || existingMission.status === 'running')) {
    logger.info('[videoGenerate] Mission already processed — skipping', {
      missionId,
      status: existingMission.status,
    });
    return true;
  }
  return false;
}

export function parseVideoInputStep(data: {
  missionId?: string;
  tenantId: string;
  userId: string;
  prompt?: string;
  voiceoverText?: string;
}) {
  if (!data.missionId) throw new Error('[videoGenerate] missionId is required');
  if (!data.prompt) throw new Error('[videoGenerate] prompt is required');
  return {
    missionId: data.missionId,
    tenantId: data.tenantId,
    userId: data.userId,
    prompt: data.prompt,
    voiceoverText: data.voiceoverText ?? data.prompt,
  };
}

export async function resolveRoutingStrategyStep(userId: string): Promise<string> {
  const userStrategy = await getUserRoutingStrategy(userId);
  if (userStrategy) return userStrategy;
  const tier = await resolveUserTier(userId);
  return getDefaultStrategyForTier(tier);
}

export async function downloadAndUploadVideoStep(
  finalVideoUrl: string,
  videoR2Key: string,
): Promise<void> {
  const videoBuffer = await downloadToBuffer(finalVideoUrl);
  await uploadBufferToR2(videoR2Key, videoBuffer, 'video/mp4');
  logger.info('[videoGenerate] Video uploaded to R2', { videoR2Key });
}

export async function resolveMuxContext(
  userId: string,
  videoR2Key: string,
  audioR2Key: string,
): Promise<{
  base: string | null;
  videoPublicUrl: string;
  audioPublicUrl: string;
  hasBrandKitLogo: boolean;
}> {
  const ref = await getVideoBucket();
  const base = ref?.publicBaseUrl?.replace(/\/$/, '') ?? null;
  const videoPublicUrl = base ? `${base}/${videoR2Key}` : videoR2Key;
  const audioPublicUrl = base ? `${base}/${audioR2Key}` : audioR2Key;
  const brandKit = await getBrandKit(userId);
  return {
    base,
    videoPublicUrl,
    audioPublicUrl,
    hasBrandKitLogo: Boolean(brandKit?.logo_r2_key),
  };
}

function isR2SegmentBucket(candidate: unknown): candidate is R2LikeSegmentBucket {
  if (!candidate || typeof candidate !== 'object') return false;
  const record = candidate as Partial<R2LikeSegmentBucket>;
  return typeof record.get === 'function' && typeof record.put === 'function';
}

async function renderSegmentedTimelineManifest(params: {
  missionId: string;
  tenantId: string;
  finalUrl: string;
  durationMs: number;
}): Promise<VideoRenderOutput | null> {
  const { missionId, tenantId, finalUrl, durationMs } = params;
  if (!tenantId?.trim()) return null;
  try {
    const bucketRef = await getVideoBucket();
    const cacheStore = isR2SegmentBucket(bucketRef?.bucket)
      ? createR2SegmentCache(bucketRef.bucket, tenantId)
      : createInMemorySegmentCache();
    const durationInFrames = Math.max(30, Math.round((Math.max(durationMs, 1000) / 1000) * 30));
    const isHttpUrl = finalUrl.startsWith('http://') || finalUrl.startsWith('https://');
    const timeline: SophiaVideoTimeline = SophiaVideoTimelineSchema.parse({
      timelineId: missionId,
      tenantId,
      title: `Mission ${missionId}`.slice(0, 160),
      scenes: [
        {
          sceneId: 'scene_primary',
          kind: 'GENERATIVE_HOOK_BROLL',
          headline: `Mission ${missionId}`.slice(0, 200),
          startFrame: 0,
          durationInFrames,
          assetUrl: isHttpUrl ? finalUrl : undefined,
        },
      ],
    });
    const renderer = createVideoRenderer('hyperframes', { cacheStore });
    return await renderer.renderTimeline(timeline);
  } catch (err) {
    logger.warn('[videoGenerate] Segmented timeline manifest skipped (non-fatal)', {
      missionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function writeMuxStageCheckpoint(params: {
  missionId: string;
  tenantId: string;
  audioR2Key: string;
  videoR2Key: string;
  muxOutputKey: string;
  finalUrl: string;
  durationMs: number;
}): Promise<void> {
  const { missionId, tenantId, audioR2Key, videoR2Key, muxOutputKey, finalUrl, durationMs } = params;
  const timelineRender = await renderSegmentedTimelineManifest({
    missionId,
    tenantId,
    finalUrl,
    durationMs,
  });

  await writeStageCheckpoint(missionId, 'mux_audio_video', 'completed', tenantId, {
    render_report: {
      finalR2Key: muxOutputKey,
      finalUrl,
      durationMs,
      muxedAt: new Date().toISOString(),
      brandKitApplied: false,
      ...(timelineRender
        ? {
            timelineEngine: timelineRender.engine,
            timelineOutputKey: timelineRender.outputUrl,
            cacheHitRatio: timelineRender.cacheHitRatio,
            segments: timelineRender.segments,
          }
        : {}),
    },
    asset_manifest: {
      audioR2Key,
      videoR2Key,
      brandKitApplied: false,
      assets: [
        { type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' },
        { type: 'video', r2Key: videoR2Key, mimeType: 'video/mp4' },
        { type: 'video', r2Key: muxOutputKey, mimeType: 'video/mp4' },
      ],
    },
  });
}
