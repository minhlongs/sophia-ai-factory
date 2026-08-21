/**
 * Creative Learning Loop — closes the MEASURE → LEARN → COMPOUND
 * flywheel by turning performance data into updated CreativeMemory
 * and actionable recommendations.
 *
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/learning
 */

import { getPerformanceEvents } from '@/tree/performance/events';
import { getExperimentResults } from '@/tree/performance/experiment';
import {
  upsertMemory,
  getMemoryByCategory,
  recordLearning,
} from '@/tree/creative-memory/index';
import { getMissionMetrics } from '@/tree/mission/types';
import { success, failure, type Result } from '@/seed/types/result';
import type { CreativeMemory } from '@/seed/types/creative-domain';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LearningInsight {
  category: CreativeMemory['category'];
  key: string;
  value: unknown;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface LearningRecommendation {
  type: 'content' | 'channel' | 'timing' | 'format' | 'budget';
  action: string;
  reasoning: string;
  expectedImpact: string;
}

export interface LearningLoopResult {
  insights: LearningInsight[];
  recommendations: LearningRecommendation[];
  memoriesWritten: number;
}

export type LearningLoopError = { code: 'DB_UNAVAILABLE'; message: string };

// ─── Analysis ────────────────────────────────────────────────────────────────

/**
 * Analyze performance events and produce insights.
 *
 * Currently aggregates by channel + event type to find the highest-impact
 * channel and the best-performing event type. Future iterations can add
 * trend detection and cohort analysis.
 */
function analyzePerformance(
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
async function extractExperimentInsights(
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

// ─── Recommendations ─────────────────────────────────────────────────────────

function generateRecommendations(
  insights: LearningInsight[],
  metrics: Awaited<ReturnType<typeof getMissionMetrics>>,
): LearningRecommendation[] {
  const recs: LearningRecommendation[] = [];

  const bestChannelInsight = insights.find(
    (i) => i.key.startsWith('best_channel_'),
  );
  if (bestChannelInsight) {
    const value = bestChannelInsight.value as { channel: string };
    recs.push({
      type: 'channel',
      action: `Prioritize ${value.channel} in next content batch`,
      reasoning: bestChannelInsight.evidence,
      expectedImpact: 'Higher revenue per creative unit',
    });
  }

  if (metrics.spendPercent > 90) {
    recs.push({
      type: 'budget',
      action: 'Reduce production spend or request budget increase',
      reasoning: `Mission has spent ${metrics.spendPercent}% of budget`,
      expectedImpact: 'Avoid budget overrun',
    });
  }

  if (metrics.goalCount > 0) {
    const avgProgress =
      metrics.goals.reduce((s, g) => s + g.progressPercent, 0) / metrics.goals.length;
    if (avgProgress < 25) {
      recs.push({
        type: 'content',
        action: 'Re-evaluate content format and posting time',
        reasoning: `Average goal progress is ${Math.round(avgProgress)}%`,
        expectedImpact: 'Improve goal attainment rate',
      });
    }
  }

  return recs;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run the full learning loop for a workspace + mission.
 *
 * Steps:
 * 1. Gather performance events and experiment results.
 * 2. Analyze → extract insights.
 * 3. Update CreativeMemory with evidence-backed insights.
 * 4. Generate recommendations for the next iteration.
 */
export async function runLearningLoop(
  workspaceId: string,
  missionId: string,
  experimentIds: string[] = [],
): Promise<Result<LearningLoopResult, LearningLoopError>> {
  try {
    const events = await getPerformanceEvents(workspaceId);
    const metrics = await getMissionMetrics(missionId);

    const perfInsights = analyzePerformance(events);
    const expInsights = await extractExperimentInsights(workspaceId, experimentIds);
    const insights = [...perfInsights, ...expInsights];

    let memoriesWritten = 0;
    for (const insight of insights) {
      try {
        await recordLearning(
          workspaceId,
          insight.category,
          insight.key,
          insight.value,
          insight.evidence,
          'mission',
          missionId,
        );
        memoriesWritten++;
      } catch {
        // Non-fatal: a single failed memory write shouldn't fail the loop
      }
    }

    const recommendations = generateRecommendations(insights, metrics);

    return success({
      insights,
      recommendations,
      memoriesWritten,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return failure({ code: 'DB_UNAVAILABLE', message });
  }
}

/**
 * Get the latest creative memory for a workspace, grouped by category.
 */
export async function getLatestInsights(
  workspaceId: string,
  category?: CreativeMemory['category'],
): Promise<CreativeMemory[]> {
  return getMemoryByCategory(workspaceId, category ?? 'performance');
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { upsertMemory, getMemoryByCategory, recordLearning };