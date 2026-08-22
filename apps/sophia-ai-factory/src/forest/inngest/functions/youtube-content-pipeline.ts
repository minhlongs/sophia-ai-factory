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
import { getD1Sync } from '@/seed/db/client';
import { buildAIGenerateFn } from '@/land/youtube/ai-generate-fn';
import { createCheckpointStore } from '@/land/youtube/pipeline-checkpoint-store';
import { genId } from '@/land/youtube/channel-config-types';
import {
  runStrategyStage,
  runScriptStage,
  runSEOStage,
  runThumbnailStage,
  runQualityGateStage,
  type ChannelConfigSnapshot,
} from '@/land/youtube/pipeline-stages';

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

    // ── Load channel config ────────────────────────────────────────────────
    const config = await runStepSafely('load-channel-config', async (): Promise<ChannelConfigSnapshot> => {
      const db = getD1Sync();
      const row = await db
        .prepare(`SELECT * FROM youtube_channel_configs WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
        .bind(channelConfigId, userId)
        .first<Record<string, unknown>>();
      if (!row) throw new Error(`Channel config not found: ${channelConfigId}`);
      let pillars: string[] = [];
      try {
        const parsed = JSON.parse(String(row.content_pillars ?? '[]'));
        if (Array.isArray(parsed)) pillars = parsed.map((v) => String(v));
      } catch {
        pillars = [];
      }
      return {
        objective: String(row.objective),
        audience: String(row.audience),
        contentPillars: pillars,
        cadence: String(row.cadence),
        postsPerWeek: Number(row.posts_per_week) || 3,
        bufferDays: Number(row.content_buffer_days) || 3,
        autonomyLevel: Number(row.autonomy_level) || 2,
      };
    });

    // ── Build AI generator (BYOK) ──────────────────────────────────────────
    const generateText = await runStepSafely('build-ai-generator', () => buildAIGenerateFn(userId));

    const ctx = { userId, channelConfigId, topic, generateText };

    // ── Stage 1: Strategy ──────────────────────────────────────────────────
    const strategy = await runStepSafely('strategy', () => runStrategyStage(ctx, config));

    // ── Stage 2: Script ────────────────────────────────────────────────────
    const script = await runStepSafely('script', () => runScriptStage(strategy));

    // ── Stage 3: SEO ───────────────────────────────────────────────────────
    const seo = await runStepSafely('seo', () => runSEOStage(strategy, script));

    // ── Stage 4: Thumbnail (best-effort) ───────────────────────────────────
    const thumbnail = await runStepSafely('thumbnail', () => runThumbnailStage(ctx, strategy, script));

    // ── Stage 5: Quality gate ──────────────────────────────────────────────
    const quality = await runStepSafely('quality-gate', () => runQualityGateStage(strategy, script, seo));
    if (!quality.passed) {
      throw new NonRetriableError(`Quality gate failed: ${quality.violations.join('; ')}`);
    }

    // ── Stage 6: Checkpoint ────────────────────────────────────────────────
    await runStepSafely('checkpoint', async () => {
      const store = await createCheckpointStore();
      if (!store) return { saved: false };
      const completedAt = new Date().toISOString();
      await store.saveGenerationCheckpoint(jobId, 'strategy', {
        status: 'completed',
        artifact: strategy as unknown as Record<string, unknown>,
        completedAt,
      });
      await store.saveGenerationCheckpoint(jobId, 'script', {
        status: 'completed',
        artifact: script as unknown as Record<string, unknown>,
        completedAt,
      });
      await store.saveGenerationCheckpoint(jobId, 'seo', {
        status: 'completed',
        artifact: seo as unknown as Record<string, unknown>,
        completedAt,
      });
      return { saved: true };
    });

    // ── Stage 7: Publish — schedule calendar entry ─────────────────────────
    const calendarId = await runStepSafely('publish', async () => {
      const db = getD1Sync();
      const id = genId();
      await db
        .prepare(
          `INSERT INTO youtube_content_calendar
           (id, user_id, channel_config_id, title, content_type, status, scheduled_at, notes)
           VALUES (?1,?2,?3,?4,?5,'scheduled',datetime('now'),?6)`,
        )
        .bind(id, userId, channelConfigId, seo.title, strategy.contentType, `Pipeline ${jobId}`)
        .run();
      return id;
    });

    logger.info('[youtube-pipeline] completed', undefined, { jobId, userId, channelConfigId, thumbnailSkipped: thumbnail.skipped });

    return { success: true, jobId, stage: 'publish', calendarId };
  },
);