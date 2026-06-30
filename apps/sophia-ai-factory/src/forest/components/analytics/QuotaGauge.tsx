'use client';

/**
 * QuotaGauge Component
 *
 * Displays quota utilization percentage as a gauge/meter visualization.
 * Shows used vs limit credits with color-coded warning levels.
 */

'use client';

import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

interface QuotaGaugeProps {
  usedCredits: number;
  limitCredits: number;
  label?: string;
  size?: number;
  showPercentage?: boolean;
}

export function QuotaGauge({
  usedCredits,
  limitCredits,
  label = 'Quota Used',
  size = 200,
  showPercentage = true,
}: QuotaGaugeProps) {
  // Calculate percentage (cap at 100%)
  const percentage = Math.min(
    limitCredits > 0 ? (usedCredits / limitCredits) * 100 : 0,
    100
  );

  // Determine color based on usage level
  const getGaugeColor = (pct: number) => {
    if (pct >= 90) return '#ef4444'; // Red - Critical
    if (pct >= 75) return '#f59e0b'; // Amber - Warning
    if (pct >= 50) return '#eab308'; // Yellow - Moderate
    return '#22c55e'; // Green - Healthy
  };

  const gaugeColor = getGaugeColor(percentage);

  // Data for radial bar chart
  const data = [
    {
      name: 'Used',
      value: percentage,
      fill: gaugeColor,
    },
    {
      name: 'Remaining',
      value: 100 - percentage,
      fill: 'var(--muted)',
    },
  ];

  // Remaining credits
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

/**
 * QuotaGaugeList Component
 *
 * Displays multiple gauges for different quota types
 */
interface QuotaData {
  label: string;
  used: number;
  limit: number;
}

interface QuotaGaugeListProps {
  quotas: QuotaData[];
  columns?: 2 | 3 | 4;
}

export function QuotaGaugeList({ quotas, columns = 3 }: QuotaGaugeListProps) {
  return (
    <div className={`grid gap-6 ${columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
      {quotas.map((quota, index) => (
        <div
          key={index}
          className="bg-card rounded-lg border border-border p-4"
        >
          <QuotaGauge
            usedCredits={quota.used}
            limitCredits={quota.limit}
            label={quota.label}
            size={140}
            showPercentage={true}
          />
        </div>
      ))}
    </div>
  );
}
