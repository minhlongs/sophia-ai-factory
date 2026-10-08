/**
 * @file seo-surge-monitor-job.ts
 * @description Inngest background job for search velocity anomaly processing & SEO metadata caching
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const seoSurgeMonitorJob = inngest.createFunction(
  {
    id: 'growth-seo-surge-monitor-job',
    name: 'Growth: SEO Surge Monitor Job',
  },
  { event: 'seo.surge.detected' },
  async ({ event, step }) => {
    const { keyword, zScore, currentVelocity, intent, generatedTitle } = event.data;

    await step.run('persist-seo-surge-record', async () => {
      logger.info('SEO Search Surge detected, updating analytics record', {
        keyword,
        zScore,
        currentVelocity,
        intent,
      });

      const db = createServerClient();
      const now = Date.now();
      const recordId = `surge_${now}_${Math.random().toString(36).substring(2, 7)}`;

      await db
        .prepare(
          `INSERT INTO seo_surge_records (
             id, keyword, current_velocity, mean_velocity, std_dev,
             z_score, is_surging, intent, generated_title, generated_tags,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
        )
        .bind(
          recordId,
          keyword,
          currentVelocity,
          currentVelocity / 2,
          currentVelocity / 4,
          zScore,
          intent,
          generatedTitle,
          JSON.stringify([keyword, '2026', 'guide']),
          now,
          now
        )
        .run();

      return { recordId, surging: true };
    });

    return { success: true, keyword, zScore };
  }
);
