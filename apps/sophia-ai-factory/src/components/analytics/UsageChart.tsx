/**
 * UsageChart Component
 *
 * Displays API calls over time using Recharts line chart.
 * Shows requests and credits trends with customizable granularity.
 */

'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import type { TimeSeriesPoint } from '@/lib/analytics/types';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface UsageChartProps {
  data: TimeSeriesPoint[];
  granularity: 'hour' | 'day';
  showCredits?: boolean;
  showTokens?: boolean;
  height?: number;
}

export function UsageChart({
  data,
  granularity,
  showCredits = true,
  showTokens = false,
  height = 300,
}: UsageChartProps) {
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

  // Format large numbers
  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  // Custom tooltip with proper Recharts types
  type CustomTooltipProps = TooltipProps<ValueType, NameType> & {
    payload?: Array<{ name?: string; value?: number; color?: string; payload?: unknown }>;
    label?: string;
  };

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-2">{label}</p>
          {payload.map((entry: { name?: string; value?: number; color?: string }, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
              <span className="font-mono">{formatNumber(entry.value as number)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">No usage data available</p>
          <p className="text-xs mt-1">Select a different time range to view data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--neon-cyan)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--neon-cyan)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--neon-purple)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--neon-purple)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatNumber}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatNumber}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="requests"
            name="API Requests"
            stroke="var(--neon-cyan)"
            fill="url(#colorRequests)"
            strokeWidth={2}
          />
          {showCredits && (
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="credits"
              name="Credits"
              stroke="var(--neon-purple)"
              fill="url(#colorCredits)"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
