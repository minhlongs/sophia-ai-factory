/**
 * Solutions Catalog Data Partition — Solopreneur, Dental & Medical (Facade)
 * Layer: Seed (Configuration and static data, imports only seed)
 * @module seed/config/solutions/solopreneur-dental-medical
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';
import { SOLOPRENEUR_SOLUTION } from './solopreneur-solution';
import { DENTAL_MEDICAL_SOLUTIONS } from './dental-medical-solution';

export const SOLOPRENEUR_DENTAL_MEDICAL_SOLUTIONS: SolutionIndustry[] = [
  SOLOPRENEUR_SOLUTION,
  ...DENTAL_MEDICAL_SOLUTIONS,
];
