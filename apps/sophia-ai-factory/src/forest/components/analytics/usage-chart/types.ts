'use client';

/**
 * Usage Chart Types & Interfaces
 *
 * Layer: forest/components/analytics
 */

import type { TimeSeriesPoint } from '@/forest/analytics/types';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export type UsageMetric = 'requests' | 'credits' | 'tokens';

export interface UsageChartProps {
  data: TimeSeriesPoint[] | null;
  metric: UsageMetric;
  granularity: 'hour' | 'day';
  loading?: boolean;
  title?: string;
}

export interface ChartDataPoint {
  timestamp: number;
  formattedTime: string;
  requests: number;
  credits: number;
  tokens: number;
}

export type CustomTooltipProps = TooltipProps<ValueType, NameType> & {
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string;
};

export function formatTimestamp(timestamp: number, granularity: 'hour' | 'day'): string {
  const date = new Date(timestamp * 1000);
  if (granularity === 'hour') {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
    });
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
