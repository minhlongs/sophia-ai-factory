/**
 * Solutions Catalog Data Partition — Fashion, Courses & F&B (Facade)
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/fashion-courses-fnb
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { FASHION_SOLUTION } from './fashion-solution';
import { COURSES_FNB_SOLUTIONS } from './courses-fnb-solution';

export const FASHION_COURSES_FNB_SOLUTIONS: SolutionIndustry[] = [
  FASHION_SOLUTION,
  ...COURSES_FNB_SOLUTIONS,
];
