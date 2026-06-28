/**
 * Scoring logic for SOP performance evaluations.
 * Pure functions — no I/O. Layer: tree (internal)
 */

import type { EvaluationResult } from '@/seed/types/performance-feedback'

/**
 * Compute an EvaluationResult from raw performance metrics.
 * Weights: revenue 50%, views 30%, engagement 20%.
 */
export function computeEvaluation(metrics: Record<string, number>): EvaluationResult {
  const viewsVsExpected =
    metrics.expected_views > 0 ? metrics.actual_views / metrics.expected_views : 0
  const engagementVsExpected =
    metrics.expected_engagement > 0 ? metrics.actual_engagement / metrics.expected_engagement : 0
  const revenueVsExpected =
    metrics.expected_revenue > 0 ? metrics.actual_revenue / metrics.expected_revenue : 0

  const overallScore =
    revenueVsExpected * 0.5 + viewsVsExpected * 0.3 + engagementVsExpected * 0.2

  const recommendations: string[] = []
  if (viewsVsExpected < 0.7) recommendations.push('Increase distribution channels to boost views')
  if (engagementVsExpected < 0.7) recommendations.push('Revise hook and CTA to improve engagement')
  if (revenueVsExpected < 0.7) recommendations.push('Review offer pricing or conversion funnel')
  if (overallScore >= 1.2) recommendations.push('High performer — consider scaling budget')

  return { overallScore, viewsVsExpected, engagementVsExpected, revenueVsExpected, recommendations }
}
