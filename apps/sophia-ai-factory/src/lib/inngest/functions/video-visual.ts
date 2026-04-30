/**
 * Inngest Function: videoVisual
 *
 * Listens: video.tts.ready
 * Routes by tenant tier:
 *   free/pro → Path A (MoviePy template)
 *   enterprise → Path B (HunyuanVideo on Runpod)
 * Transition: tts_pending → visual_pending
 * Emits: video.visual.ready
 */

import { inngest } from '@/lib/inngest/client';
import { getD1Client } from '@/lib/db/client';
import { recordCost } from '@/lib/video/cost-ledger';
import { assertValidTransition } from '@/lib/video/video-job-fsm';
import { routeVisualPath } from '@/lib/video/visual-router';
import { generateVisualPrompts } from '@/lib/video/visual-prompt-generator';
import { renderTemplateVideo } from '@/lib/video/path-a-template';
import { renderCinematicVideo } from '@/lib/video/path-b-cinematic';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';
import type { VisualTier } from '@/lib/video/visual-router';

interface VideoJobRow {
  status: VideoJobStatus;
  tier: string;
  script_text: string | null;
  audio_r2_key: string | null;
}

export const videoVisual = inngest.createFunction(
  { id: 'video-visual', retries: 3 },
  { event: 'video.tts.ready' },
  async ({ event, step }) => {
    const { jobId, tenantId, userId } = event.data;

    const jobRow = await step.run('transition-to-visual-pending', async () => {
      const db = await getD1Client();
      const { data } = await db
        .from('video_jobs')
        .select('status, tier, script_text, audio_r2_key')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();
      const row = data as VideoJobRow | null;
      if (!row) throw new Error(`[videoVisual] Job not found: ${jobId}`);

      assertValidTransition(row.status, 'visual_pending');
      await db
        .from('video_jobs')
        .update({ status: 'visual_pending', updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);

      return row;
    });

    const visualR2Key = await step.run('generate-visual', async () => {
      const tier = (jobRow.tier ?? 'free') as VisualTier;
      const path = routeVisualPath(tier);
      const scriptText = jobRow.script_text ?? '';
      const audioR2Key = jobRow.audio_r2_key ?? '';

      const { scenes } = await generateVisualPrompts({ scriptText });

      if (path === 'cinematic') {
        const result = await renderCinematicVideo({ jobId, tenantId, scenes });
        return result.visualR2Key;
      }

      const result = await renderTemplateVideo({
        jobId,
        tenantId,
        templateId: 'default',
        audioR2Key,
        scenes,
      });
      return result.visualR2Key;
    });

    await step.run('persist-visual-key', async () => {
      const db = await getD1Client();
      await db
        .from('video_jobs')
        .update({ visual_r2_key: visualR2Key, updated_at: Math.floor(Date.now() / 1000) })
        .eq('id', jobId);
    });

    await step.run('record-cost', async () => {
      const tier = (jobRow.tier ?? 'free') as VisualTier;
      const path = routeVisualPath(tier);
      const costUsd = path === 'cinematic' ? 8.0 : 0.25;
      await recordCost({
        jobId,
        stage: 'visual',
        provider: path === 'cinematic' ? 'runpod-hunyuan' : 'moviepy',
        units: 1,
        costUsd,
      });
    });

    await step.sendEvent('emit-visual-ready', {
      name: 'video.visual.ready',
      data: { jobId, tenantId, userId },
    });

    return { jobId, status: 'visual_pending', visualR2Key };
  },
);
