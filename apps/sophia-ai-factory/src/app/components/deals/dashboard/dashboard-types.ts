/**
 * Deals Admin Dashboard Types
 *
 * Layer: forest/deals
 *
 * @module app/components/deals/dashboard/dashboard-types
 */

import type { EnterpriseDeal } from '@/seed/types/enterprise-deal';

export interface DealsAdminDashboardProps {
  initialDeals: EnterpriseDeal[];
  initialMetrics?: {
    totalDeals: number;
    hotDeals: number;
    warmDeals: number;
    coldDeals: number;
    totalEstimatedValueCents: number;
    avgBantScore: number;
    wonDeals: number;
  };
  locale?: string;
}

export interface DealsFilterState {
  search: string;
  stageFilter: string;
  tierFilter: string;
  viewMode: 'kanban' | 'table';
}
