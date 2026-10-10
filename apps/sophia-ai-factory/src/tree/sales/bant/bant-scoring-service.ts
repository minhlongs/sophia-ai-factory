/**
 * BANT Scoring Coordinator & Pipeline Analysis
 *
 * Implements comprehensive 4-factor scoring and recommendations.
 *
 * Layer: tree/sales/bant
 */

import type {
  BantScoreInput,
  BantScoreResult,
  BantAnalysis,
} from '@/seed/types/enterprise-deal';
import { scoreBudget, scoreAuthority } from './criteria-evaluator';
import { scoreNeed, scoreTimeline, classifyFunnelTier } from './lead-tier-ranker';

/**
 * Computes full deterministic BANT qualification and returns structured result.
 */
export function calculateBantScore(input: BantScoreInput): BantScoreResult {
  const budget = scoreBudget(input);
  const authority = scoreAuthority(input);
  const need = scoreNeed(input);
  const timeline = scoreTimeline(input);

  const totalScore = budget.score + authority.score + need.score + timeline.score;
  const pipelineTier = classifyFunnelTier(totalScore);

  let recommendation = '';
  if (pipelineTier === 'hot') {
    recommendation =
      'Immediate executive outreach. Auto-generate custom bilingual proposal, provision 1,000 demo MCU sandbox workspace, and schedule C-Level demo call within 24 hours.';
  } else if (pipelineTier === 'warm') {
    recommendation =
      'Assign to sales discovery cadence. Dispatch targeted case studies, showcase relevant video reel benchmarks, and follow up in 3 business days.';
  } else {
    recommendation =
      'Route to self-service onboarding drip. Enroll in video automation newsletter and invite to monthly group webinar.';
  }

  const analysis: BantAnalysis = {
    budget,
    authority,
    need,
    timeline,
    totalScore,
    tier: pipelineTier,
    recommendation,
    qualifiedAt: Date.now(),
  };

  return {
    totalScore,
    budgetScore: budget.score,
    authorityScore: authority.score,
    needScore: need.score,
    timelineScore: timeline.score,
    pipelineTier,
    analysis,
  };
}
