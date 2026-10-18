'use client';

import React from 'react';
import { Calendar, BarChart3 } from 'lucide-react';
import type { DailyUsageBreakdown } from '@/land/billing/customer-usage-types';

export type UsageMetricKind = 'credits' | 'video' | 'voice' | 'images' | 'tokens';

export interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  active,
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl border transition-all cursor-pointer ${
        active
          ? 'bg-primary/10 border-primary shadow-lg shadow-primary/10'
          : 'bg-[#18181B] border-outline-variant/30 hover:border-primary/40'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-semibold text-on-surface-variant">{title}</span>
        <div className={`p-2 rounded-xl ${active ? 'bg-primary text-white' : 'bg-surface-container-highest text-primary'}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-black text-on-surface tracking-tight mb-1">{value}</div>
      <div className="text-[11px] text-on-surface-variant">{subtitle}</div>
    </div>
  );
}

export interface UsageDailyChartProps {
  dailyUsage: DailyUsageBreakdown[];
  billingPeriod: { start: string; end: string };
  activeMetric: UsageMetricKind;
  onSelectCredits: () => void;
}

export function UsageDailyChart({
  dailyUsage,
  billingPeriod,
  activeMetric,
  onSelectCredits,
}: UsageDailyChartProps) {
  const metricMax = Math.max(
    ...dailyUsage.map((d) => {
      if (activeMetric === 'video') return d.videoMinutes;
      if (activeMetric === 'voice') return d.elevenLabsChars;
      if (activeMetric === 'images') return d.falAiImages;
      if (activeMetric === 'tokens') return d.openRouterTokens;
      return d.creditsUsed;
    }),
    1,
  );

  const getMetricValue = (d: DailyUsageBreakdown) => {
    if (activeMetric === 'video') return `${d.videoMinutes} min`;
    if (activeMetric === 'voice') return `${d.elevenLabsChars.toLocaleString()} chars`;
    if (activeMetric === 'images') return `${d.falAiImages} img`;
    if (activeMetric === 'tokens') return `${d.openRouterTokens.toLocaleString()} tok`;
    return `${d.creditsUsed.toFixed(2)} MCU`;
  };

  const getMetricHeight = (d: DailyUsageBreakdown) => {
    let val = d.creditsUsed;
    if (activeMetric === 'video') val = d.videoMinutes;
    if (activeMetric === 'voice') val = d.elevenLabsChars;
    if (activeMetric === 'images') val = d.falAiImages;
    if (activeMetric === 'tokens') val = d.openRouterTokens;
    return Math.max((val / metricMax) * 100, 4);
  };

  return (
    <div className="bg-[#18181B] border border-outline-variant/30 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Daily Consumption Breakdown • Biểu đồ tiêu thụ theo ngày
          </h3>
          <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Billing Cycle: {billingPeriod.start.slice(0, 10)} to {billingPeriod.end.slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectCredits}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeMetric === 'credits'
                ? 'bg-primary text-white'
                : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Total MCU Credits
          </button>
        </div>
      </div>

      {dailyUsage.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant text-sm border border-dashed border-outline-variant/20 rounded-xl">
          No consumption recorded yet in this billing cycle • Chưa có dữ liệu tiêu thụ trong kỳ này.
        </div>
      ) : (
        <div className="flex items-end gap-2 h-48 pt-6 pb-2 overflow-x-auto custom-scrollbar">
          {dailyUsage.map((day) => (
            <div key={day.date} className="flex-1 min-w-[36px] flex flex-col items-center gap-2 h-full justify-end group">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono text-primary bg-surface-container-highest px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                {getMetricValue(day)}
              </div>
              <div
                style={{ height: `${getMetricHeight(day)}%` }}
                className="w-full max-w-[28px] bg-primary/70 group-hover:bg-primary rounded-t transition-all cursor-pointer"
              />
              <span className="text-[10px] text-on-surface-variant/80 font-mono">
                {day.date.slice(8, 10)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
