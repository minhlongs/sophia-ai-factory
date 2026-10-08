/**
 * @file churn-winback-job.ts
 * @description Inngest background job orchestrating Churn Win-Back offers and D1 persistence
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';

export const churnWinbackJob = inngest.createFunction(
  {
    id: 'churn-winback-job',
    name: 'Churn Win-Back Retention Dispatcher',
    concurrency: { limit: 5 },
  },
  { event: 'retargeting.winback.evaluated' },
  async ({ event, step }) => {
    const { userId, recordId, riskLevel, discountPercentage, bonusMcu } = event.data;

    await step.run('persist-winback-status', async () => {
      const db = createServerClient();
      await db
        .prepare(
          `UPDATE churn_winback_records
           SET status = 'OFFER_ACTIVE', updated_at = ?
           WHERE id = ?`
        )
        .bind(Date.now(), recordId)
        .run();
    });

    return {
      status: 'DISPATCHED',
      userId,
      recordId,
      riskLevel,
      discountPercentage,
      bonusMcu,
    };
  }
);
