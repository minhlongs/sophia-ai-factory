/**
 * Solutions Catalog Data Partition — Automotive, Finance & Travel (Facade)
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/automotive-finance-travel
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { AUTOMOTIVE_SOLUTION } from './automotive-solution';
import { FINANCE_TRAVEL_SOLUTIONS } from './finance-travel-solution';

export const AUTOMOTIVE_FINANCE_TRAVEL_SOLUTIONS: SolutionIndustry[] = [
  AUTOMOTIVE_SOLUTION,
  ...FINANCE_TRAVEL_SOLUTIONS,
];
