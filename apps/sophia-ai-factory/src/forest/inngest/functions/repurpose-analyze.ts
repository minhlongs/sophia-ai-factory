import { inngest } from '@/forest/inngest/client';
import { updateRepurposeJobStatus, insertRepurposeClips } from '@/seed/db/repositories/repurpose-jobs-repo';
import { scoreHighlights } from '@/lib/video/highlight-scorer';
import { detectScenes } from '@/lib/video/scene-detector';
import { mergeClipBoundaries, type TranscriptWord } from '@/lib/video/clip-boundary-merger';
import { logger } from '@/seed/utils/logger-utility';
import type { TranscriptSegment } from '@/lib/video/highlight-scorer';

export const repurposeAnalyze = inngest.createFunction(
  { id: 'repurpose-analyze', retries: 2 },
  { event: 'repurpose/analyze.requested' },
  async ({ event, step }) => {
    const { jobId, userId, videoUrl, transcript: rawTranscript } = event.data;

    const transcript: TranscriptSegment[] = rawTranscript.map((t) => ({
      text: t.text,
      start: t.start_ms,
      end: t.end_ms,
    }));

    const [scenes, highlights] = await Promise.all([
      step.run('detect-scenes', async () => {
        return detectScenes(videoUrl);
      }),
      step.run('score-highlights', async () => {
        return scoreHighlights(userId, transcript);
      }),
    ]);

    const mergedClips = await step.run('merge-boundaries', async () => {
      const words: TranscriptWord[] = rawTranscript.map((t) => ({
        text: t.text,
        start: t.start_ms,
        end: t.end_ms,
        confidence: 1.0,
      }));
      return mergeClipBoundaries(highlights, scenes, words);
    });

    await step.run('save-manifest', async () => {
      const clips = mergedClips.map((c, i) => ({
        clipIndex: i,
        startMs: c.start_ms,
        endMs: c.end_ms,
        score: c.score,
        title: c.title,
      }));

      await insertRepurposeClips(jobId, clips);
      await updateRepurposeJobStatus(jobId, 'clips_ready', {
        clipManifest: JSON.stringify(mergedClips),
        totalClips: mergedClips.length,
      });

      logger.info('[repurpose-analyze] Clips ready', { jobId, count: mergedClips.length });
    });

    return { jobId, clipCount: mergedClips.length };
  },
);
