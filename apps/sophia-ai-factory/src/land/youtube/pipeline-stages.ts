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
import type {
  ChannelConfigSnapshot,
  StrategyArtifact,
  ScriptArtifact,
  SEOArtifact,
  ThumbnailArtifact,
  QualityArtifact,
  PipelineContext,
} from './pipeline-stage-types';
import {
  runThumbnailStage,
  runQualityGateStage,
} from './pipeline-post-stages';

export type {
  ChannelConfigSnapshot,
  StrategyArtifact,
  ScriptArtifact,
  SEOArtifact,
  ThumbnailArtifact,
  QualityArtifact,
  PipelineContext,
};

export {
  runThumbnailStage,
  runQualityGateStage,
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
