/**
 * Solutions Catalog Data Partition — SaaS, E-Commerce & Automation (Facade)
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/saas-ecommerce-automation
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { SAAS_SOLUTION } from './saas-solution';
import { ECOMMERCE_AUTOMATION_SOLUTIONS } from './ecommerce-automation-solution';

export const SAAS_ECOMMERCE_AUTOMATION_SOLUTIONS: SolutionIndustry[] = [
  SAAS_SOLUTION,
  ...ECOMMERCE_AUTOMATION_SOLUTIONS,
];
