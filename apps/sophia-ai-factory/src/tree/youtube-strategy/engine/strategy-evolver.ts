/**
 * Content Attributes & Strategy Evolution Recommendations
 *
 * Layer: tree/youtube-strategy/engine
 */

import type {
  ContentAttributes,
  PerformanceSnapshot,
  LearningRecommendation,
} from './types';
import {
  text,
  wordCount,
  slug,
} from './ctr-analyzer';
import {
  preferredSnapshotPerVideo,
  buildDimensionRecommendations,
  buildChannelRecommendations,
} from './strategy-recommendation-builders';

/**
 * Extract content attributes from performance report and context.
 */
export function extractAttributes(
  report: {
    videoDetails?: Record<string, unknown>;
  },
  context: {
    strategy?: Record<string, unknown>;
    script?: Record<string, unknown>;
    thumbnail?: Record<string, unknown>;
    title?: string;
  },
): ContentAttributes {
  const strategy = context.strategy ?? {};
  const script = context.script ?? {};
  const thumbnail = context.thumbnail ?? {};
  const title =
    String(report.videoDetails?.title ?? context.title ?? script.title ?? '').trim();
  const hook = text(script.hook ?? script.introduction ?? '');
  const concept = (thumbnail as Record<string, unknown>).concept as Record<string, unknown> | undefined;
  const thumbnailStyle = slug(
    String(
      concept?.composition ??
        concept?.style ??
        (thumbnail as Record<string, unknown>).style ??
        'unknown',
    ),
  );

  return {
    topic: String(strategy.topic ?? ''),
    format: slug(String(strategy.requestedStyle ?? strategy.contentType ?? 'unknown')),
    length: slug(String(strategy.requestedLengthKey ?? strategy.requestedLength ?? 'unknown')),
    hookLength: hook ? (wordCount(hook) <= 40 ? 'concise' : 'extended') : 'unknown',
    titleLength: title ? (wordCount(title) <= 9 ? 'concise' : 'long') : 'unknown',
    thumbnailStyle,
    source: strategy.planRationale ? 'autonomous_operator' : 'manual',
  };
}

/**
 * Build evidence-backed recommendations from a set of snapshots.
 */
export function buildRecommendations(snapshots: readonly PerformanceSnapshot[]): LearningRecommendation[] {
  const preferred = preferredSnapshotPerVideo(snapshots);
  if (preferred.length < 2) return [];
  return [...buildDimensionRecommendations(preferred), ...buildChannelRecommendations(preferred)];
}
