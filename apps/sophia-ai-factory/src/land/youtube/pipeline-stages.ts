/**
 * Pure stage runners for the YouTube content pipeline.
 * Each stage is a pure async function taking typed inputs — fully unit-testable
 * without Inngest or D1.
 * @module land/youtube/pipeline-stages
 */

import { generateStrategy } from '@/tree/youtube-strategy/strategy-generator';
import { generateScript } from '@/tree/youtube-strategy/script-writer';
import {
  optimizeTitle,
  generateDescription,
  generateTags,
  calculateSEOScore,
} from '@/tree/youtube-strategy/seo-optimizer';
import { runQualityChecks } from '@/tree/youtube-strategy/quality-gate';
import type {
  ChannelConfigSnapshot,
  StrategyArtifact,
  ScriptArtifact,
  SEOArtifact,
  ThumbnailArtifact,
  QualityArtifact,
  PipelineContext,
} from './pipeline-stage-types';

export type {
  ChannelConfigSnapshot,
  StrategyArtifact,
  ScriptArtifact,
  SEOArtifact,
  ThumbnailArtifact,
  QualityArtifact,
  PipelineContext,
};

/** Stage 1: generate a content strategy. */
export async function runStrategyStage(
  ctx: PipelineContext,
  config: ChannelConfigSnapshot,
): Promise<StrategyArtifact> {
  const strategy = await generateStrategy(
    { topic: ctx.topic ?? undefined, targetAudience: config.audience },
    ctx.generateText ?? undefined,
  );
  return {
    topic: strategy.topic,
    angle: strategy.angle,
    targetAudience: strategy.targetAudience,
    contentType: strategy.contentType,
    keywords: [...strategy.keywords],
    estimatedViews: strategy.estimatedViews,
    bestPublishTime: strategy.bestPublishTime,
  };
}

/** Stage 2: generate a script from a strategy. */
export async function runScriptStage(strategy: StrategyArtifact): Promise<ScriptArtifact> {
  const generated = generateScript({
    topic: strategy.topic,
    angle: strategy.angle,
    contentType: strategy.contentType,
    targetAudience: strategy.targetAudience,
    keywords: strategy.keywords,
  });
  return {
    title: generated.title, hook: generated.hook, introduction: generated.introduction,
    mainContent: generated.mainContent, conclusion: generated.conclusion,
    callToAction: generated.callToAction, duration: generated.duration,
    tone: generated.tone, pacing: generated.pacing,
    keywords: [...generated.keywords], claims: [...generated.claims],
    fullScript: generated.fullScript,
  };
}

/** Stage 3: generate SEO metadata from a strategy + script. */
export async function runSEOStage(
  strategy: StrategyArtifact,
  script: ScriptArtifact,
): Promise<SEOArtifact> {
  const input = {
    title: strategy.topic,
    topic: strategy.topic,
    angle: strategy.angle,
    contentType: strategy.contentType,
    targetAudience: strategy.targetAudience,
    keywords: strategy.keywords,
  };
  const optimizedTitle = optimizeTitle(script.title, strategy.keywords);
  const description = generateDescription(
    { title: script.title, mainContent: script.mainContent as { sections: Array<{ title: string; duration: number }> } },
    input,
  );
  const tags = generateTags(input);
  const score = calculateSEOScore(optimizedTitle, description, tags);
  return {
    title: optimizedTitle,
    description,
    tags: [...tags],
    seoScore: score,
  };
}

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
