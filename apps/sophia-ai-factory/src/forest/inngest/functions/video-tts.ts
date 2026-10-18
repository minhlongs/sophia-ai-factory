/**
 * Inngest Function: videoTTS
 * @deprecated 2026-05-17 (ADR 0007) — removed from serve registration. `video_jobs` table was never applied to prod D1. File kept for test coverage + historical context.
 *
 * Listens: video.script.ready
 * Transition: scripting → tts_pending → (dispatches video.tts.ready)
 * Calls Coqui XTTS v2 via /api/internal/tts proxy.
 * Emits: video.tts.ready, campaign.progress (SSE)
 */

import { inngest } from '@/seed/inngest/client';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { assertValidTransition, type VideoJobStatus } from '@/land/video/generation/video-job-fsm';
import { synthesize } from '@/land/video/generation/tts-client';
import {
  emitProgress,
  fetchVideoJobForTransition,
  markVideoJobTtsPending,
  fetchVideoJobForSynthesis,
  saveVideoJobAudioKey,
} from './video-tts-helpers';

export const videoTTS = inngest.createFunction(
  { id: 'video-tts', retries: 3 },
  { event: 'video.script.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data as {
      jobId: string;
      tenantId: string;
      userId: string;
    };

    // Emit: TTS started
    await emitProgress(jobId, 'tts', 15, 'Bắt đầu tổng hợp giọng nói / Starting TTS synthesis');

    await step.run('transition-to-tts-pending', async () => {
      const row = await fetchVideoJobForTransition<VideoJobStatus>(jobId, tenantId);
      assertValidTransition(row.status, 'tts_pending');
      await markVideoJobTtsPending(jobId);
    });

    const { r2Key, durationSec, costUsd } = await step.run('synthesize-audio', async () => {
      const row = await fetchVideoJobForSynthesis(jobId);

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

      await saveVideoJobAudioKey(jobId, result.r2Key);
      return result;
    });

    // Emit: TTS complete (25%)
    await emitProgress(jobId, 'tts', 25, 'Giọng nói đã tổng hợp xong / TTS synthesis complete');

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
