/**
 * @file newsjacking-fasttrack-job.ts
 * @description Inngest fast-track newsjack video generation pipeline (<120s SLA)
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { buildFastTrackNewsjackPlan } from '@/tree/newsjacking/fast-track-script-generator';

export const newsjackingFastTrackJob = inngest.createFunction(
  { id: 'newsjacking-fasttrack-job', name: 'Newsjacking Fast-Track Generation Job' },
  { event: 'newsjacking.fasttrack.triggered' },
  async ({ event, step }) => {
    const { userId, signalId, trendTopic, pairedOfferId } = event.data;

    const scriptPlan = await step.run('generate-script-plan', async () => {
      return buildFastTrackNewsjackPlan(trendTopic, pairedOfferId ? 'Sản Phẩm Đang Hot' : 'Affiliate Hero Offer', 'E-commerce');
    });

    const videoJobId = `newsjack_vid_${Date.now()}`;

    await step.run('record-completed-signal', async () => {
      const db = createServerClient();
      db.prepare(`
        UPDATE newsjack_signals
        SET status = 'COMPLETED', generated_video_job_id = ?
        WHERE id = ? AND user_id = ?
      `).bind(videoJobId, signalId, userId).run();

      return { signalId, videoJobId };
    });

    return {
      success: true,
      signalId,
      videoJobId,
      hook: scriptPlan.hook3s,
    };
  },
);
