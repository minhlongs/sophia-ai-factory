'use client';

/**
 * ErrorRateChart Component
 *
 * Displays error trends over time using Recharts.
 * Shows error count and error rate percentage.
 */

'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { TimeSeriesPoint } from '@/lib/analytics/types';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface ErrorRateChartProps {
  data: TimeSeriesPoint[];
  granularity: 'hour' | 'day';
  height?: number;
}

export function ErrorRateChart({
  data,
  granularity,
  height = 250,
}: ErrorRateChartProps) {
  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    if (granularity === 'hour') {
      return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric'
      });
    }
    return date.toLocaleDateString('vi-VN', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate error rate percentage
  const calculateErrorRate = (point: TimeSeriesPoint) => {
    if (point.requests === 0) return 0;
    return Math.round((point.errors / point.requests) * 10000) / 100;
  };

  // Enhance data with error rate
  const enhancedData = data.map(point => ({
    ...point,
    errorRate: calculateErrorRate(point),
  }));

  // Custom tooltip with proper Recharts types
  type CustomTooltipProps = TooltipProps<ValueType, NameType> & {
    payload?: Array<{ payload?: { errors?: number; requests?: number } }>;
    label?: string;
  };

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
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
              <span className={`font-mono font-semibold ${parseFloat(errorRate) > 5 ? 'text-red-500' : 'text-green-500'}`}>
                {errorRate}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No error data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={enhancedData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
            label={{ value: 'Error Rate %', angle: 90, position: 'insideRight' }}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="errors"
            name="Errors"
            fill="var(--neon-red, #ef4444)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="errorRate"
            name="Error Rate %"
            fill="var(--neon-orange, #f97316)"
            radius={[4, 4, 0, 0]}
          />
          <ReferenceLine
            yAxisId="right"
            y={5}
            stroke="var(--neon-yellow, #eab308)"
            strokeDasharray="3 3"
            label={{ value: 'Warning (5%)', position: 'right', fill: 'var(--neon-yellow, #eab308)', fontSize: 10 }}
          />
          <ReferenceLine
            yAxisId="right"
            y={10}
            stroke="var(--neon-red, #ef4444)"
            strokeDasharray="3 3"
            label={{ value: 'Critical (10%)', position: 'right', fill: 'var(--neon-red, #ef4444)', fontSize: 10 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
