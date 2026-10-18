'use client';

import React from 'react';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export interface ServiceBreakdownTooltipItem {
  service: string;
  requests: number;
  credits: number;
  percentage: number;
}

// Service colors - consistent with the design system
export const SERVICE_COLORS: Record<string, string> = {
  heygen: '#3b82f6',
  elevenlabs: '#8b5cf6',
  openrouter: '#10b981',
  default: '#f59e0b',
};

export type CustomTooltipProps = TooltipProps<ValueType, NameType> & {
  payload?: Array<{ payload: ServiceBreakdownTooltipItem }>;
};

export function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground capitalize mb-2">
          {data.service}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Requests:</span>
            <span className="text-xs font-medium text-foreground">
              {data.requests.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Credits:</span>
            <span className="text-xs font-medium text-foreground">
              {data.credits.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Share:</span>
            <span className="text-xs font-medium text-foreground">
              {data.percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
