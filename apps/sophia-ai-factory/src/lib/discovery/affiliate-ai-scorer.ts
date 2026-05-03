/**
 * Deterministic affiliate program scoring engine.
 *
 * Scores programs based on commission rate, cookie duration, EPC,
 * and niche relevance. Pure math for reliability.
 *
 * When OPENROUTER_API_KEY is configured, `enhanceWithAI()` can
 * augment niche matching with semantic analysis via OpenRouter.
 */

import type { AffiliateProgram } from "@/seed/types";
import {
  computeComponents,
  computeWeightedScore,
  buildReasoning,
  DEFAULT_WEIGHTS,
  RECOMMENDATION_THRESHOLD,
} from "./affiliate-scoring-primitives";
import type { ScoringWeights } from "./affiliate-scoring-primitives";

/** Score result for a single affiliate program */
export interface AffiliateScore {
  programId: string;
  programName: string;
  relevanceScore: number; // 0-100
  reasoning: string;
  recommended: boolean;
  components: {
    commissionScore: number;
    cookieScore: number;
    epcScore: number;
    nicheMatchScore: number;
  };
}

/**
 * Score a list of affiliate programs against a niche.
 * Returns scores sorted by relevance (highest first).
 */
export function scoreAffiliates(
  programs: AffiliateProgram[],
  niche: string,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): AffiliateScore[] {
  return programs
    .map((program) => {
      const components = computeComponents(program, niche);
      const relevanceScore = computeWeightedScore(components, weights);

      return {
        programId:     program.id,
        programName:   program.name,
        relevanceScore,
        reasoning:     buildReasoning(program, components, relevanceScore),
        recommended:   relevanceScore >= RECOMMENDATION_THRESHOLD,
        components,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Filter to only recommended programs (score >= threshold).
 */
export function getRecommendedAffiliates(
  programs: AffiliateProgram[],
  niche: string,
  threshold: number = RECOMMENDATION_THRESHOLD
): AffiliateScore[] {
  return scoreAffiliates(programs, niche).filter(
    (s) => s.relevanceScore >= threshold
  );
}

// Re-export types for backward compatibility
export type { ScoringWeights };
