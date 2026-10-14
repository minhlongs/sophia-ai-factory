'use client';

/**
 * Usage Chart Custom Tooltip
 *
 * Layer: forest/components/analytics
 */

import React from 'react';
import type { CustomTooltipProps, ChartDataPoint } from './types';

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-muted-foreground">Requests:</span>
            <span className="text-xs font-medium text-foreground">
              {data.requests.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-xs text-muted-foreground">Credits:</span>
            <span className="text-xs font-medium text-foreground">
              {data.credits.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Tokens:</span>
            <span className="text-xs font-medium text-foreground">
              {data.tokens.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
