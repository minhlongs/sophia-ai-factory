/**
 * Types for SolutionInteractiveSections
 *
 * Layer: forest/solutions/interactive-sections
 */

import type { SolutionIndustry } from '@/seed/types/solutions-types';

export interface SolutionInteractiveSectionsProps {
  industry: SolutionIndustry;
  locale: 'en' | 'vi';
}
