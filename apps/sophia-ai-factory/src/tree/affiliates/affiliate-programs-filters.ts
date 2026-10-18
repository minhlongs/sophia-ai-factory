import { AffiliateProgram, Tier } from "@/seed/types";
import affiliateData from "@/seed/data/affiliate-programs.json";

/**
 * Sorting and taxonomy filter helpers for affiliate programs.
 *
 * @module tree/affiliates/affiliate-programs-filters
 */

function getAll(): AffiliateProgram[] {
  return affiliateData.programs as AffiliateProgram[];
}

function getAccessibleByTier(userTier: Tier): AffiliateProgram[] {
  const allPrograms = getAll();
  const tierOrder: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"];
  const userTierIndex = tierOrder.indexOf(userTier);

  return allPrograms.filter((program) => {
    if (!program.tier) return true;
    const programTierIndex = tierOrder.indexOf(program.tier);
    return userTierIndex >= programTierIndex;
  });
}

/**
 * Sort programs by EPC (Earnings Per Click)
 */
export function sortProgramsByEPC(
  programs: AffiliateProgram[],
  order: "asc" | "desc" = "desc"
): AffiliateProgram[] {
  return [...programs].sort((a, b) => {
    return order === "desc" ? b.epc - a.epc : a.epc - b.epc;
  });
}

/**
 * Get top performing programs
 */
export function getTopPrograms(
  count: number = 10,
  userTier?: Tier
): AffiliateProgram[] {
  const programs = userTier
    ? getAccessibleByTier(userTier)
    : getAll();

  return sortProgramsByEPC(programs, "desc").slice(0, count);
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  const categories = getAll().map((program) => program.category);
  return Array.from(new Set(categories)).sort();
}

/**
 * Get all unique tags
 */
export function getTags(): string[] {
  const tags = getAll().flatMap((program) => program.tags || []);
  return Array.from(new Set(tags)).sort();
}

/**
 * Filter programs by commission type
 */
export function getProgramsByCommissionType(
  type: "recurring" | "one-time" | "hybrid"
): AffiliateProgram[] {
  return getAll().filter((program) => program.commissionType === type);
}

/**
 * Get programs with minimum cookie duration
 */
export function getProgramsWithMinCookieDuration(
  minDays: number
): AffiliateProgram[] {
  return getAll().filter(
    (program) => program.cookieDuration >= minDays
  );
}
