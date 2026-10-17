'use client';

/**
 * ErrorRateChart Tooltip & Formatting Helpers
 */

import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export interface ErrorRatePoint {
  requests: number;
  errors: number;
}

export function formatErrorRateTimestamp(
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

export function calculateErrorRate(point: ErrorRatePoint): number {
  if (point.requests === 0) return 0;
  return Math.round((point.errors / point.requests) * 10000) / 100;
}

export type ErrorRateCustomTooltipProps = TooltipProps<ValueType, NameType> & {
  payload?: Array<{ payload?: { errors?: number; requests?: number } }>;
  label?: string;
};

export function ErrorRateCustomTooltip({
  active,
  payload,
  label,
}: ErrorRateCustomTooltipProps) {
  if (active && payload && payload.length) {
    const errors = payload[0]?.payload?.errors || 0;
    const requests = payload[0]?.payload?.requests || 0;
    const errorRate = requests > 0 ? ((errors / requests) * 100).toFixed(2) : '0';

    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Errors:</span>
            <span className="font-mono text-red-500">{errors}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Requests:</span>
            <span className="font-mono">{requests}</span>
          </div>
          <div className="flex items-center gap-2 text-sm border-t pt-2 mt-2">
            <span>Error Rate:</span>
            <span
              className={`font-mono font-semibold ${
                parseFloat(errorRate) > 5 ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {errorRate}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
