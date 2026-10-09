/**
 * Customer Health Monitor Types
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/types
 */

import type {
  CustomerHealthMetrics,
  ChurnRiskLevel,
  RetentionSummaryStats,
} from '@/seed/types/retention-types';

export interface CustomerHealthMonitorProps {
  locale?: 'en' | 'vi';
  initialCustomers?: CustomerHealthMetrics[];
  initialSummary?: RetentionSummaryStats;
}

export type HealthFilterType = 'ALL' | ChurnRiskLevel;

export interface ToastState {
  text: string;
  type: 'success' | 'error';
}
