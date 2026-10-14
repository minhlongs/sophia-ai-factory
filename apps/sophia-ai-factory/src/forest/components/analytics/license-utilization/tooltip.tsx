'use client';

import React from 'react';
import { Badge } from '@/seed/components/ui/badge';
import { ChartDataPoint, tierToBadgeVariant } from './types';

export function CustomTooltip({ active, payload }: { active?: boolean; payload?: unknown[] }) {
  if (active && payload && payload.length) {
    const data = (payload[0] as { payload: ChartDataPoint }).payload;
    const formatCredits = (num: number) => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
      return num.toLocaleString();
    };

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={tierToBadgeVariant(data.tier)}>
            {data.tier}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Used:</span>
            <span className="text-xs font-medium text-foreground">
              {formatCredits(data.usedCredits)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Available:</span>
            <span className="text-xs font-medium text-foreground">
              {formatCredits(data.availableCredits)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Utilization:</span>
            <span className="text-xs font-medium text-foreground">
              {data.percentage.toFixed(1)}%
            </span>
          </div>
          {data.expiresAt && (
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Expires:</span>
              <span className="text-xs font-medium text-foreground">
                {new Date(data.expiresAt * 1000).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}
