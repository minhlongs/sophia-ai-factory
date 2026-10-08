/**
 * @file omnichannel-attribution-job.ts
 * @description Inngest background job auditing omnichannel attribution weights and records
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';

export const omnichannelAttributionJob = inngest.createFunction(
  {
    id: 'omnichannel-attribution-job',
    name: 'Omnichannel Multi-Touch Attribution Calculator Job',
    concurrency: { limit: 5 },
  },
  { event: 'omnichannel.attribution.calculated' },
  async ({ event, step }) => {
    const {
      conversionId,
      userId,
      model,
      totalAttributedGmv,
      touchpointCount,
    } = event.data;

    // Step 1: Audit and record attribution processing completion
    await step.run('audit-touchpoint-attribution', async () => {
      const db = createServerClient();
      await db
        .prepare(
          `UPDATE omnichannel_touchpoints
           SET payout_status = 'CALCULATED'
           WHERE conversion_id = ? AND user_id = ?`
        )
        .bind(conversionId, userId)
        .run();
    });

    return {
      success: true,
      conversionId,
      userId,
      model,
      totalAttributedGmv,
      touchpointCount,
    };
  }
);
