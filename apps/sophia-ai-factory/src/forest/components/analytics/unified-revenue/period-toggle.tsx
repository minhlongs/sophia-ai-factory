'use client';

/**
 * Unified Revenue Chart Period Toggle
 * Layer: forest/components/analytics/unified-revenue
 */

import React from 'react';
import { Period, PeriodToggleProps } from './types';

export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  const periods: Period[] = ['7d', '30d', '90d'];
  return (
    <div className="flex gap-1 rounded-lg border border-border p-1 bg-muted/30">
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            value === p
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {p.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
