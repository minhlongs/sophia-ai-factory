"use client";

/**
 * Rebuilt Revenue & Performance Financial Chart Component
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * Implements Obsidian Cyber-Glass financial visualization:
 * 1. Bottom-up bar growth anchored firmly to baseline (items-end, bottom-0)
 * 2. Background tracks with electric indigo gradient fills
 * 3. Interactive time range selector: 7d, 30d, 6m, ytd
 * 4. Interactive hover tooltips displaying formatted USD revenue
 * 5. Strictly aligned Mon-Sun date labels (1:1 column rhythm)
 * 6. Subtle horizontal reference grid lines
 *
 * @module forest/dashboard/dashboard-revenue-chart
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";

export type ChartPeriod = "7d" | "30d" | "6m" | "ytd";

export interface RevenueDataPoint {
  label: string;
  revenue: number;
  percentage: number;
}

export interface DashboardRevenueChartProps {
  data?: RevenueDataPoint[];
  currentPeriod?: ChartPeriod;
  onPeriodChange?: (period: ChartPeriod) => void;
  className?: string;
}

const PERIOD_DATA_SETS: Record<ChartPeriod, RevenueDataPoint[]> = {
  "7d": [
    { label: "Mon", revenue: 4200, percentage: 44 },
    { label: "Tue", revenue: 6500, percentage: 68 },
    { label: "Wed", revenue: 4800, percentage: 50 },
    { label: "Thu", revenue: 8900, percentage: 92 },
    { label: "Fri", revenue: 7200, percentage: 75 },
    { label: "Sat", revenue: 9600, percentage: 100 },
    { label: "Sun", revenue: 6800, percentage: 70 },
  ],
  "30d": [
    { label: "W1", revenue: 18400, percentage: 62 },
    { label: "W2", revenue: 24100, percentage: 81 },
    { label: "W3", revenue: 21300, percentage: 72 },
    { label: "W4", revenue: 29800, percentage: 100 },
  ],
  "6m": [
    { label: "Apr", revenue: 42000, percentage: 48 },
    { label: "May", revenue: 56000, percentage: 64 },
    { label: "Jun", revenue: 63000, percentage: 72 },
    { label: "Jul", revenue: 71000, percentage: 81 },
    { label: "Aug", revenue: 82000, percentage: 93 },
    { label: "Sep", revenue: 88000, percentage: 100 },
  ],
  ytd: [
    { label: "Q1", revenue: 125000, percentage: 55 },
    { label: "Q2", revenue: 184000, percentage: 81 },
    { label: "Q3", revenue: 228000, percentage: 100 },
  ],
};

export function DashboardRevenueChart({
  data,
  currentPeriod: controlledPeriod,
  onPeriodChange,
  className,
}: DashboardRevenueChartProps) {
  let t: (key: string) => string;
  try {
    const hookT = useTranslations("stitch.dashboard");
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  const [internalPeriod, setInternalPeriod] = useState<ChartPeriod>("7d");
  const activePeriod = controlledPeriod || internalPeriod;

  const handlePeriodChange = (newPeriod: ChartPeriod) => {
    if (!controlledPeriod) {
      setInternalPeriod(newPeriod);
    }
    onPeriodChange?.(newPeriod);
  };

  const periodOptions: Array<{ key: ChartPeriod; label: string }> = [
    { key: "7d", label: t("revenueChart.periods.7d") || "Last 7 Days" },
    { key: "30d", label: t("revenueChart.periods.30d") || "Last 30 Days" },
    { key: "6m", label: t("revenueChart.periods.6m") || "Last 6 Months" },
    { key: "ytd", label: t("revenueChart.periods.ytd") || "Year to Date" },
  ];

  const chartData = data || PERIOD_DATA_SETS[activePeriod] || PERIOD_DATA_SETS["7d"];

  const totalRevenue = chartData.reduce((acc, curr) => acc + curr.revenue, 0);

  return (
    <div
      className={cn(
        "lg:col-span-2 bg-[#12141F]/85 backdrop-blur-xl border border-white/[0.08] hover:border-primary/30 transition-all duration-300 rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.35)] flex flex-col justify-between",
        className
      )}
      data-testid="revenue-chart-card"
    >
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-white tracking-tight">
              {t("revenueChart.title")}
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/25">
              +18.4%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("revenueChart.subtitle")} • Total:{" "}
            <span className="text-white font-mono font-semibold">
              ${totalRevenue.toLocaleString()}
            </span>
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center bg-white/[0.04] p-1 rounded-lg border border-white/[0.08] self-start sm:self-auto">
          {periodOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handlePeriodChange(opt.key)}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                activePeriod === opt.key
                  ? "bg-primary text-white shadow-sm font-bold"
                  : "text-muted-foreground hover:text-white hover:bg-white/[0.04]"
              )}
              data-testid={`period-selector-${opt.key}`}
            >
              {opt.key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative pt-6">
        {/* Subtle Horizontal Reference Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-b border-white/20 w-full" />
          <div className="border-b border-white/10 w-full" />
          <div className="border-b border-white/10 w-full" />
          <div className="border-b border-white/20 w-full" />
        </div>

        {/* Bottom-Up Columns Container */}
        <div
          className="h-56 flex items-end justify-between gap-3 relative z-10"
          data-testid="chart-columns-container"
        >
          {chartData.map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="flex-1 h-full flex flex-col justify-end items-center relative group"
              data-testid={`chart-column-${idx}`}
            >
              {/* Hover Tooltip */}
              <div
                className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-30 px-2.5 py-1 rounded-md bg-[#08090D] border border-white/20 shadow-2xl text-[11px] font-mono text-white whitespace-nowrap"
                role="tooltip"
              >
                <span className="text-slate-400 mr-1">{item.label}:</span>
                <span className="font-bold text-primary">${item.revenue.toLocaleString()}</span>
              </div>

              {/* Column Track & Bottom-Up Bar */}
              <div className="w-full h-full bg-white/[0.03] border border-white/[0.04] rounded-t-md relative flex flex-col justify-end overflow-hidden group-hover:border-primary/40 transition-colors">
                <div
                  className="w-full bg-gradient-to-t from-primary/80 via-primary to-indigo-400 rounded-t-md transition-all duration-500 ease-out group-hover:from-primary group-hover:to-cyan-400 group-hover:shadow-[0_0_16px_rgba(99,102,241,0.6)]"
                  style={{ height: `${Math.min(100, Math.max(8, item.percentage))}%` }}
                  data-testid={`revenue-bar-${idx}`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Date / Period Axis Labels strictly aligned 1:1 with columns */}
        <div className="flex justify-between gap-3 mt-3 pt-2 border-t border-white/[0.06]">
          {chartData.map((item, idx) => (
            <div
              key={`label-${idx}`}
              className="flex-1 text-center text-xs font-mono text-muted-foreground group-hover:text-white transition-colors"
            >
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
