'use client';

/**
 * UsageChart Tooltip & Formatting Helpers
 */

import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export function formatChartTimestamp(
  timestamp: number,
  granularity: 'hour' | 'day',
): string {
  const date = new Date(timestamp * 1000);
  if (granularity === 'hour') {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    });
  }
  return date.toLocaleDateString('vi-VN', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatChartNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

export type CustomTooltipProps = TooltipProps<ValueType, NameType> & {
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: unknown }>;
  label?: string;
};

export function UsageChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold mb-2">{label}</p>
        {payload.map((entry: { name?: string; value?: number; color?: string }, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}:</span>
            <span className="font-mono">{formatChartNumber(entry.value as number)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
