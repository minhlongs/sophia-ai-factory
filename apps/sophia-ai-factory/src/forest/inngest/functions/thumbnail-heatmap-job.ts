/**
 * @file thumbnail-heatmap-job.ts
 * @description Inngest background job for logging visual saliency thumbnail gaze matrix audits
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const thumbnailHeatmapJob = inngest.createFunction(
  {
    id: 'growth-thumbnail-heatmap-job',
    name: 'Growth: Thumbnail Heatmap Job',
  },
  { event: 'thumbnail.gaze.scored' },
  async ({ event, step }) => {
    const { thumbnailId, saliencyScore, predictedCtrPct, gazeGrade } = event.data;

    await step.run('audit-thumbnail-gaze-score', async () => {
      logger.info('Logging thumbnail gaze saliency score', {
        thumbnailId,
        saliencyScore,
        predictedCtrPct,
        gazeGrade,
      });

      const db = createServerClient();
      const now = Date.now();
      const auditId = `aud_thumb_${now}_${Math.random().toString(36).substring(2, 7)}`;

      await db
        .prepare(
          `INSERT INTO thumbnail_gaze_analyses (
             id, thumbnail_id, luminance_contrast, face_prominence,
             color_saturation, rule_of_thirds, saliency_score,
             predicted_ctr_pct, gaze_grade, recommendations_json,
             created_at, updated_at
           ) VALUES (?, ?, 7.5, 0.8, 0.8, 0.85, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          auditId,
          thumbnailId,
          saliencyScore,
          predictedCtrPct,
          gazeGrade,
          JSON.stringify(['Optimized gaze focus points']),
          now,
          now
        )
        .run();

      return { auditId, logged: true };
    });

    return { success: true, thumbnailId, predictedCtrPct };
  }
);
