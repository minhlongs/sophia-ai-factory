/**
 * Unit Economics Dashboard Submodule: Types.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/types
 */

import type { UnitEconomicsSummary } from '@/seed/types/unit-economics-types';

export type DashboardTab = 'overview' | 'providers' | 'tiers' | 'simulator';

export interface UnitEconomicsDashboardProps {
  initialData: UnitEconomicsSummary;
  locale?: 'vi' | 'en';
}
