/**
 * @file retention-auto-trim-job.ts
 * @description Inngest background job for persisting video retention cliff analysis & trim alerts
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const retentionAutoTrimJob = inngest.createFunction(
  {
    id: 'growth-retention-auto-trim-job',
    name: 'Growth: Retention Auto-Trim Job',
  },
  { event: 'retention.cliff.trimmed' },
  async ({ event, step }) => {
    const { videoId, cliffStartSec, trimDurationSec, thirtySecRetention } = event.data;

    await step.run('record-retention-cliff-analysis', async () => {
      logger.info('Processing video retention cliff trim event', {
        videoId,
        cliffStartSec,
        trimDurationSec,
        thirtySecRetention,
      });

      const db = createServerClient();
      const now = Date.now();
      const reportId = `ret_${now}_${Math.random().toString(36).substring(2, 7)}`;

      await db
        .prepare(
          `INSERT INTO retention_survival_reports (
             id, video_id, sample_size, thirty_sec_retention,
             cliffs_json, status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, 'TRIM_RECOMMENDED', ?, ?)`
        )
        .bind(
          reportId,
          videoId,
          1000,
          thirtySecRetention,
          JSON.stringify([{ start: cliffStartSec, trimSec: trimDurationSec }]),
          now,
          now
        )
        .run();

      return { reportId, videoId };
    });

    return { success: true, videoId };
  }
);
