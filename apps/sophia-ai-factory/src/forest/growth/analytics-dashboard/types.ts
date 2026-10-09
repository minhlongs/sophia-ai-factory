/**
 * @file types.ts
 * @description Types for Growth Analytics Executive Dashboard.
 * @layer forest
 */

import type { GrowthAnalyticsSummary } from '@/seed/types/solutions-types';

export interface GrowthAnalyticsDashboardProps {
  initialData: GrowthAnalyticsSummary;
  locale?: 'en' | 'vi';
}
