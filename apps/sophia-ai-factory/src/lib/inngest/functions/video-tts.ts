/**
 * Inngest Function: videoTTS
 *
 * Listens: video.script.ready
 * Transition: scripting → tts_pending
 * Stub: no real TTS yet (Phase 7).
 * Emits: video.tts.ready
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/lib/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import { tenantScopedKey } from '@/lib/video/r2-binding';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
}

export const videoTTS = inngest.createFunction(
  { id: 'video-tts', retries: 3 },
  { event: 'video.script.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    await step.run('transition-to-tts-pending', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status')
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

    await step.run('stub-tts', async () => {
      // Phase 7 will replace with Coqui/ElevenLabs TTS
      const audioKey = tenantScopedKey(tenantId, jobId, 'audio.wav');
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ audio_r2_key: audioKey, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'tts_pending', provider: 'elevenlabs', units: 0, costUsd: 0 });
    });

    await step.sendEvent('emit-tts-ready', {
      name: 'video.tts.ready',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'tts_pending' };
  },
);
