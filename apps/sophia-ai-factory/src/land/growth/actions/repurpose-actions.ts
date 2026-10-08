/**
 * @file repurpose-actions.ts
 * @description Server Action for Saliency-Based Video Aspect Repurposing
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  calculateSaliencyCrop,
  evaluateSaliencyHookScore,
} from '@/tree/repurposing/saliency-cropper-fsm';
import type { RepurposeTargetFormat } from '@/seed/types/growth-triad-v4-types';

export async function dispatchRepurposeAction(params: {
  sourceVideoId: string;
  sourceWidth: number;
  sourceHeight: number;
  focalPointX: number;
  focalPointY: number;
  targetFormat: RepurposeTargetFormat;
  motionVariance: number;
  contrastRatio: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const cropBox = calculateSaliencyCrop({
    sourceWidth: params.sourceWidth,
    sourceHeight: params.sourceHeight,
    focalPointX: params.focalPointX,
    focalPointY: params.focalPointY,
    targetFormat: params.targetFormat,
  });

  const saliencyScore = evaluateSaliencyHookScore(
    params.motionVariance,
    params.contrastRatio
  );

  const now = Date.now();
  const recordId = `rep_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const db = createServerClient();

  await db
    .prepare(
      `INSERT INTO viral_repurpose_records (
         id, user_id, source_video_id, target_format,
         saliency_hook_score, focal_x, focal_y, crop_box_json,
         status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      recordId,
      user.id,
      params.sourceVideoId,
      params.targetFormat,
      saliencyScore,
      params.focalPointX,
      params.focalPointY,
      JSON.stringify(cropBox),
      'PENDING',
      now
    )
    .run();

  await inngest.send({
    name: 'viral.repurpose.dispatched',
    data: {
      userId: user.id,
      recordId,
      sourceVideoId: params.sourceVideoId,
      targetFormat: params.targetFormat,
      saliencyScore,
    },
  });

  return {
    success: true as const,
    recordId,
    cropBox,
    saliencyScore,
  };
}
