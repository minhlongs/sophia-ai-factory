/**
 * YouTube content pipeline Inngest function.
 * 7 stages: strategy → script → SEO → thumbnail → quality-gate → checkpoint → publish.
 * AI generation injected as parameter (BYOK). Cadence + content-buffer respected.
 * @module forest/inngest/functions/youtube-content-pipeline
 */

import { NonRetriableError } from 'inngest';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { buildAIGenerateFn } from '@/land/youtube/ai-generate-fn';
import { createCheckpointStore } from '@/land/youtube/pipeline-checkpoint-store';
import { genId } from '@/land/youtube/channel-config-types';
import {
  runStrategyStage,
  runScriptStage,
  runSEOStage,
  runThumbnailStage,
  runQualityGateStage,
} from '@/land/youtube/pipeline-stages';
import {
  loadChannelConfigSnapshot,
  savePipelineCheckpoints,
  insertYoutubeCalendarEntry,
} from './youtube-content-pipeline-steps';

interface PipelineEventData {
  userId: string;
  channelConfigId: string;
  topic?: string | null;
  requestedAt?: number;
  resume?: boolean;
  resumeFrom?: string;
}

interface PipelineResult {
  success: boolean;
  jobId: string;
  stage: string;
  calendarId?: string;
  error?: string;
}

export const youtubeContentPipeline = inngest.createFunction(
  { id: 'youtube-content-pipeline', retries: 2 },
  { event: 'youtube.content.pipeline.requested' },
  async ({ event, step }): Promise<PipelineResult> => {
    const data = event.data as PipelineEventData;
    const { userId, channelConfigId, topic } = data;
    const jobId = `pipe_${channelConfigId}_${Date.now()}`;

    // Generic error boundary — defined inside body so it has access to step.
    async function runStepSafely<T>(stepName: string, fn: () => Promise<T>): Promise<T> {
      try {
        return (await step.run(stepName, fn)) as T;
      } catch (rawErr) {
        if (rawErr instanceof NonRetriableError) throw rawErr;
        const errMsg = rawErr instanceof Error ? rawErr.message : String(rawErr);
        logger.error(`[youtube-pipeline:${stepName}] failed`, toError(rawErr), { jobId, userId, stepName });
        throw new NonRetriableError(`[${stepName}] ${errMsg}`, { cause: rawErr });
      }
    }

    const config = await runStepSafely('load-channel-config', () =>
      loadChannelConfigSnapshot(channelConfigId, userId),
    );

    const generateText = await runStepSafely('build-ai-generator', () => buildAIGenerateFn(userId));
    const ctx = { userId, channelConfigId, topic, generateText };

    const strategy = await runStepSafely('strategy', () => runStrategyStage(ctx, config));
    const script = await runStepSafely('script', () => runScriptStage(strategy));
    const seo = await runStepSafely('seo', () => runSEOStage(strategy, script));
    const thumbnail = await runStepSafely('thumbnail', () => runThumbnailStage(ctx, strategy, script));

    const quality = await runStepSafely('quality-gate', () => runQualityGateStage(strategy, script, seo));
    if (!quality.passed) {
      throw new NonRetriableError(`Quality gate failed: ${quality.violations.join('; ')}`);
    }

    await runStepSafely('checkpoint', async () => {
      const store = await createCheckpointStore();
      return savePipelineCheckpoints({ store, jobId, strategy, script, seo });
    });

    const calendarId = await runStepSafely('publish', () =>
      insertYoutubeCalendarEntry({
        id: genId(),
        userId,
        channelConfigId,
        title: seo.title,
        contentType: strategy.contentType,
        jobId,
      }),
    );

    logger.info('[youtube-pipeline] completed', undefined, {
      jobId,
      userId,
      channelConfigId,
      thumbnailSkipped: thumbnail.skipped,
    });

    return { success: true, jobId, stage: 'publish', calendarId };
  },
);
