/**
 * Solutions Catalog Data Partition — Insurance, Fitness & Lawyer (Facade)
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/insurance-fitness-lawyer
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { INSURANCE_SOLUTION } from './insurance-solution';
import { FITNESS_LAWYER_SOLUTIONS } from './fitness-lawyer-solution';

export const INSURANCE_FITNESS_LAWYER_SOLUTIONS: SolutionIndustry[] = [
  INSURANCE_SOLUTION,
  ...FITNESS_LAWYER_SOLUTIONS,
];
