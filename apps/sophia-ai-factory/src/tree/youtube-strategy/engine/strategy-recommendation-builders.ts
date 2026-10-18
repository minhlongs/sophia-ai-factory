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
import { toNumber, average, readable, metric } from './ctr-analyzer';

export function preferredSnapshotPerVideo(
  snapshots: readonly PerformanceSnapshot[],
): PerformanceSnapshot[] {
  const rank: Record<string, number> = { '7d': 3, '24h': 2, rolling: 1 };
  const selected = new Map<string, PerformanceSnapshot>();
  for (const snapshot of snapshots) {
    const current = selected.get(snapshot.videoId);
    if (!current || (rank[snapshot.measurementWindow] ?? 0) > (rank[current.measurementWindow] ?? 0)) {
      selected.set(snapshot.videoId, snapshot);
    }
  }
  return [...selected.values()];
}

const DIMENSIONS = [
  { key: 'format', metric: 'performanceScore', label: 'format', minimumDifference: 10 },
  { key: 'length', metric: 'retention', label: 'video length', minimumDifference: 8 },
  { key: 'hookLength', metric: 'retention', label: 'hook style', minimumDifference: 8 },
  { key: 'titleLength', metric: 'ctr', label: 'title style', minimumDifference: 1.25 },
] as const;

export function buildDimensionRecommendations(
  snapshots: readonly PerformanceSnapshot[],
): LearningRecommendation[] {
  const recommendations: LearningRecommendation[] = [];

  for (const dim of DIMENSIONS) {
    const groups = new Map<string, number[]>();
    for (const s of snapshots) {
      const val = s.contentAttributes[dim.key as keyof ContentAttributes];
      const mVal = toNumber(s.metrics[dim.metric as keyof PerformanceMetrics]);
      if (!val || val === 'unknown' || !Number.isFinite(mVal)) continue;
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(mVal);
    }
    const ranked = [...groups.entries()]
      .filter(([, v]) => v.length >= 2)
      .map(([value, values]) => ({ value, count: values.length, average: average(values) }))
      .sort((a, b) => b.average - a.average);
    if (ranked.length < 2 || ranked[0].average - ranked[ranked.length - 1].average < dim.minimumDifference) continue;

    const [best, weakest] = [ranked[0], ranked[ranked.length - 1]];
    const metricLabel = dim.metric === 'ctr' ? 'CTR' : dim.metric === 'retention' ? 'retention' : 'performance score';
    recommendations.push({
      category: dim.key,
      title: `Favor ${readable(best.value)} over ${readable(weakest.value)} ${dim.label}`,
      rationale: `${readable(best.value)} ${dim.label} averaged ${metric(best.average, dim.metric)} ${metricLabel} across ${best.count} videos versus ${metric(weakest.average, dim.metric)} across ${weakest.count}.`,
      evidence: { dimension: dim.key, metric: dim.metric, best, weakest },
      proposedChange: { target: 'future_plans', dimension: dim.key, prefer: best.value, deprioritize: weakest.value },
      confidence: best.count >= 4 && weakest.count >= 4 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  return recommendations;
}

export function buildChannelRecommendations(
  snapshots: readonly PerformanceSnapshot[],
): LearningRecommendation[] {
  const exposed = snapshots.filter((s) => toNumber(s.metrics.impressions) >= 100);
  if (exposed.length < 2) return [];
  const avgCTR = average(exposed.map((s) => toNumber(s.metrics.ctr)));
  const avgRet = average(exposed.map((s) => toNumber(s.metrics.retention)));
  const recs: LearningRecommendation[] = [];

  if (avgCTR < 4) {
    recs.push({
      category: 'packaging',
      title: 'Test new title and thumbnail packaging',
      rationale: `Channel CTR averaged ${avgCTR.toFixed(1)}% across ${exposed.length} sufficiently exposed videos.`,
      evidence: { metric: 'ctr', average: avgCTR, sampleSize: exposed.length, minimumImpressions: 100 },
      proposedChange: { target: 'review', experiment: 'title_thumbnail_variant' },
      confidence: exposed.length >= 5 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  if (avgRet < 35) {
    recs.push({
      category: 'retention',
      title: 'Tighten hooks and early pacing',
      rationale: `Average view percentage was ${avgRet.toFixed(1)}% across ${exposed.length} sufficiently exposed videos.`,
      evidence: { metric: 'retention', average: avgRet, sampleSize: exposed.length },
      proposedChange: { target: 'future_scripts', prefer: 'concise_hook_and_faster_opening' },
      confidence: exposed.length >= 5 ? 'high' : 'medium',
      status: 'pending',
    });
  }
  return recs;
}
