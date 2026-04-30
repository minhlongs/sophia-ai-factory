/**
 * Inngest Function: videoCompose
 *
 * Listens: video.visual.ready
 * Merges audio + visual + subtitles via FFmpeg (MoviePy service).
 * Transition: visual_pending → composing
 * Emits: video.composed
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/lib/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import { composeFinalVideo } from '@/lib/video/composer-ffmpeg';
import { generateSubtitles } from '@/lib/video/subtitle-generator';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobRow {
  status: VideoJobStatus;
  audio_r2_key: string | null;
  visual_r2_key: string | null;
}

export const videoCompose = inngest.createFunction(
  { id: 'video-compose', retries: 3 },
  { event: 'video.visual.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    const jobRow = await step.run('transition-to-composing', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status, audio_r2_key, visual_r2_key')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoCompose] Job not found: ${jobId}`);

      assertValidTransition(row.status, 'composing');
      await db
        .from('video_jobs')
        .update({ status: 'composing', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);

      return row;
    });

    const subtitleSrt = await step.run('generate-subtitles', async () => {
      const audioR2Key = jobRow.audio_r2_key ?? '';
      if (!audioR2Key) return '';
      const { srt } = await generateSubtitles({ audioR2Key, jobId });
      return srt;
    });

    const finalR2Key = await step.run('compose-final-video', async () => {
      const audioR2Key = jobRow.audio_r2_key ?? '';
      const visualR2Key = jobRow.visual_r2_key ?? '';

      const result = await composeFinalVideo({
        jobId,
        tenantId,
        audioR2Key,
        visualR2Key,
        subtitleSrt,
      });
      return result.finalR2Key;
    });

    await step.run('persist-final-key', async () => {
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ final_r2_key: finalR2Key, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      await recordCost({ jobId, stage: 'compose', provider: 'moviepy-ffmpeg', units: 1, costUsd: 0.05 });
    });

    await step.sendEvent('emit-composed', {
      name: 'video.composed',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'composing', finalR2Key };
  },
);
