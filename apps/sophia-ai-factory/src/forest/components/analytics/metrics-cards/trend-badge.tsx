'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/seed/utils/cn';

interface TrendBadgeProps {
  trend: number;
}

export function TrendBadge({ trend }: TrendBadgeProps) {
  const isPositive = trend >= 0;

  return (
    <>
      {isPositive ? (
        <TrendingUp className="h-3 w-3 text-emerald-500" />
      ) : (
        <TrendingDown className="h-3 w-3 text-red-500" />
      )}
      <span
        className={cn(
          'text-xs',
          isPositive ? 'text-emerald-500' : 'text-red-500'
        )}
      >
        {isPositive ? '+' : ''}
        {trend.toFixed(1)}%
      </span>
    </>
  );
}

interface SparklineProps {
  data?: number[];
  color?: string;
}

export function Sparkline({ data, color = 'rgb(139, 92, 246)' }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min === 0 ? 1 : max - min;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = 30 - ((val - min) / range) * 22 - 4; // leave margin top/bottom
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <div className="h-6 w-full mt-2 overflow-hidden">
      <svg
        viewBox="0 0 100 30"
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

interface CircularProgressRingProps {
  used: number;
  limit: number;
}

export function CircularProgressRing({ used, limit }: CircularProgressRingProps) {
  const percentage = Math.min(100, Math.max(0, limit > 0 ? (used / limit) * 100 : 0));
  const radius = 20;
  const stroke = 3;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          stroke="rgba(255, 255, 255, 0.05)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="rgb(16, 185, 129)" // emerald-500
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <span className="absolute text-[8px] font-bold text-emerald-400">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
