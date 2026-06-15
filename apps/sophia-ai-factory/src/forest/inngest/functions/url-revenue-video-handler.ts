/**
 * Inngest Function: urlRevenueVideoHandler
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: url_revenue.video.requested
 * Chains into the existing video pipeline by creating a video_jobs row
 * and emitting video.requested — reuses videoScripting → videoTTS → … chain.
 *
 * Master-tier only feature. Requires INNGEST_EVENT_KEY in env.
 * Registered in src/app/api/inngest/route.ts.
 */

import { inngest } from '@/forest/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';

export const urlRevenueVideoHandler = inngest.createFunction(
  { id: 'url-revenue-video-handler', retries: 2 },
  { event: 'url_revenue.video.requested' },
  async ({ event, step }) => {
    const { jobId, tenantId, prompt, locale, channel, trackingLink } = event.data;

    // Create a video_jobs row so the existing scripting→tts→compose→upload chain can pick it up.
    const videoJobId = await step.run('create-video-job', async () => {
      const db = createServerClient();
      const newJobId = randomUUID();
      const now = new Date().toISOString();

      await db.from('video_jobs').insert({
        id: newJobId,
        tenant_id: tenantId,
        // Use tenantId as userId fallback — url-to-revenue jobs are tenant-scoped
        user_id: tenantId,
        prompt: [
          prompt,
          `Locale: ${locale}`,
          `Channel: ${channel}`,
          trackingLink ? `Tracking: ${trackingLink}` : '',
        ].filter(Boolean).join('\n'),
        status: 'queued',
        // Tag the source job so it can be linked back
        metadata_json: JSON.stringify({ sourceJobId: jobId, locale, channel }),
        created_at: now,
        updated_at: now,
      });

      logger.info('[url-revenue-video-handler] video_jobs row created', {
        videoJobId: newJobId,
        sourceJobId: jobId,
        locale,
        channel,
      });

      return newJobId;
    });

    // Emit video.requested to chain into existing videoScripting function
    await step.sendEvent('emit-video-requested', {
      id: `video-req-${videoJobId}`,
      name: 'video.requested',
      data: { jobId: videoJobId, tenantId, userId: tenantId },
    });

    return { videoJobId, sourceJobId: jobId, status: 'scripting' };
  },
);
