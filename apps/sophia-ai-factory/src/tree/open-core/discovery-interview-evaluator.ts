/**
 * Customer Discovery Interview Evaluator & Objection Matrix Synthesizer
 * Layer: tree/open-core
 * @module tree/open-core/discovery-interview-evaluator
 */

import { success, failure, type Result } from '@/seed/types/result';
import {
  ALL_OBJECTIONS,
  validateTranscript,
  resolveRecommendedTier,
  synthesizeObjectionMatrix,
} from './discovery-interview-matrix';

export {
  validateTranscript,
  resolveRecommendedTier,
  synthesizeObjectionMatrix,
};

export type ObjectionCategory =
  | 'pricing'
  | 'byok_complexity'
  | 'data_privacy'
  | 'avatar_quality'
  | 'self_host_preference';

export type ProspectSegment = 'vn_agency' | 'vn_smb' | 'creator';
export type RecommendedTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER' | 'COMMUNITY_SELF_HOST';

export interface DiscoveryInterviewTranscript {
  readonly interviewId: string;
  readonly prospectName: string;
  readonly segment: ProspectSegment;
  readonly conductedAt: string;
  readonly videoBottleneckScore: number;
  readonly currentToolSpendScore: number;
  readonly byokReadinessScore: number;
  readonly willingnessToPayMonthlyUsd: number;
  readonly cloudVsSelfHostPreference: 'cloud' | 'hybrid' | 'self_host';
  readonly rawObjections: readonly ObjectionCategory[];
}

export type InterviewTranscript = DiscoveryInterviewTranscript;

export interface DimensionBreakdown {
  readonly videoBottleneck: number;
  readonly toolSpend: number;
  readonly byokReadiness: number;
  readonly budgetFit: number;
  readonly hostingFit: number;
}

export interface InterviewEvaluation {
  readonly interviewId: string;
  readonly prospectName: string;
  readonly segment: ProspectSegment;
  readonly conductedAt: string;
  readonly icpFitScore: number;
  readonly recommendedTier: RecommendedTier;
  readonly qualifiedForPilot: boolean;
  readonly objections: readonly ObjectionCategory[];
  readonly dimensionBreakdown: DimensionBreakdown;
}

export interface ObjectionMatrixSummary {
  readonly totalInterviews: number;
  readonly qualifiedCount: number;
  readonly pilotReadinessQualified: boolean;
  readonly objectionFrequency: Record<ObjectionCategory, number>;
  readonly dominantObjection: ObjectionCategory | 'none';
  readonly validatedPricingTier: RecommendedTier;
}

export function evaluateDiscoveryInterview(
  t: DiscoveryInterviewTranscript,
): Result<InterviewEvaluation, { code: string; message: string }> {
  const valRes = validateTranscript(t);
  if (!valRes.ok) return failure(valRes.error);
  const wtp = t.willingnessToPayMonthlyUsd;
  const budgetFit = wtp >= 799 ? 20 : wtp >= 399 ? 15 : wtp >= 199 ? 10 : 5;
  const hostingFit = t.cloudVsSelfHostPreference === 'cloud' ? 20 : t.cloudVsSelfHostPreference === 'hybrid' ? 15 : 5;
  const totalScore = Math.min(100, t.videoBottleneckScore + t.currentToolSpendScore + t.byokReadinessScore + budgetFit + hostingFit);
  const recommendedTier = resolveRecommendedTier(wtp, t.cloudVsSelfHostPreference === 'self_host');
  return success({
    interviewId: t.interviewId.trim(),
    prospectName: t.prospectName.trim(),
    segment: t.segment,
    conductedAt: t.conductedAt,
    icpFitScore: totalScore,
    recommendedTier,
    qualifiedForPilot: totalScore >= 65 && wtp >= 199,
    objections: Array.isArray(t.rawObjections) ? t.rawObjections.filter((o) => ALL_OBJECTIONS.includes(o)) : [],
    dimensionBreakdown: {
      videoBottleneck: t.videoBottleneckScore,
      toolSpend: t.currentToolSpendScore,
      byokReadiness: t.byokReadinessScore,
      budgetFit,
      hostingFit,
    },
  });
}
