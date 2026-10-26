/**
 * @module forest/inngest/functions/video-model-radar-cron
 * Cron job (runs 0 0/12 * * *) updating ai_video_model_radar composite scores in D1.
 * Evaluates 2026-2027 video generation benchmarks without requiring operator credentials.
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { DEFAULT_2027_RADAR_CATALOG } from '@/seed/ai/video-model-radar-types';
import { computeModelScore } from '@/tree/video/radar/model-radar-scorer';

export async function processVideoModelRadarCron(): Promise<{ updated: number; timestamp: number }> {
  const db = await getD1();
  if (!db) {
    logger.warn('[ModelRadarCron] D1 unavailable -- skipping radar persistence');
    return { updated: 0, timestamp: Date.now() };
  }

  let updatedCount = 0;
  const now = Date.now();

  for (const entry of DEFAULT_2027_RADAR_CATALOG) {
    const compositeScore = computeModelScore(entry);
    try {
      await db
        .prepare(
          `INSERT INTO ai_video_model_radar (
            model_id, aggregator, scene_task, display_name,
            motion_fidelity, prompt_adherence, avg_latency_sec,
            cost_per_sec_usd, composite_score, is_active, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
          ON CONFLICT(model_id) DO UPDATE SET
            composite_score = excluded.composite_score,
            updated_at = excluded.updated_at`
        )
        .bind(
          entry.modelId,
          entry.aggregator,
          entry.sceneTask,
          entry.displayName,
          entry.motionFidelity,
          entry.promptAdherence,
          entry.avgLatencySec,
          entry.costPerSecUsd,
          compositeScore,
          now
        )
        .run();
      updatedCount++;
    } catch (err) {
      logger.warn('[ModelRadarCron] Error updating radar model row', { modelId: entry.modelId, err: String(err) });
    }
  }

  logger.info('[ModelRadarCron] Successfully synchronized 2026-2027 model radar entries', {
    updatedCount,
    timestamp: now,
  });

  return { updated: updatedCount, timestamp: now };
}

export const videoModelRadarCron = inngest.createFunction(
  { id: 'video-model-radar-cron', name: 'AI Video Model Radar Cron' },
  { cron: '0 */12 * * *' },
  processVideoModelRadarCron,
);
