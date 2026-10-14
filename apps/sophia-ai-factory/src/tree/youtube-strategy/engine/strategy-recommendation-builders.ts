/**
 * YouTube Strategy Dimension & Channel Recommendation Builders
 *
 * Layer: tree/youtube-strategy/engine
 * @module tree/youtube-strategy/engine/strategy-recommendation-builders
 */

import type {
  ContentAttributes,
  PerformanceMetrics,
  PerformanceSnapshot,
  LearningRecommendation,
} from './types';
import {
  toNumber,
  average,
  readable,
  metric,
} from './ctr-analyzer';

export function preferredSnapshotPerVideo(
  snapshots: readonly PerformanceSnapshot[],
): PerformanceSnapshot[] {
  const rank: Record<string, number> = { '7d': 3, '24h': 2, rolling: 1 };
  const selected = new Map<string, PerformanceSnapshot>();
  for (const snapshot of snapshots) {
    const current = selected.get(snapshot.videoId);
    if (
      !current ||
      (rank[snapshot.measurementWindow] ?? 0) > (rank[current.measurementWindow] ?? 0)
    ) {
      selected.set(snapshot.videoId, snapshot);
    }
  }
  return [...selected.values()];
}

export function buildDimensionRecommendations(
  snapshots: readonly PerformanceSnapshot[],
): LearningRecommendation[] {
  const dimensions = [
    { key: 'format', metric: 'performanceScore', label: 'format', minimumDifference: 10 },
    { key: 'length', metric: 'retention', label: 'video length', minimumDifference: 8 },
    { key: 'hookLength', metric: 'retention', label: 'hook style', minimumDifference: 8 },
    { key: 'titleLength', metric: 'ctr', label: 'title style', minimumDifference: 1.25 },
  ];
  const recommendations: LearningRecommendation[] = [];

  for (const dimension of dimensions) {
    const groups = new Map<string, number[]>();
    for (const snapshot of snapshots) {
      const value = snapshot.contentAttributes[dimension.key as keyof ContentAttributes];
      const metricVal = toNumber(snapshot.metrics[dimension.metric as keyof PerformanceMetrics]);
      if (!value || value === 'unknown' || !Number.isFinite(metricVal)) continue;
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value)!.push(metricVal);
    }
    const ranked = [...groups.entries()]
      .filter(([, values]) => values.length >= 2)
      .map(([value, values]) => ({
        value,
        count: values.length,
        average: average(values),
      }))
      .sort((a, b) => b.average - a.average);
    if (ranked.length < 2 || ranked[0].average - ranked[ranked.length - 1].average < dimension.minimumDifference) continue;

    const best = ranked[0];
    const weakest = ranked[ranked.length - 1];
    const metricLabel =
      dimension.metric === 'ctr'
        ? 'CTR'
        : dimension.metric === 'retention'
          ? 'retention'
          : 'performance score';
    recommendations.push({
      category: dimension.key,
      title: `Favor ${readable(best.value)} over ${readable(weakest.value)} ${dimension.label}`,
      rationale: `${readable(best.value)} ${dimension.label} averaged ${metric(best.average, dimension.metric)} ${metricLabel} across ${best.count} videos versus ${metric(weakest.average, dimension.metric)} across ${weakest.count}.`,
      evidence: { dimension: dimension.key, metric: dimension.metric, best, weakest },
      proposedChange: {
        target: 'future_plans',
        dimension: dimension.key,
        prefer: best.value,
        deprioritize: weakest.value,
      },
      confidence: best.count >= 4 && weakest.count >= 4 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  return recommendations;
}

export function buildChannelRecommendations(
  snapshots: readonly PerformanceSnapshot[],
): LearningRecommendation[] {
  const sufficientlyExposed = snapshots.filter(
    (s) => toNumber(s.metrics.impressions) >= 100,
  );
  if (sufficientlyExposed.length < 2) return [];
  const averageCTR = average(sufficientlyExposed.map((s) => toNumber(s.metrics.ctr)));
  const averageRetention = average(sufficientlyExposed.map((s) => toNumber(s.metrics.retention)));
  const recommendations: LearningRecommendation[] = [];

  if (averageCTR < 4) {
    recommendations.push({
      category: 'packaging',
      title: 'Test new title and thumbnail packaging',
      rationale: `Channel CTR averaged ${averageCTR.toFixed(1)}% across ${sufficientlyExposed.length} sufficiently exposed videos.`,
      evidence: {
        metric: 'ctr',
        average: averageCTR,
        sampleSize: sufficientlyExposed.length,
        minimumImpressions: 100,
      },
      proposedChange: { target: 'review', experiment: 'title_thumbnail_variant' },
      confidence: sufficientlyExposed.length >= 5 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  if (averageRetention < 35) {
    recommendations.push({
      category: 'retention',
      title: 'Tighten hooks and early pacing',
      rationale: `Average view percentage was ${averageRetention.toFixed(1)}% across ${sufficientlyExposed.length} sufficiently exposed videos.`,
      evidence: { metric: 'retention', average: averageRetention, sampleSize: sufficientlyExposed.length },
      proposedChange: { target: 'future_scripts', prefer: 'concise_hook_and_faster_opening' },
      confidence: sufficientlyExposed.length >= 5 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  return recommendations;
}
