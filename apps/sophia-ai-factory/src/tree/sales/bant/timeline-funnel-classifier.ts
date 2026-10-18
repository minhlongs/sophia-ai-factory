/**
 * BANT Timeline Evaluator and Funnel Classification
 *
 * Layer: tree/sales/bant
 *
 * @module tree/sales/bant/timeline-funnel-classifier
 */

import type {
  BantScoreInput,
  BantFactorBreakdown,
  PipelineTier,
} from '@/seed/types/enterprise-deal';

/**
 * Evaluates the Timeline factor (0–25 points).
 */
export function scoreTimeline(input: BantScoreInput): BantFactorBreakdown {
  let score = 0;
  let reason = '';
  const details: Record<string, unknown> = {};

  const tf = (input.timeframe || '').toLowerCase().trim();

  if (
    tf === 'immediate' ||
    tf.includes('asap') ||
    tf.includes('< 1 month') ||
    tf.includes('now') ||
    tf.includes('urgent')
  ) {
    score = 25;
    reason = 'Immediate rollout / ASAP (< 1 month)';
  } else if (
    tf === '1_to_3_months' ||
    tf.includes('1-3') ||
    tf.includes('current quarter') ||
    tf.includes('q1') ||
    tf.includes('q2') ||
    tf.includes('q3') ||
    tf.includes('q4')
  ) {
    score = 20;
    reason = 'Current quarter rollout (1–3 months)';
  } else if (tf === '3_to_6_months' || tf.includes('3-6') || tf.includes('next quarter')) {
    score = 12;
    reason = 'Next quarter roadmap (3–6 months)';
  } else if (tf === '6_to_12_months' || tf.includes('6-12') || tf.includes('next year')) {
    score = 5;
    reason = 'Long-term evaluation (6–12 months)';
  } else if (tf === 'exploring' || tf.includes('browse') || tf.includes('info')) {
    score = 2;
    reason = 'Early exploratory inquiry / no firm timeline';
  } else {
    score = 5;
    reason = 'Standard default exploratory timeline';
  }

  score = Math.max(0, Math.min(25, Math.round(score)));
  details.timeframe = input.timeframe || 'unspecified';

  return {
    score,
    maxScore: 25,
    factor: 'timeline',
    reason,
    details,
  };
}

/**
 * Classifies a total BANT score into Hot, Warm, or Cold pipeline tier.
 */
export function classifyFunnelTier(totalScore: number): PipelineTier {
  if (totalScore >= 75) return 'hot';
  if (totalScore >= 50) return 'warm';
  return 'cold';
}
