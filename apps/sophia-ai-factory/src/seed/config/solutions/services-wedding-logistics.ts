/**
 * Solutions Catalog Data Partition — Services, Wedding & Logistics (Facade)
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/services-wedding-logistics
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { HOME_SERVICES_SOLUTION } from './home-services-solution';
import { WEDDING_LOGISTICS_SOLUTIONS } from './wedding-logistics-solution';

export const SERVICES_WEDDING_LOGISTICS_SOLUTIONS: SolutionIndustry[] = [
  HOME_SERVICES_SOLUTION,
  ...WEDDING_LOGISTICS_SOLUTIONS,
];
