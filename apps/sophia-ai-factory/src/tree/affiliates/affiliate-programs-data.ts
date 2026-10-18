import { AffiliateProgram, Tier } from "@/seed/types";
import affiliateData from "@/seed/data/affiliate-programs.json";
export {
  getCategories,
  getProgramsByCommissionType,
  getProgramsWithMinCookieDuration,
  getTags,
  getTopPrograms,
  sortProgramsByEPC,
} from "./affiliate-programs-filters";

/**
 * Data access layer for affiliate programs — domain tree layer.
 * Provides filtering, sorting, and tier-based access control.
 *
 * @module tree/affiliates/affiliate-programs-data
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
