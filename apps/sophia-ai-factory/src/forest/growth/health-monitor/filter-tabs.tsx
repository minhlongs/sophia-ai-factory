/**
 * Customer Health Monitor Filter Tabs & Header
 *
 * Layer: Forest (UI components & presentation)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module forest/growth/health-monitor/filter-tabs
 */

import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import type { CustomerHealthMetrics } from '@/seed/types/retention-types';
import type { HealthFilterType } from './types';

interface HealthMonitorHeaderProps {
  isVi: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function HealthMonitorHeader({
  isVi,
  isRefreshing,
  onRefresh,
}: HealthMonitorHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-950">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {isVi
              ? 'Trợ Lý AI Giữ Chân Khách Hàng & Chống Rời Bỏ'
              : 'Autonomous Client Retention & Anti-Churn AI Guardian'}
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            R1 Live
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-400 max-w-2xl">
          {isVi
            ? 'Thuật toán tính điểm Sức khỏe 4 yếu tố (0–100) theo thời gian thực từ D1. Tự động cảnh báo qua Telegram & Email khi điểm < 40 kèm can thiệp 1-Click cho Founder.'
            : 'Real-time 4-factor Customer Health scoring (0–100) from D1 telemetry. Automated Resend & Telegram alerts when health < 40 with 1-Click Founder credit grant.'}
        </p>
      </div>

      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition shadow-sm disabled:opacity-50 self-start sm:self-auto"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`}
        />
        {isVi ? 'Cập nhật' : 'Sync Health'}
      </button>
    </div>
  );
}

interface FilterTabsProps {
  filter: HealthFilterType;
  setFilter: (filter: HealthFilterType) => void;
  customers: CustomerHealthMetrics[];
  isVi: boolean;
}

export function FilterTabs({
  filter,
  setFilter,
  customers,
  isVi,
}: FilterTabsProps) {
  const criticalCount = customers.filter(
    (c) => c.status === 'CRITICAL_CHURN_RISK',
  ).length;
  const warningCount = customers.filter((c) => c.status === 'WARNING').length;
  const healthyCount = customers.filter((c) => c.status === 'HEALTHY').length;

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
      <button
        onClick={() => setFilter('ALL')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
          filter === 'ALL'
            ? 'bg-zinc-800 text-white border border-zinc-700'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        {isVi ? 'Tất cả' : 'All'} ({customers.length})
      </button>
      <button
        onClick={() => setFilter('CRITICAL_CHURN_RISK')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
          filter === 'CRITICAL_CHURN_RISK'
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            : 'text-zinc-400 hover:text-rose-300'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        {isVi ? 'Nguy cơ cao (<40)' : 'Critical Risk'} ({criticalCount})
      </button>
      <button
        onClick={() => setFilter('WARNING')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
          filter === 'WARNING'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'text-zinc-400 hover:text-amber-300'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        {isVi ? 'Cảnh báo (40-69)' : 'Warning'} ({warningCount})
      </button>
      <button
        onClick={() => setFilter('HEALTHY')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
          filter === 'HEALTHY'
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'text-zinc-400 hover:text-emerald-300'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        {isVi ? 'Khỏe mạnh (>=70)' : 'Healthy'} ({healthyCount})
      </button>
    </div>
  );
}
