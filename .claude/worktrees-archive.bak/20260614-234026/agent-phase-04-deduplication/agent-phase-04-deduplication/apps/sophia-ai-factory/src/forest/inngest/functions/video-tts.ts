/**
 * Inngest Function: videoTTS
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.script.ready
 * Transition: scripting → tts_pending → (dispatches video.tts.ready)
 * Calls Coqui XTTS v2 via /api/internal/tts proxy.
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { recordCost } from '@/land/video/cost-ledger';
import { assertValidTransition } from '@/land/video/video-job-fsm';
import type { VideoJobStatus } from '@/land/video/video-job-fsm';
import { synthesize } from '@/land/video/tts-client';

interface VideoJobRow {
  status: VideoJobStatus;
  script_text: string | null;
  prompt: string;
  audio_r2_key: string | null;
}

export const videoTTS = inngest.createFunction(
  { id: 'video-tts', retries: 3 },
  { event: 'video.script.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data as {
      jobId: string;
      tenantId: string;
      userId: string;
    };

    await step.run('transition-to-tts-pending', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status, script_text, prompt, audio_r2_key')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoTTS] Job not found: ${jobId}`);

      assertValidTransition(row.status, 'tts_pending');

      await db
        .from('video_jobs')
        .update({ status: 'tts_pending', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    const { r2Key, durationSec, costUsd } = await step.run('synthesize-audio', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('script_text, prompt, audio_r2_key')
        .eq('id', jobId)
        .single();

      const row = data as Pick<VideoJobRow, 'script_text' | 'prompt' | 'audio_r2_key'> | null;
      if (!row) throw new Error(`[videoTTS] Job not found during synthesis: ${jobId}`);

      // Idempotency: already synthesised in a previous attempt
      if (row.audio_r2_key) {
        return { r2Key: row.audio_r2_key, durationSec: 0, costUsd: 0 };
      }

      const text = row.script_text ?? row.prompt;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
      const internalToken = process.env.COQUI_INTERNAL_TOKEN ?? '';

      const result = await synthesize({
        text,
        language: 'en',
        tenantId,
        jobId,
        baseUrl,
        internalToken,
      });

      // Persist audio key
      await db
        .from('video_jobs')
        .update({ audio_r2_key: result.r2Key, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);

      return result;
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'tts', provider: 'coqui', units: durationSec, costUsd });
    });

    await step.sendEvent('emit-tts-ready', {
      name: 'video.tts.ready',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'tts_pending', r2Key };
  },
);
