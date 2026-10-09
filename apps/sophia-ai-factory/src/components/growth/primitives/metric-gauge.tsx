'use client';

/**
 * Presentation Layer Primitive: Metric Gauge
 * Reusable visual circular/linear gauge for Obsidian Cyber-Glass dashboards.
 * Layer: presentation/components/growth/primitives | Max LOC: < 200 | Zero :any
 * @module components/growth/primitives/metric-gauge
 */

import React from 'react';

export interface MetricGaugeProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  variant?: 'amber' | 'indigo' | 'emerald' | 'rose';
  size?: 'sm' | 'md' | 'lg';
}

const COLOR_MAP = {
  amber: 'stroke-amber-400 text-amber-400',
  indigo: 'stroke-indigo-400 text-indigo-400',
  emerald: 'stroke-emerald-400 text-emerald-400',
  rose: 'stroke-rose-400 text-rose-400',
};

const BG_COLOR_MAP = {
  amber: 'stroke-amber-500/10',
  indigo: 'stroke-indigo-500/10',
  emerald: 'stroke-emerald-500/10',
  rose: 'stroke-rose-500/10',
};

export function MetricGauge({
  label,
  value,
  max = 100,
  unit = '%',
  variant = 'amber',
  size = 'md',
}: MetricGaugeProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = size === 'sm' ? 24 : size === 'lg' ? 44 : 34;
  const stroke = size === 'sm' ? 4 : size === 'lg' ? 6 : 5;
  const dimension = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className="flex flex-col items-center justify-center p-3 rounded-xl border border-neutral-800 bg-neutral-900/60"
    >
      <div className="relative flex items-center justify-center">
        <svg
          width={dimension}
          height={dimension}
          className="transform -rotate-90"
        >
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            strokeWidth={stroke}
            className={`fill-none ${BG_COLOR_MAP[variant]}`}
          />
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`fill-none transition-all duration-500 ${COLOR_MAP[variant]}`}
          />
        </svg>
        <div className="absolute text-center">
          <span className={`font-mono font-bold ${size === 'sm' ? 'text-xs' : 'text-sm'} text-white`}>
            {value.toFixed(0)}
          </span>
          <span className="text-[10px] text-neutral-400">{unit}</span>
        </div>
      </div>
      <span className="mt-2 text-xs font-medium text-neutral-400 text-center truncate max-w-[120px]">
        {label}
      </span>
    </div>
  );
}
