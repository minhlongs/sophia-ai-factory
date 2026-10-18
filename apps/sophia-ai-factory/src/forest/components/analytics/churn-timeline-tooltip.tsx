'use client';

/**
 * Custom tooltip component for ChurnTimeline chart.
 * @module forest/components/analytics/churn-timeline-tooltip
 */

import React from 'react';

export interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

export function ChurnTimelineTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-muted border-border rounded shadow-md px-3 py-2 text-xs">
      <p className="font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}
