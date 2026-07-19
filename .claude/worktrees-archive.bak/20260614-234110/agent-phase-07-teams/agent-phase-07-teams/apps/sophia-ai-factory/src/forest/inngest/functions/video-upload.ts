/**
 * Inngest Function: videoUpload
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.composed
 * Transition: composing → uploaded
 * Validates final video exists and marks uploaded.
 * For HeyGen videos, final_r2_key contains the CDN URL directly.
 * Emits: video.uploaded
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { recordCost } from '@/land/video/cost-ledger';
import { assertValidTransition } from '@/land/video/video-job-fsm';
import { logger } from '@/seed/utils/logger-utility';
import type { VideoJobStatus } from '@/land/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
  final_r2_key: string;
}

export const videoUpload = inngest.createFunction(
  { id: 'video-upload', retries: 3 },
  { event: 'video.composed' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    const job = await step.run('load-job', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status, final_r2_key')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoUpload] Job not found: ${jobId}`);
      return row;
    });

    await step.run('transition-to-uploaded', async () => {
      assertValidTransition(job.status, 'uploaded');
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ status: 'uploaded', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('verify-video-accessible', async () => {
      const url = job.final_r2_key;
      if (url.startsWith('http')) {
        try {
          const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
          if (!res.ok) logger.warn('[videoUpload] Video URL not accessible', { jobId, url, status: res.status });
        } catch {
          logger.warn('[videoUpload] Video URL check failed (non-fatal)', { jobId, url });
        }
      }
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'uploaded', provider: 'cloudflare-r2', units: 0, costUsd: 0 });
    });

    await step.sendEvent('emit-uploaded', {
      name: 'video.uploaded',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'uploaded' };
  },
);
