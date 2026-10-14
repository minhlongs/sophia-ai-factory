'use client';

/**
 * Usage Area Chart Visualizer
 *
 * Layer: forest/components/analytics
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import type { ChartDataPoint } from './types';
import { CustomTooltip } from './custom-tooltip';

interface ChartContainerProps {
  chartData: ChartDataPoint[];
}

export function ChartContainer({ chartData }: ChartContainerProps) {
  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
          <XAxis
            dataKey="formattedTime"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickMargin={10}
            tick={{ fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tick={{ fill: 'var(--muted-foreground)' }}
            tickFormatter={(value: number) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
              return value.toString();
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              color: 'var(--foreground)',
            }}
          />
          <Area
            type="monotone"
            dataKey="requests"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRequests)"
            name="Requests"
          />
          <Area
            type="monotone"
            dataKey="credits"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorCredits)"
            name="Credits"
          />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorTokens)"
            name="Tokens"
          />
          <Brush
            dataKey="formattedTime"
            height={30}
            stroke="#8b5cf6"
            travellerWidth={10}
            tickFormatter={(value: string) => value.slice(0, 6)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
