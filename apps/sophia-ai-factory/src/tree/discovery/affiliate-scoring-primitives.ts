/**
 * Pure scoring primitives for affiliate program evaluation.
 *
 * All functions are deterministic and stateless — no I/O, no external deps.
 * Consumed by affiliate-ai-scorer.ts.
 */

import type { AffiliateProgram } from "@/seed/types";
import {
  parseCommissionRate,
  scoreCommission,
  scoreCookieDuration,
  scoreEpc,
  scoreNicheMatch,
} from "./affiliate-scoring-components";

export {
  parseCommissionRate,
  scoreCommission,
  scoreCookieDuration,
  scoreEpc,
  scoreNicheMatch,
};

/** Score result component breakdown */
export interface ScoringComponents {
  commissionScore: number;
  cookieScore: number;
  epcScore: number;
  nicheMatchScore: number;
}

/** Scoring configuration with tunable weights */
export interface ScoringWeights {
  commission: number;
  cookie: number;
  epc: number;
  nicheMatch: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  commission: 0.30,
  cookie:     0.15,
  epc:        0.35,
  nicheMatch: 0.20,
};

export const RECOMMENDATION_THRESHOLD = 65;

/**
 * Build all component scores for a program.
 */
export function computeComponents(program: AffiliateProgram, niche: string): ScoringComponents {
  return {
    commissionScore:  scoreCommission(program),
    cookieScore:      scoreCookieDuration(program.cookieDuration),
    epcScore:         scoreEpc(program.epc),
    nicheMatchScore:  scoreNicheMatch(program, niche),
  };
}

/**
 * Compute weighted total from component scores.
 */
export function computeWeightedScore(components: ScoringComponents, weights: ScoringWeights): number {
  return Math.min(Math.max(Math.round(
    components.commissionScore * weights.commission +
    components.cookieScore     * weights.cookie +
    components.epcScore        * weights.epc +
    components.nicheMatchScore * weights.nicheMatch
  ), 0), 100);
}

/**
 * Build human-readable reasoning for a score.
 */
export function buildReasoning(
  program: AffiliateProgram,
  components: ScoringComponents,
  totalScore: number
): string {
  const parts: string[] = [];
  if (components.commissionScore >= 80) parts.push(`High commission (${program.commission} ${program.commissionType})`);
  if (components.cookieScore     >= 80) parts.push(`Long cookie (${program.cookieDuration}d)`);
  if (components.epcScore        >= 75) parts.push(`Strong EPC ($${program.epc})`);
  if (components.nicheMatchScore >= 60) parts.push("Good niche fit");
  if (parts.length === 0) parts.push("Average performance metrics");
  return `Score ${totalScore}/100: ${parts.join(", ")}`;
}
