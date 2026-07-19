'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CHANNEL_COLORS: string[] = [
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#ef4444',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#6366f1',
];

export interface MetricPoint {
  date: string;
  [channel: string]: string | number;
}

export interface MetricsChartProps {
  data: MetricPoint[];
  channels: string[];
  dateRange: { from: string; to: string };
}

export function MetricsChart({
  data,
  channels,
  dateRange,
}: MetricsChartProps) {
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    channels.forEach((ch, i) => {
      map[ch] = CHANNEL_COLORS[i % CHANNEL_COLORS.length];
    });
    return map;
  }, [channels]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
        No metrics data for the selected period.
      </div>
    );
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          />
          <Legend />
          {channels.map((channel) => (
            <Line
              key={channel}
              type="monotone"
              dataKey={channel}
              stroke={colorMap[channel] ?? '#888'}
              strokeWidth={2}
              dot={false}
              name={channel}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
