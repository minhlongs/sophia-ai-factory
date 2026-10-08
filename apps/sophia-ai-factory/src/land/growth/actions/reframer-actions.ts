/**
 * @file reframer-actions.ts
 * @description Server Actions for Saliency Video Re-Framing & Kinetic Subtitles
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  computeSmoothedCropWindows,
  generateKineticSubtitleTokens,
} from '@/tree/reframe/saliency-reframer-engine';
import type {
  AspectRatio,
  KeyframeFocalPoint,
  ReframeJobOutput,
} from '@/seed/types/growth-triad-v7-types';

export async function processVideoReframeAction(params: {
  videoId: string;
  sourceAspect: AspectRatio;
  targetAspect: AspectRatio;
  keyframes: KeyframeFocalPoint[];
  transcript: Array<{ text: string; startSec: number; endSec: number }>;
}): Promise<
  | { success: true; output: ReframeJobOutput }
  | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  const { cropWindows, jitterScore } = computeSmoothedCropWindows(
    params.keyframes,
    params.sourceAspect,
    params.targetAspect,
    0.85
  );

  const tokens = generateKineticSubtitleTokens(params.transcript);

  const output: ReframeJobOutput = {
    videoId: params.videoId,
    sourceAspect: params.sourceAspect,
    targetAspect: params.targetAspect,
    cropWindows,
    tokens,
    jitterScore,
  };

  const db = createServerClient();
  const now = Date.now();
  const jobId = `reframe_${now}_${Math.random().toString(36).substring(2, 7)}`;

  await db
    .prepare(
      `INSERT INTO reframe_render_jobs (
         id, video_id, source_aspect, target_aspect,
         jitter_score, crop_windows_json, kinetic_tokens_json,
         status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`
    )
    .bind(
      jobId,
      params.videoId,
      params.sourceAspect,
      params.targetAspect,
      jitterScore,
      JSON.stringify(cropWindows),
      JSON.stringify(tokens),
      now,
      now
    )
    .run();

  await inngest.send({
    name: 'reframe.aspect.rendered',
    data: {
      videoId: params.videoId,
      targetAspect: params.targetAspect,
      jitterScore,
      tokenCount: tokens.length,
    },
  });

  return { success: true, output };
}
