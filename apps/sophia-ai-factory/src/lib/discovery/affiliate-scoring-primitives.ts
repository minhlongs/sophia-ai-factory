/**
 * Pure scoring primitives for affiliate program evaluation.
 *
 * All functions are deterministic and stateless — no I/O, no external deps.
 * Consumed by affiliate-ai-scorer.ts.
 */

import type { AffiliateProgram } from "@/seed/types";

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

// -------------------------------------------------------------------------
// Commission parsing
// -------------------------------------------------------------------------

/**
 * Parse a commission string like "50%", "25-45%", "$100" into a numeric value.
 * Ranges → midpoint. Dollar amounts → normalize to 0-100 scale.
 */
export function parseCommissionRate(commission: string): number {
  const cleaned = commission.replace(/\s/g, "");

  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%/);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }

  const percentMatch = cleaned.match(/(\d+(?:\.\d+)?)%/);
  if (percentMatch) return parseFloat(percentMatch[1]);

  const dollarMatch = cleaned.match(/\$(\d+(?:\.\d+)?)/);
  if (dollarMatch) return Math.min(parseFloat(dollarMatch[1]) / 2, 100);

  return 0;
}

// -------------------------------------------------------------------------
// Component scorers
// -------------------------------------------------------------------------

/** Score commission rate (0-100). 50%+ recurring = max. */
export function scoreCommission(program: AffiliateProgram): number {
  const rate = parseCommissionRate(program.commission);
  const multiplier =
    program.commissionType === "recurring" ? 1.3 :
    program.commissionType === "hybrid"    ? 1.15 : 1.0;
  return Math.min(rate * multiplier, 100);
}

/** Score cookie duration (0-100). 90+ days = max. */
export function scoreCookieDuration(cookieDays: number): number {
  if (cookieDays >= 90) return 100;
  if (cookieDays >= 60) return 80;
  if (cookieDays >= 30) return 60;
  if (cookieDays >= 14) return 40;
  if (cookieDays >= 7)  return 20;
  return 5;
}

/** Score EPC (0-100). $15+ = excellent. */
export function scoreEpc(epc: number): number {
  if (epc >= 20) return 100;
  if (epc >= 15) return 90;
  if (epc >= 10) return 75;
  if (epc >= 5)  return 55;
  if (epc >= 2)  return 35;
  if (epc > 0)   return 15;
  return 0;
}

/** Score niche relevance via keyword matching (0-100). */
export function scoreNicheMatch(program: AffiliateProgram, niche: string): number {
  if (!niche) return 50;

  const nicheWords = niche.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const searchableText = [
    program.name,
    program.category,
    program.description ?? "",
    ...(program.tags ?? []),
  ].join(" ").toLowerCase();

  let matchCount = 0;
  for (const word of nicheWords) {
    if (word.length >= 3 && searchableText.includes(word)) matchCount++;
  }

  if (nicheWords.length === 0) return 50;
  const ratio = matchCount / nicheWords.length;

  if (ratio >= 0.8) return 100;
  if (ratio >= 0.5) return 80;
  if (ratio >= 0.3) return 60;
  if (ratio > 0)    return 40;
  return 20;
}

// -------------------------------------------------------------------------
// Aggregate scorer + reasoning
// -------------------------------------------------------------------------

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
