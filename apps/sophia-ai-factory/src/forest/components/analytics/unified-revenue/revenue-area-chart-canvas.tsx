'use client';

/**
 * Unified Revenue Area Chart Canvas & Vertical Badges
 * Layer: forest/components/analytics/unified-revenue
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/land/analytics/formatters';
import {
  UnifiedRevenueSummary,
  VERTICAL_COLORS,
  VERTICAL_LABELS,
} from './types';
import { CustomTooltip } from './chart-tooltip';

export interface RevenueAreaChartCanvasProps {
  chartData: Array<UnifiedRevenueSummary['dailySeries'][number] & { label: string }>;
  byVertical: UnifiedRevenueSummary['byVertical'];
}

const VERTICALS = ['saas', 'crypto', 'product'] as const;

export function RevenueAreaChartCanvas({
  chartData,
  byVertical,
}: RevenueAreaChartCanvasProps) {
  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            {VERTICALS.map((v) => (
              <linearGradient key={v} id={`grad-${v}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={VERTICAL_COLORS[v]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={VERTICAL_COLORS[v]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(v) => VERTICAL_LABELS[v as keyof typeof VERTICAL_LABELS] ?? v}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px' }}
          />
          {VERTICALS.map((v) => (
            <Area
              key={v}
              type="monotone"
              dataKey={v}
              name={v}
              stackId="1"
              stroke={VERTICAL_COLORS[v]}
              strokeWidth={2}
              fill={`url(#grad-${v})`}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-4 flex-wrap">
        {VERTICALS.map((v) => (
          <div
            key={v}
            className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: `${VERTICAL_COLORS[v]}20`, color: VERTICAL_COLORS[v] }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: VERTICAL_COLORS[v] }}
            />
            {VERTICAL_LABELS[v]}: {formatCurrency(byVertical[v])}
          </div>
        ))}
      </div>
    </>
  );
}
