/**
 * Creative Learning Loop Recommendation Generator
 *
 * Layer: tree/learning
 */

import { getMissionMetrics } from '@/tree/mission/types';
import type { LearningInsight, LearningRecommendation } from './types';

export function generateRecommendations(
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
