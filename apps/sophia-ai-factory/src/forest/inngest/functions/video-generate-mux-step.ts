/**
 * Video Generation Step & Checkpoint Helpers (seed-only dependencies)
 *
 * Layer: forest/inngest/functions
 * @module forest/inngest/functions/video-generate-mux-step
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getBrandKit } from '@/seed/db/repositories/brand-kits-repo';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getUserRoutingStrategy, getDefaultStrategyForTier } from '@/seed/db/get-user-routing-strategy';
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
  await writeStageCheckpoint(missionId, 'mux_audio_video', 'completed', tenantId, {
    render_report: {
      finalR2Key: muxOutputKey,
      finalUrl,
      durationMs,
      muxedAt: new Date().toISOString(),
      brandKitApplied: false,
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
