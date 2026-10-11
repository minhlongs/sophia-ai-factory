/**
 * Unified Revenue Chart Types and Constants
 * Layer: forest/components/analytics/unified-revenue
 */

import type { UnifiedRevenueSummary } from '@/land/analytics/queries/revenue-unified-query';

export type Period = '7d' | '30d' | '90d';

export interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

export interface PeriodToggleProps {
  value: Period;
  onChange: (p: Period) => void;
}

export const VERTICAL_COLORS = {
  saas: '#22c55e',
  crypto: '#f97316',
  product: '#3b82f6',
} as const;

export const VERTICAL_LABELS = {
  saas: 'SaaS',
  crypto: 'Crypto',
  product: 'Product',
} as const;

export function fmtAxisDate(dateStr: string, period: Period): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (period === '7d') return d.toLocaleDateString('en', { weekday: 'short' });
  if (period === '90d') return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export type { UnifiedRevenueSummary };
