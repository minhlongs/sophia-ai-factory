/**
 * @file thumbnail-actions.ts
 * @description Server Actions for Thumbnail Visual Saliency Scoring & CTR Gaze Estimation
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { evaluateThumbnailSaliency } from '@/tree/thumbnail/thumbnail-saliency-engine';
import type {
  ThumbnailGazeInput,
  SaliencyReport,
} from '@/seed/types/growth-triad-v7-types';

export async function auditThumbnailGazeAction(
  params: ThumbnailGazeInput
): Promise<
  | { success: true; analysisId: string; report: SaliencyReport }
  | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  const report = evaluateThumbnailSaliency(params);

  const db = createServerClient();
  const now = Date.now();
  const analysisId = `gaze_${now}_${Math.random().toString(36).substring(2, 7)}`;

  await db
    .prepare(
      `INSERT INTO thumbnail_gaze_analyses (
         id, thumbnail_id, luminance_contrast, face_prominence,
         color_saturation, rule_of_thirds, saliency_score,
         predicted_ctr_pct, gaze_grade, recommendations_json,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      analysisId,
      params.thumbnailId,
      params.luminanceContrastRatio,
      params.faceProminenceIndex,
      params.colorSaturation,
      params.ruleOfThirdsAdherence,
      report.saliencyScore,
      report.predictedCtrPct,
      report.gazeFixationGrade,
      JSON.stringify(report.recommendations),
      now,
      now
    )
    .run();

  await inngest.send({
    name: 'thumbnail.gaze.scored',
    data: {
      thumbnailId: params.thumbnailId,
      saliencyScore: report.saliencyScore,
      predictedCtrPct: report.predictedCtrPct,
      gazeGrade: report.gazeFixationGrade,
    },
  });

  return { success: true, analysisId, report };
}
