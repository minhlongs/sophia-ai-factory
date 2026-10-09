/**
 * Customer Health Score Badges and Helpers
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/health-badges
 */

import React from 'react';
import { Clock } from 'lucide-react';
import type { CustomerHealthMetrics } from '@/seed/types/retention-types';

export function getScoreBadgeColor(score: number): string {
  if (score >= 70) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (score >= 40) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
}

export function getScoreProgressColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

export function renderStatusBadge(cust: CustomerHealthMetrics, isVi: boolean): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase inline-flex items-center gap-1 w-fit ${
          cust.status === 'HEALTHY'
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : cust.status === 'WARNING'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}
      >
        {cust.status === 'HEALTHY'
          ? isVi ? 'Khỏe mạnh' : 'Healthy'
          : cust.status === 'WARNING'
            ? isVi ? 'Cảnh báo' : 'Warning'
            : isVi ? 'Nguy cơ rời bỏ' : 'Churn Risk'}
      </span>

      {cust.inCooldown && (
        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
          <Clock className="w-3 h-3 text-zinc-400" />
          {isVi ? 'Đang hạ nhiệt (7d)' : 'Cooldown active'}
        </span>
      )}
    </div>
  );
}
