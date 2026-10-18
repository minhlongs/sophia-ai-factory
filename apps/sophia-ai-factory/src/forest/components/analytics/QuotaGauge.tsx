'use client';

/**
 * QuotaGauge Component
 *
 * Displays quota utilization percentage as a gauge/meter visualization.
 * Shows used vs limit credits with color-coded warning levels.
 */

import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { QuotaGaugeList, type QuotaData, type QuotaGaugeListProps } from './quota-gauge-list';

export { QuotaGaugeList, type QuotaData, type QuotaGaugeListProps };

export interface QuotaGaugeProps {
  usedCredits: number;
  limitCredits: number;
  label?: string;
  size?: number;
  showPercentage?: boolean;
}

const getGaugeColor = (pct: number) => {
  if (pct >= 90) return '#ef4444'; // Red - Critical
  if (pct >= 75) return '#f59e0b'; // Amber - Warning
  if (pct >= 50) return '#eab308'; // Yellow - Moderate
  return '#22c55e'; // Green - Healthy
};

export function QuotaGauge({
  usedCredits,
  limitCredits,
  label = 'Quota Used',
  size = 200,
  showPercentage = true,
}: QuotaGaugeProps) {
  const percentage = Math.min(
    limitCredits > 0 ? (usedCredits / limitCredits) * 100 : 0,
    100
  );
  const gaugeColor = getGaugeColor(percentage);
  const data = [
    { name: 'Used', value: percentage, fill: gaugeColor },
    { name: 'Remaining', value: 100 - percentage, fill: 'var(--muted)' },
  ];
  const remaining = Math.max(limitCredits - usedCredits, 0);

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div style={{ width: size, height: size * 0.75 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="100%"
            innerRadius="60%"
            outerRadius="100%"
            barSize={20}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <RadialBar
              background
              cornerRadius={10}
              dataKey="value"
              fill="#8884d8"
            />
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>

      {showPercentage && (
        <div className="text-center -mt-16">
          <div className="text-3xl font-bold" style={{ color: gaugeColor }}>
            {percentage.toFixed(0)}%
          </div>
        </div>
      )}

      <div className="text-center mt-2">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-xs text-muted-foreground mt-1">
          Used: <span className="font-mono font-semibold">{usedCredits.toLocaleString()}</span>
          {' '}|{' '}
          Remaining: <span className="font-mono font-semibold">{remaining.toLocaleString()}</span>
          {' '}|{' '}
          Limit: <span className="font-mono">{limitCredits.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
