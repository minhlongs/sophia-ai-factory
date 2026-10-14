'use client';

import React from 'react';

export const TIER_COLORS: Record<string, string> = {
  BASIC: '#94a3b8',      // slate-400
  PREMIUM: '#3b82f6',    // blue-500
  ENTERPRISE: '#a855f7', // purple-500
  MASTER: '#f59e0b',     // amber-500
};

export const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

export interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export function TierAdoptionTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
