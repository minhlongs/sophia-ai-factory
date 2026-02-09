/**
 * Deterministic affiliate program scoring engine.
 *
 * Scores programs based on commission rate, cookie duration, EPC,
 * and niche relevance. Pure math for reliability.
 *
 * When OPENROUTER_API_KEY is configured, `enhanceWithAI()` can
 * augment niche matching with semantic analysis via OpenRouter.
 */

import type { AffiliateProgram } from "@/types";

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

/** Scoring configuration with tunable weights */
interface ScoringWeights {
  commission: number;
  cookie: number;
  epc: number;
  nicheMatch: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  commission: 0.30,
  cookie: 0.15,
  epc: 0.35,
  nicheMatch: 0.20,
};

const RECOMMENDATION_THRESHOLD = 65;

/**
 * Parse a commission string like "50%", "25-45%", "$100" into a numeric value.
 * For ranges, takes the midpoint. For dollar amounts, normalizes to 0-100 scale.
 */
function parseCommissionRate(commission: string): number {
  const cleaned = commission.replace(/\s/g, "");

  // Range: "25-45%" -> midpoint 35
  const rangeMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    return (low + high) / 2;
  }

  // Percentage: "50%" -> 50
  const percentMatch = cleaned.match(/(\d+(?:\.\d+)?)%/);
  if (percentMatch) {
    return parseFloat(percentMatch[1]);
  }

  // Dollar amount: "$100" -> normalize (cap at 200, scale to 0-100)
  const dollarMatch = cleaned.match(/\$(\d+(?:\.\d+)?)/);
  if (dollarMatch) {
    return Math.min(parseFloat(dollarMatch[1]) / 2, 100);
  }

  return 0;
}

/**
 * Score commission rate (0-100).
 * 50%+ recurring = max score. Scale linearly.
 */
function scoreCommission(program: AffiliateProgram): number {
  const rate = parseCommissionRate(program.commission);
  const typeMultiplier =
    program.commissionType === "recurring" ? 1.3 :
    program.commissionType === "hybrid" ? 1.15 : 1.0;

  return Math.min(rate * typeMultiplier, 100);
}

/**
 * Score cookie duration (0-100).
 * 90+ days = max. 30 days = baseline. 0 = poor.
 */
function scoreCookieDuration(cookieDays: number): number {
  if (cookieDays >= 90) return 100;
  if (cookieDays >= 60) return 80;
  if (cookieDays >= 30) return 60;
  if (cookieDays >= 14) return 40;
  if (cookieDays >= 7) return 20;
  return 5;
}

/**
 * Score EPC (0-100).
 * $15+ = excellent. $5-15 = good. <$5 = average.
 */
function scoreEpc(epc: number): number {
  if (epc >= 20) return 100;
  if (epc >= 15) return 90;
  if (epc >= 10) return 75;
  if (epc >= 5) return 55;
  if (epc >= 2) return 35;
  if (epc > 0) return 15;
  return 0;
}

/**
 * Score niche relevance using keyword matching.
 * Checks program name, category, description, and tags against niche keywords.
 */
function scoreNicheMatch(program: AffiliateProgram, niche: string): number {
  if (!niche) return 50; // No niche = neutral score

  const nicheWords = niche.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const searchableText = [
    program.name,
    program.category,
    program.description ?? "",
    ...(program.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  let matchCount = 0;
  for (const word of nicheWords) {
    if (word.length >= 3 && searchableText.includes(word)) {
      matchCount++;
    }
  }

  if (nicheWords.length === 0) return 50;

  const matchRatio = matchCount / nicheWords.length;

  if (matchRatio >= 0.8) return 100;
  if (matchRatio >= 0.5) return 80;
  if (matchRatio >= 0.3) return 60;
  if (matchRatio > 0) return 40;
  return 20;
}

/**
 * Build a human-readable reasoning string for the score.
 */
function buildReasoning(
  program: AffiliateProgram,
  components: AffiliateScore["components"],
  totalScore: number
): string {
  const parts: string[] = [];

  if (components.commissionScore >= 80) {
    parts.push(`High commission (${program.commission} ${program.commissionType})`);
  }
  if (components.cookieScore >= 80) {
    parts.push(`Long cookie (${program.cookieDuration}d)`);
  }
  if (components.epcScore >= 75) {
    parts.push(`Strong EPC ($${program.epc})`);
  }
  if (components.nicheMatchScore >= 60) {
    parts.push("Good niche fit");
  }

  if (parts.length === 0) {
    parts.push("Average performance metrics");
  }

  return `Score ${totalScore}/100: ${parts.join(", ")}`;
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
      const components = {
        commissionScore: scoreCommission(program),
        cookieScore: scoreCookieDuration(program.cookieDuration),
        epcScore: scoreEpc(program.epc),
        nicheMatchScore: scoreNicheMatch(program, niche),
      };

      const relevanceScore = Math.round(
        components.commissionScore * weights.commission +
        components.cookieScore * weights.cookie +
        components.epcScore * weights.epc +
        components.nicheMatchScore * weights.nicheMatch
      );

      const clampedScore = Math.min(Math.max(relevanceScore, 0), 100);

      return {
        programId: program.id,
        programName: program.name,
        relevanceScore: clampedScore,
        reasoning: buildReasoning(program, components, clampedScore),
        recommended: clampedScore >= RECOMMENDATION_THRESHOLD,
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
