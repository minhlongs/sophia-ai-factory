/**
 * @file tiktok-sample-fulfillment-job.ts
 * @description Inngest background job orchestrating TikTok creator sample fulfillment tracking
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';

export const tiktokSampleFulfillmentJob = inngest.createFunction(
  {
    id: 'tiktok-sample-fulfillment-job',
    name: 'TikTok Creator Sample Fulfillment & Gating Job',
    concurrency: { limit: 5 },
  },
  { event: 'tiktok.sample.evaluated' },
  async ({ event, step }) => {
    const {
      creatorId,
      userId,
      creatorHandle,
      sampleStatus,
      tier,
    } = event.data;

    // Step 1: Log and verify sample fulfillment step
    await step.run('verify-sample-fulfillment', async () => {
      const db = createServerClient();
      await db
        .prepare(
          `UPDATE tiktok_creator_records
           SET sample_status = ?, commission_tier = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(sampleStatus, tier, Date.now(), creatorId)
        .run();
    });

    return {
      success: true,
      creatorId,
      creatorHandle,
      userId,
      sampleStatus,
      tier,
    };
  }
);
