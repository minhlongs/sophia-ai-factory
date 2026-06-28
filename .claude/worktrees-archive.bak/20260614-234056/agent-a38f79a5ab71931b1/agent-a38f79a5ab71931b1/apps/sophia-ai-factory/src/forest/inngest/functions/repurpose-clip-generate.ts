import { inngest } from '@/forest/inngest/client';
import {
  updateRepurposeClipStatus,
  incrementRepurposeProgress,
} from '@/seed/db/repositories/repurpose-jobs-repo';
import { logger } from '@/seed/utils/logger-utility';
import { getD1Raw } from '@/seed/db/client';
import { generateSubtitles } from '@/land/video/subtitle-generator';
import { composeFinalVideo, applyBrandKit } from '@/land/video/composer-ffmpeg';

export const repurposeClipGenerate = inngest.createFunction(
  { id: 'repurpose-clip-generate', retries: 2, concurrency: { limit: 3 } },
  { event: 'repurpose/clip.generate' },
  async ({ event, step }) => {
    const { clipId, jobId, videoUrl: eventVideoUrl, startMs, endMs, userId } = event.data;

    return await step.run('generate-clip', async () => {
      await updateRepurposeClipStatus(clipId, 'generating');

      const db = await getD1Raw();
      const job = await db
        .prepare('SELECT source_video_id FROM repurpose_jobs WHERE id = ? LIMIT 1')
        .bind(jobId)
        .first<{ source_video_id: string }>();

      if (!job) {
        throw new Error(`Repurpose job ${jobId} not found`);
      }

      const sourceVideoId = job.source_video_id;

      // Fetch original video info
      const video = await db
        .prepare('SELECT video_url, r2_key FROM videos WHERE id = ? LIMIT 1')
        .bind(sourceVideoId)
        .first<{ video_url: string | null; r2_key: string | null }>();

      if (!video) {
        throw new Error(`Source video ${sourceVideoId} not found`);
      }

      const visualR2Key = video.r2_key || video.video_url || eventVideoUrl;
      if (!visualR2Key) {
        throw new Error(`No video key or URL found for video ${sourceVideoId}`);
      }

      logger.info('[repurpose-clip] Generating vertical clip', {
        clipId,
        jobId,
        sourceVideoId,
        visualR2Key,
        startMs,
        endMs,
      });

      // Fetch or generate subtitles from the original video audio if available
      let subtitleSrt = '';
      const audioR2Key = `video-jobs/${sourceVideoId}/audio.mp3`;
      try {
        const subResult = await generateSubtitles({
          audioR2Key,
          jobId,
        });
        subtitleSrt = subResult.srt;
      } catch (err) {
        logger.error('[repurpose-clip] Failed to generate subtitles (non-fatal)', err instanceof Error ? err : new Error(String(err)));
      }

      // Apply brand kit and compose final vertical clip
      const rawComposeInput = {
        jobId: clipId,
        tenantId: userId,
        visualR2Key,
        subtitleSrt: subtitleSrt || undefined,
        startSec: startMs / 1000,
        endSec: endMs / 1000,
        cropVertical: true,
        generateThumbnail: true,
        normalizeAudio: false,
      };

      const composeInput = await applyBrandKit(userId, rawComposeInput);
      const composeResult = await composeFinalVideo(composeInput);

      const outputVideoId = composeResult.finalR2Key;

      await updateRepurposeClipStatus(clipId, 'done', outputVideoId);
      await incrementRepurposeProgress(jobId);

      return { clipId, outputVideoId };
    });
  },
);
