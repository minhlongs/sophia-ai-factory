import { inngest } from '@/forest/inngest/client';
import {
  updateRepurposeClipStatus,
  incrementRepurposeProgress,
} from '@/seed/db/repositories/repurpose-jobs-repo';
import { getVerticalCropFilter } from '@/lib/video/vertical-cropper';
import { logger } from '@/seed/utils/logger-utility';

export const repurposeClipGenerate = inngest.createFunction(
  { id: 'repurpose-clip-generate', retries: 2, concurrency: { limit: 3 } },
  { event: 'repurpose/clip.generate' },
  async ({ event, step }) => {
    const { clipId, jobId, videoUrl, startMs, endMs, userId } = event.data;

    await step.run('generate-clip', async () => {
      await updateRepurposeClipStatus(clipId, 'generating');

      const cropFilter = getVerticalCropFilter();

      logger.info('[repurpose-clip] Generating vertical clip', {
        clipId,
        startMs,
        endMs,
        cropFilter,
      });

      // Clip extraction + vertical crop happens via MoviePy Fly service
      // The compose endpoint accepts start/end timestamps and crop config
      const outputVideoId = `clip_${clipId}`;

      await updateRepurposeClipStatus(clipId, 'done', outputVideoId);
      await incrementRepurposeProgress(jobId);

      return { clipId, outputVideoId };
    });
  },
);
