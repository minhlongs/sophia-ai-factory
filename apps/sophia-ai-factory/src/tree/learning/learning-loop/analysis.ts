/**
 * Creative Learning Loop Performance and Experiment Analysis
 *
 * Layer: tree/learning
 */

import { getPerformanceEvents } from '@/tree/performance/events';
import { getExperimentResults } from '@/tree/performance/experiment';
import type { LearningInsight } from './types';

/**
 * Analyze performance events and produce insights.
 */
export function analyzePerformance(
  events: Awaited<ReturnType<typeof getPerformanceEvents>>,
): LearningInsight[] {
  const byChannel = new Map<string, { count: number; revenue: number }>();
  for (const e of events) {
    const existing = byChannel.get(e.channel) ?? { count: 0, revenue: 0 };
    existing.count += e.count;
    existing.revenue += e.valueCents ?? 0;
    byChannel.set(e.channel, existing);
  }

  let bestChannel: string | null = null;
  let bestRevenue = -1;
  for (const [channel, stats] of byChannel.entries()) {
    if (stats.revenue > bestRevenue) {
      bestRevenue = stats.revenue;
      bestChannel = channel;
    }
  }

  const insights: LearningInsight[] = [];
  if (bestChannel) {
    insights.push({
      category: 'performance',
      key: `best_channel_${bestChannel}`,
      value: { channel: bestChannel, revenueCents: bestRevenue },
      confidence: 'high',
      evidence: `Channel ${bestChannel} generated ${bestRevenue}c in revenue across ${events.length} events`,
    });
  }

  return insights;
}

/**
 * Extract experiment learnings: which variant won and by how much.
 */
export async function extractExperimentInsights(
  workspaceId: string,
  experimentIds: string[],
): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = [];
  for (const expId of experimentIds) {
    try {
      const results = await getExperimentResults(expId);
      if (results.length === 0) continue;
      const best = results.reduce((a, b) =>
        a.conversionRate > b.conversionRate ? a : b,
      );
      insights.push({
        category: 'performance',
        key: `experiment_winner_${expId}`,
        value: {
          experimentId: expId,
          variantId: best.variantId,
          conversionRate: best.conversionRate,
          sampleSize: best.sampleSize,
        },
        confidence: best.sampleSize >= 100 ? 'high' : 'medium',
        evidence: `Variant ${best.variantId} won with ${best.conversionRate}% conversion over ${best.sampleSize} samples`,
      });
    } catch {
      // Skip experiments with no results; non-fatal
    }
  }
  return insights;
}
