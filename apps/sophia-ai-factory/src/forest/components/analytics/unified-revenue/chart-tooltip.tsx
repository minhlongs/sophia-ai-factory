'use client';

/**
 * Unified Revenue Chart Custom Tooltip
 * Layer: forest/components/analytics/unified-revenue
 */

import React from 'react';
import { formatCurrency } from '@/land/analytics/formatters';
import { CustomTooltipProps, VERTICAL_LABELS } from './types';

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg text-sm min-w-[140px]">
      <p className="font-medium text-muted-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>
            {VERTICAL_LABELS[p.name as keyof typeof VERTICAL_LABELS] ?? p.name}
          </span>
          <span className="font-medium tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
