/**
 * Solutions Catalog — 22+ Industry Profiles for Programmatic SEO Landing Pages.
 *
 * Provides high-converting bilingual copy, tailored pain points,
 * ready-to-run sample video prompts, ROI agency comparisons,
 * testimonials, and FAQs for sub-second SSG rendering.
 *
 * Layer: Seed (Configuration and static data, imports only seed)
 *
 * @module seed/config/solutions-catalog
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { REAL_ESTATE_COSMETICS_SOLUTIONS } from '@/seed/config/solutions/real-estate-cosmetics';
import { FASHION_COURSES_FNB_SOLUTIONS } from '@/seed/config/solutions/fashion-courses-fnb';
import { INSURANCE_FITNESS_LAWYER_SOLUTIONS } from '@/seed/config/solutions/insurance-fitness-lawyer';
import { SAAS_ECOMMERCE_AUTOMATION_SOLUTIONS } from '@/seed/config/solutions/saas-ecommerce-automation';
import { SOLOPRENEUR_DENTAL_MEDICAL_SOLUTIONS } from '@/seed/config/solutions/solopreneur-dental-medical';
import { AUTOMOTIVE_FINANCE_TRAVEL_SOLUTIONS } from '@/seed/config/solutions/automotive-finance-travel';
import { SERVICES_WEDDING_LOGISTICS_SOLUTIONS } from '@/seed/config/solutions/services-wedding-logistics';
import { CONSTRUCTION_PETS_SOLUTIONS } from '@/seed/config/solutions/construction-pets';
import {
  SOLUTION_ALIASES,
  getAllSolutionSlugs as getSlugsHelper,
  resolveSolutionIndustry,
} from '@/seed/config/solutions/solutions-lookup';

export { SOLUTION_ALIASES } from '@/seed/config/solutions/solutions-lookup';

/**
 * 22+ Canonical Industry Solutions Profiles.
 * Assembled from modular category partitions (< 200 LOC per file).
 */
export const PRIMARY_SOLUTIONS: SolutionIndustry[] = [
  ...REAL_ESTATE_COSMETICS_SOLUTIONS,
  ...FASHION_COURSES_FNB_SOLUTIONS,
  ...INSURANCE_FITNESS_LAWYER_SOLUTIONS,
  ...SAAS_ECOMMERCE_AUTOMATION_SOLUTIONS,
  ...SOLOPRENEUR_DENTAL_MEDICAL_SOLUTIONS,
  ...AUTOMOTIVE_FINANCE_TRAVEL_SOLUTIONS,
  ...SERVICES_WEDDING_LOGISTICS_SOLUTIONS,
  ...CONSTRUCTION_PETS_SOLUTIONS,
];

/** Get canonical list of primary solution slugs */
export function getAllSolutionSlugs(): string[] {
  return getSlugsHelper(PRIMARY_SOLUTIONS);
}

/**
 * Find solution industry profile by slug or alias.
 * If slug belongs to the broader 52-niche catalog (`NICHE_LABELS`),
 * a high-quality deterministic fallback profile is generated automatically.
 */
export function getSolutionIndustry(slugOrAlias: string): SolutionIndustry {
  return resolveSolutionIndustry(PRIMARY_SOLUTIONS, slugOrAlias);
}
