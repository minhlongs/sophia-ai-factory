/**
 * Customer Health Summary KPI Cards
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/health-score-card
 */

import React from 'react';
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import type {
  CustomerHealthMetrics,
  RetentionSummaryStats,
} from '@/seed/types/retention-types';

interface HealthScoreCardsProps {
  summary: RetentionSummaryStats | null;
  customers: CustomerHealthMetrics[];
  isVi: boolean;
}

export function HealthScoreCards({
  summary,
  customers,
  isVi,
}: HealthScoreCardsProps) {
  const healthyCount =
    summary?.healthyCount ?? customers.filter((c) => c.status === 'HEALTHY').length;
  const warningCount =
    summary?.warningCount ?? customers.filter((c) => c.status === 'WARNING').length;
  const criticalCount =
    summary?.criticalRiskCount ??
    customers.filter((c) => c.status === 'CRITICAL_CHURN_RISK').length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Monitored */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between text-zinc-400 text-xs">
          <span>{isVi ? 'Tổng tài khoản' : 'Monitored Accounts'}</span>
          <HeartPulse className="w-4 h-4 text-zinc-500" />
        </div>
        <div className="mt-2 text-2xl font-bold text-white">
          {summary?.totalMonitored ?? customers.length}
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">
          {isVi ? 'Điểm trung bình:' : 'Avg Health Score:'}{' '}
          <span className="text-zinc-300 font-semibold">
            {summary?.averageHealthScore ?? 85}/100
          </span>
        </div>
      </div>

      {/* Card 2: Healthy */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between text-zinc-400 text-xs">
          <span>{isVi ? 'Tài khoản Khỏe mạnh' : 'Healthy (70-100)'}</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-emerald-400">
          {healthyCount}
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">
          {isVi ? 'Hoạt động đều đặn' : 'Active & rendering'}
        </div>
      </div>

      {/* Card 3: Warning */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between text-zinc-400 text-xs">
          <span>{isVi ? 'Cần chú ý' : 'Warning (40-69)'}</span>
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-amber-400">
          {warningCount}
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">
          {isVi ? 'Giảm tần suất tạo video' : 'Velocity slowing down'}
        </div>
      </div>

      {/* Card 4: Critical Risk */}
      <div className="rounded-xl border border-rose-900/30 bg-rose-950/10 p-4 relative overflow-hidden">
        <div className="flex items-center justify-between text-rose-300 text-xs">
          <span>{isVi ? 'Nguy cơ rời bỏ cao' : 'Critical Risk (<40)'}</span>
          <ShieldAlert className="w-4 h-4 text-rose-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-rose-400">
          {criticalCount}
        </div>
        <div className="mt-1 text-[11px] text-rose-300/70">
          {isVi ? 'Kích hoạt Win-back tự động' : 'Win-back eligible'}
        </div>
      </div>
    </div>
  );
}
