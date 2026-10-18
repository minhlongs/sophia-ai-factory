'use client';

import React from 'react';

export type UsageMetricKind = 'credits' | 'video' | 'voice' | 'images' | 'tokens';

export interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  active,
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl border transition-all cursor-pointer ${
        active
          ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
          : 'bg-[#18181B] border-outline-variant/30 hover:border-primary/40'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-semibold text-on-surface-variant">{title}</span>
        <div className={`p-2 rounded-xl ${active ? 'bg-primary text-white' : 'bg-surface-container-highest text-primary'}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-black text-on-surface tracking-tight mb-1">{value}</div>
      <div className="text-[11px] text-on-surface-variant">{subtitle}</div>
    </div>
  );
}
