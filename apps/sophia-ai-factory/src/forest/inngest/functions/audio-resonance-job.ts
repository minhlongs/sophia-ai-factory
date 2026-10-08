/**
 * @file audio-resonance-job.ts
 * @description Inngest background job for Pillar 1: Audio Resonance & Beat-Drop Quantization
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';
import { computeAudioResonance } from '@/tree/audio/audio-resonance-engine';
import { invalidateQuotaCache } from '@/seed/kv/quota-cache-ops';
import { recordSuccess, recordFailure, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';

export const submitAudioResonanceJob = inngest.createFunction(
  {
    id: 'audio-resonance-job',
    name: 'Growth Triad v8 - Audio Resonance Sync',
    retries: 3,
  },
  { event: 'audio.resonance.synced' },
  async ({ event, step }) => {
    const { audioTrackId, resonanceScore, bpm, syncQuality } = event.data;

    if (!audioTrackId) {
      throw new NonRetriableError('Missing required field: audioTrackId');
    }

    // Step 1: Simulate check against external audio metadata service with circuit breaker
    await step.run('fetch-audio-metadata-circuit-breaker', async () => {
      const allowed = await shouldAllowRequest('external-audio-api');
      if (!allowed) {
        throw new Error('Circuit breaker open for external-audio-api');
      }

      try {
        // Mock external call
        await new Promise((resolve) => setTimeout(resolve, 50));
        await recordSuccess('external-audio-api');
      } catch (error) {
        await recordFailure('external-audio-api', FailureKind.SERVER_ERROR);
        throw error;
      }
    });

    // Step 2: Persist resonance metadata synchronously to D1
    await step.run('persist-audio-resonance', async () => {
      const db = createServerClient();

      const insertQuery = `
        INSERT INTO audio_resonance_jobs (job_id, audio_track_id, bpm, resonance_score, sync_quality_category)
        VALUES (substr(lower(hex(randomblob(16))), 1, 32), ?, ?, ?, ?)
      `;

      try {
        const stmt = db.prepare(insertQuery).bind(
          audioTrackId,
          bpm,
          resonanceScore,
          syncQuality
        );

        await stmt.run();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to insert audio_resonance_jobs record: ${msg}`);
      }
    });

    // Step 3: Quota Cache Invalidation
    await step.run('invalidate-audio-quota-cache', async () => {
      // Dummy user ID for this background job context
      await invalidateQuotaCache('system_audio_processor', 'audio_sync');
    });

    return {
      status: 'completed',
      audioTrackId,
      processedAt: new Date().toISOString()
    };
  }
);
