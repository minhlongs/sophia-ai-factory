/**
 * @file saliency-reframe-job.ts
 * @description Inngest background job for logging 9:16 vertical video re-frame render completions
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const saliencyReframeJob = inngest.createFunction(
  {
    id: 'growth-saliency-reframe-job',
    name: 'Growth: Saliency Reframe Job',
  },
  { event: 'reframe.aspect.rendered' },
  async ({ event, step }) => {
    const { videoId, targetAspect, jitterScore, tokenCount } = event.data;

    await step.run('audit-reframe-render-job', async () => {
      logger.info('Logging vertical re-frame render result', {
        videoId,
        targetAspect,
        jitterScore,
        tokenCount,
      });

      const db = createServerClient();
      const now = Date.now();
      const jobId = `ref_job_${now}_${Math.random().toString(36).substring(2, 7)}`;

      await db
        .prepare(
          `INSERT INTO reframe_render_jobs (
             id, video_id, source_aspect, target_aspect,
             jitter_score, crop_windows_json, kinetic_tokens_json,
             status, created_at, updated_at
           ) VALUES (?, ?, '16:9', ?, ?, ?, ?, 'COMPLETED', ?, ?)`
        )
        .bind(
          jobId,
          videoId,
          targetAspect,
          jitterScore,
          JSON.stringify([{ t: 0, w: 0.5625, h: 1.0 }]),
          JSON.stringify({ tokens: tokenCount }),
          now,
          now
        )
        .run();

      return { jobId, rendered: true };
    });

    return { success: true, videoId, jitterScore };
  }
);
