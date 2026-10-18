/**
 * Customer Discovery Interview Matrix Synthesizer & Transcript Validator
 * Layer: tree/open-core
 * @module tree/open-core/discovery-interview-matrix
 */

import { success, failure, type Result } from '@/seed/types/result';
import type {
  ObjectionCategory,
  RecommendedTier,
  DiscoveryInterviewTranscript,
  InterviewEvaluation,
  ObjectionMatrixSummary,
} from './discovery-interview-evaluator';

const VALID_SEGMENTS: ReadonlySet<string> = new Set(['vn_agency', 'vn_smb', 'creator']);
const VALID_HOSTING: ReadonlySet<string> = new Set(['cloud', 'hybrid', 'self_host']);
export const ALL_OBJECTIONS: readonly ObjectionCategory[] = [
  'pricing', 'byok_complexity', 'data_privacy', 'avatar_quality', 'self_host_preference',
];

function isScoreValid(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val) && val >= 0 && val <= 20;
}

export function validateTranscript(
  t: DiscoveryInterviewTranscript,
): Result<void, { code: string; message: string }> {
  if (!t || typeof t !== 'object') return failure({ code: 'INVALID_TRANSCRIPT', message: 'Transcript must be an object' });
  if (!t.interviewId?.trim()) return failure({ code: 'INVALID_ID', message: 'Interview ID is required' });
  if (!t.prospectName?.trim()) return failure({ code: 'INVALID_PROSPECT_NAME', message: 'Prospect name is required' });
  if (!VALID_SEGMENTS.has(t.segment)) return failure({ code: 'INVALID_SEGMENT', message: `Unknown segment: ${String(t.segment)}` });
  if (isNaN(Date.parse(t.conductedAt))) return failure({ code: 'INVALID_DATE', message: 'conductedAt must be a valid ISO date' });
  if (!isScoreValid(t.videoBottleneckScore) || !isScoreValid(t.currentToolSpendScore) || !isScoreValid(t.byokReadinessScore)) {
    return failure({ code: 'INVALID_SCORE_RANGE', message: 'Dimension scores must be between 0 and 20' });
  }
  if (typeof t.willingnessToPayMonthlyUsd !== 'number' || isNaN(t.willingnessToPayMonthlyUsd) || t.willingnessToPayMonthlyUsd < 0) {
    return failure({ code: 'INVALID_WTP', message: 'willingnessToPayMonthlyUsd must be a non-negative number' });
  }
  if (!VALID_HOSTING.has(t.cloudVsSelfHostPreference)) return failure({ code: 'INVALID_HOSTING_PREF', message: 'Invalid hosting preference' });
  return success(undefined);
}

export function resolveRecommendedTier(wtp: number, prefersSelfHost: boolean): RecommendedTier {
  if (prefersSelfHost && wtp < 199) return 'COMMUNITY_SELF_HOST';
  if (wtp >= 4999) return 'MASTER';
  if (wtp >= 799) return 'ENTERPRISE';
  if (wtp >= 399) return 'PREMIUM';
  if (wtp >= 199) return 'BASIC';
  return 'COMMUNITY_SELF_HOST';
}

export function synthesizeObjectionMatrix(
  evaluations: readonly InterviewEvaluation[],
): ObjectionMatrixSummary {
  const freq: Record<ObjectionCategory, number> = {
    pricing: 0, byok_complexity: 0, data_privacy: 0, avatar_quality: 0, self_host_preference: 0,
  };
  const tierCounts: Record<RecommendedTier, number> = {
    BASIC: 0, PREMIUM: 0, ENTERPRISE: 0, MASTER: 0, COMMUNITY_SELF_HOST: 0,
  };
  let qualifiedCount = 0;
  for (const ev of evaluations) {
    if (ev.qualifiedForPilot) {
      qualifiedCount++;
      tierCounts[ev.recommendedTier]++;
    }
    for (const obj of ev.objections) if (obj in freq) freq[obj]++;
  }
  let dominant: ObjectionCategory | 'none' = 'none';
  let maxCount = 0;
  for (const cat of ALL_OBJECTIONS) {
    if (freq[cat] > maxCount) {
      maxCount = freq[cat];
      dominant = cat;
    }
  }
  let validatedPricingTier: RecommendedTier = 'BASIC';
  let highestTierCount = 0;
  for (const tier of ['ENTERPRISE', 'PREMIUM', 'BASIC', 'MASTER', 'COMMUNITY_SELF_HOST'] as const) {
    if (tierCounts[tier] > highestTierCount) {
      highestTierCount = tierCounts[tier];
      validatedPricingTier = tier;
    }
  }
  return {
    totalInterviews: evaluations.length,
    qualifiedCount,
    pilotReadinessQualified: qualifiedCount >= 5,
    objectionFrequency: freq,
    dominantObjection: dominant,
    validatedPricingTier,
  };
}
