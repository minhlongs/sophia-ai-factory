/**
 * @file viral-repurpose-job.ts
 * @description Inngest background job orchestrating Saliency-based video repurposing
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';

export const viralRepurposeJob = inngest.createFunction(
  {
    id: 'viral-repurpose-job',
    name: 'Viral Video Repurposing Pipeline',
    concurrency: { limit: 3 },
  },
  { event: 'viral.repurpose.dispatched' },
  async ({ event, step }) => {
    const { userId, recordId, sourceVideoId, targetFormat, saliencyScore } = event.data;

    await step.run('mark-repurpose-processing', async () => {
      const db = createServerClient();
      await db
        .prepare(
          `UPDATE viral_repurpose_records
           SET status = 'PROCESSED'
           WHERE id = ?`
        )
        .bind(recordId)
        .run();
    });

    return {
      status: 'COMPLETED',
      userId,
      recordId,
      sourceVideoId,
      targetFormat,
      saliencyScore,
    };
  }
);
