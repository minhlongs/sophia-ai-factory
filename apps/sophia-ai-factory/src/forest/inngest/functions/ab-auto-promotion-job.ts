/**
 * @file ab-auto-promotion-job.ts
 * @description Inngest background job for automated winner promotion in Hook A/B testing
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const abAutoPromotionJob = inngest.createFunction(
  {
    id: 'growth-ab-auto-promotion-job',
    name: 'Growth: Hook A/B Auto-Promotion Job',
  },
  { event: 'hook.ab.winner.promoted' },
  async ({ event, step }) => {
    const { experimentId, winnerVariantId, confidenceLevelPct } = event.data;

    await step.run('apply-winner-promotion-lock', async () => {
      logger.info('Locking winner variant and scaling traffic to 100%', {
        experimentId,
        winnerVariantId,
        confidenceLevelPct,
      });

      const db = createServerClient();
      const now = Date.now();

      await db
        .prepare(
          `UPDATE hook_ab_experiments
           SET status = 'WINNER_PROMOTED',
               winner_variant_id = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(winnerVariantId, now, experimentId)
        .run();

      return { promoted: true, experimentId, winnerVariantId };
    });

    return { success: true, experimentId };
  }
);
