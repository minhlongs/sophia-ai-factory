/**
 * Post-processing stages (Thumbnail & Quality Gate) for the YouTube content pipeline.
 * @module land/youtube/pipeline-post-stages
 */

import { runQualityChecks } from '@/tree/youtube-strategy/quality-gate';
import type {
  StrategyArtifact,
  ScriptArtifact,
  SEOArtifact,
  ThumbnailArtifact,
  QualityArtifact,
  PipelineContext,
} from './pipeline-stage-types';

/** Stage 4: generate a thumbnail (best-effort; returns skipped on any failure). */
export async function runThumbnailStage(
  ctx: PipelineContext,
  strategy: StrategyArtifact,
  script: ScriptArtifact,
): Promise<ThumbnailArtifact> {
  try {
    const { ThumbnailClient } = await import('@/land/video/templates/thumbnail-client');
    const { getThumbnailKey } = await import('@/tree/credentials/get-provider-key');
    const keyResult = await getThumbnailKey({ userId: ctx.userId, fallbackToPlatform: true });
    if (!keyResult) return { path: null, skipped: true, reason: 'No thumbnail key configured' };
    const client = new ThumbnailClient({ apiKey: keyResult.key });
    const result = await client.generateThumbnail({
      prompt: `YouTube thumbnail for "${script.title}" — ${strategy.topic}`,
    });
    return { path: result.imageUrl, skipped: false };
  } catch (err) {
    return { path: null, skipped: true, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Stage 5: run quality checks on the assembled artifact. */
export async function runQualityGateStage(
  strategy: StrategyArtifact,
  script: ScriptArtifact,
  seo: SEOArtifact,
): Promise<QualityArtifact> {
  const result = runQualityChecks(
    {
      title: seo.title,
      description: seo.description,
      tags: seo.tags,
      script: script.fullScript,
      topic: strategy.topic,
    },
    [],
  );
  return {
    passed: result.passed,
    violations: [...result.violations],
    warnings: [...result.warnings],
  };
}
