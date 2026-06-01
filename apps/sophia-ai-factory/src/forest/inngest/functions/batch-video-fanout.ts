import { inngest } from '@/forest/inngest/client';
import {
  getBatchVideos,
  updateBatchVideoStatus,
  updateBatchJobStatus,
  incrementBatchProgress,
} from '@/seed/db/repositories/batch-jobs-repo';
import { logger } from '@/seed/utils/logger-utility';
import type { BatchVideoRow } from '@/land/video/batch-csv-parser';

const WAVE_SIZE = 50;
const WAVE_DELAY_MS = 5_000;

export const batchVideoFanout = inngest.createFunction(
  { id: 'batch-video-fanout', retries: 1 },
  { event: 'batch/video.fanout' },
  async ({ event, step }) => {
    const { batchId, userId } = event.data;

    const videos = await step.run('load-batch-videos', async () => {
      return getBatchVideos(batchId);
    });

    const queued = videos.filter((v) => v.status === 'queued');
    logger.info('[batch-fanout] Starting fanout', { batchId, total: queued.length });

    for (let wave = 0; wave * WAVE_SIZE < queued.length; wave++) {
      const waveVideos = queued.slice(wave * WAVE_SIZE, (wave + 1) * WAVE_SIZE);

      if (wave > 0) {
        await step.sleep(`wave-delay-${wave}`, WAVE_DELAY_MS);
      }

      await step.run(`dispatch-wave-${wave}`, async () => {
        const events = [];

        for (const bv of waveVideos) {
          let parsed: BatchVideoRow;
          try {
            parsed = JSON.parse(bv.input_data) as BatchVideoRow;
          } catch {
            await updateBatchVideoStatus(bv.id, 'failed', {
              errorMessage: 'Invalid input data JSON',
            });
            await incrementBatchProgress(batchId, 'failed_videos');
            continue;
          }

          await updateBatchVideoStatus(bv.id, 'generating');

          events.push({
            name: 'video/generate.requested' as const,
            data: {
              missionId: `batch-${batchId}-${bv.row_index}`,
              userId,
              prompt: parsed.prompt,
              voiceoverText: parsed.voiceoverText ?? parsed.prompt,
              language: (parsed.language as 'en' | 'vi') ?? 'en',
            },
          });
        }

        if (events.length > 0) {
          await inngest.send(events);
        }

        logger.info('[batch-fanout] Wave dispatched', {
          batchId,
          wave,
          count: events.length,
        });
      });
    }

    await step.run('mark-processing-complete', async () => {
      await updateBatchJobStatus(batchId, 'processing');
      logger.info('[batch-fanout] All waves dispatched', { batchId });
    });

    return { batchId, dispatched: queued.length };
  },
);
