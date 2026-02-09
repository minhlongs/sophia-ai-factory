import { AffiliateProgram, Tier } from "@/types";
import affiliateData from "@/data/affiliate-programs.json";

/**
 * Data access layer for affiliate programs
 * Provides filtering, sorting, and tier-based access control
 */

/**
 * Get all affiliate programs
 */
export function getAllPrograms(): AffiliateProgram[] {
  return affiliateData.programs as AffiliateProgram[];
}

/**
 * Get programs filtered by tier access
 * @param userTier - Current user's tier
 * @param limit - Maximum number of programs to return (-1 for unlimited)
 */
export function getProgramsByTier(
  userTier: Tier,
  limit: number = -1
): AffiliateProgram[] {
  const allPrograms = getAllPrograms();

  // Define tier hierarchy
  const tierOrder: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"];
  const userTierIndex = tierOrder.indexOf(userTier);

  // Filter programs user can access
  const accessiblePrograms = allPrograms.filter((program) => {
    if (!program.tier) return true; // No tier restriction

    const programTierIndex = tierOrder.indexOf(program.tier);
    return userTierIndex >= programTierIndex;
  });

  // Apply limit
  if (limit > 0) {
    return accessiblePrograms.slice(0, limit);
  }

  return accessiblePrograms;
}

/**
 * Get programs by category
 */
export function getProgramsByCategory(category: string): AffiliateProgram[] {
  return getAllPrograms().filter(
    (program) => program.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get programs by tag
 */
export function getProgramsByTag(tag: string): AffiliateProgram[] {
  return getAllPrograms().filter((program) =>
    program.tags?.some((t) => t.toLowerCase() === tag.toLowerCase())
  );
}

/**
 * Search programs by name or description
 */
export function searchPrograms(query: string): AffiliateProgram[] {
  const lowerQuery = query.toLowerCase();

  return getAllPrograms().filter(
    (program) =>
      program.name.toLowerCase().includes(lowerQuery) ||
      program.description?.toLowerCase().includes(lowerQuery) ||
      program.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get program by ID
 */
export function getProgramById(id: string): AffiliateProgram | undefined {
  return getAllPrograms().find((program) => program.id === id);
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
    ? getProgramsByTier(userTier)
    : getAllPrograms();

  return sortProgramsByEPC(programs, "desc").slice(0, count);
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  const categories = getAllPrograms().map((program) => program.category);
  return Array.from(new Set(categories)).sort();
}

/**
 * Get all unique tags
 */
export function getTags(): string[] {
  const tags = getAllPrograms().flatMap((program) => program.tags || []);
  return Array.from(new Set(tags)).sort();
}

/**
 * Filter programs by commission type
 */
export function getProgramsByCommissionType(
  type: "recurring" | "one-time" | "hybrid"
): AffiliateProgram[] {
  return getAllPrograms().filter((program) => program.commissionType === type);
}

/**
 * Get programs with minimum cookie duration
 */
export function getProgramsWithMinCookieDuration(
  minDays: number
): AffiliateProgram[] {
  return getAllPrograms().filter(
    (program) => program.cookieDuration >= minDays
  );
}
