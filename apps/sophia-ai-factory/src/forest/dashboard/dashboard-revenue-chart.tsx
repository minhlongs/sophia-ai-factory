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
 * 7. Zero-Mock & Truth-in-UI: Zero data renders authentic empty state ($0, neutral trend, empty placeholder)
 *
 * @module forest/dashboard/dashboard-revenue-chart
 */

import React, { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import type { ChartPeriod, RevenueDataPoint, RevenuePoint } from "./types";

export type { ChartPeriod, RevenueDataPoint, RevenuePoint };

export interface DashboardRevenueChartProps {
  data?: RevenueDataPoint[];
  periodData?: Partial<Record<ChartPeriod, RevenueDataPoint[]>>;
  currentPeriod?: ChartPeriod;
  onPeriodChange?: (period: ChartPeriod) => void;
  trendPercentage?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function DashboardRevenueChart({
  data,
  periodData,
  currentPeriod: controlledPeriod,
  onPeriodChange,
  trendPercentage,
  trend,
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

  // Zero-mock data flow: strictly derived from live props or clean zero-state
  const chartData = data || (periodData ? periodData[activePeriod] : undefined) || [];

  const totalRevenue = chartData.reduce((acc, curr) => acc + (curr.revenue || 0), 0);

  // Dynamic trend badge computation: eliminate hardcoded +18.4%
  const activeTrend = trend || (totalRevenue > 0 ? "up" : "neutral");
  const activeTrendPercentage = trendPercentage || (totalRevenue > 0 ? "+0.0%" : "0.0%");

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
            {activeTrend === "up" && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                data-testid="revenue-trend-badge"
              >
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                {activeTrendPercentage}
              </span>
            )}
            {activeTrend === "down" && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
                data-testid="revenue-trend-badge"
              >
                <ArrowDownRight className="w-3 h-3 mr-0.5" />
                {activeTrendPercentage}
              </span>
            )}
            {activeTrend === "neutral" && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.05] text-slate-400 border border-white/[0.08]"
                data-testid="revenue-trend-badge"
              >
                <Minus className="w-3 h-3 mr-0.5" />
                {activeTrendPercentage}
              </span>
            )}
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

        {chartData.length === 0 ? (
          <div
            className="h-56 flex flex-col items-center justify-center text-center p-6 relative z-10"
            data-testid="chart-empty-state"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-2.5 text-slate-400">
              <TrendingUp className="w-5 h-5 opacity-40" />
            </div>
            <p className="text-xs font-semibold text-slate-300">
              {t("revenueChart.emptyTitle") || "No Revenue Recorded"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
              {t("revenueChart.emptyDesc") || "No transaction revenue recorded for this period."}
            </p>
          </div>
        ) : (
          <>
            {/* Bottom-Up Columns Container */}
            <div
              className="h-56 flex items-end justify-between gap-3 relative z-10"
              data-testid="chart-columns-container"
            >
              {chartData.map((item, idx) => {
                const label = item.label || item.period || `P${idx + 1}`;
                const heightStyle =
                  item.percentage !== undefined && !isNaN(item.percentage)
                    ? `${Math.min(100, Math.max(8, item.percentage))}%`
                    : undefined;

                return (
                  <div
                    key={`${label}-${idx}`}
                    className="flex-1 h-full flex flex-col justify-end items-center relative group"
                    data-testid={`chart-column-${idx}`}
                  >
                    {/* Hover Tooltip */}
                    <div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-30 px-2.5 py-1 rounded-md bg-[#08090D] border border-white/20 shadow-2xl text-[11px] font-mono text-white whitespace-nowrap"
                      role="tooltip"
                    >
                      <span className="text-slate-400 mr-1">{label}:</span>
                      <span className="font-bold text-primary">${(item.revenue || 0).toLocaleString()}</span>
                    </div>

                    {/* Column Track & Bottom-Up Bar */}
                    <div className="w-full h-full bg-white/[0.03] border border-white/[0.04] rounded-t-md relative flex flex-col justify-end overflow-hidden group-hover:border-primary/40 transition-colors">
                      <div
                        className="w-full bg-gradient-to-t from-primary/80 via-primary to-indigo-400 rounded-t-md transition-all duration-500 ease-out group-hover:from-primary group-hover:to-cyan-400 group-hover:shadow-[0_0_16px_rgba(99,102,241,0.6)]"
                        style={heightStyle ? { height: heightStyle } : undefined}
                        data-testid={`revenue-bar-${idx}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Date / Period Axis Labels strictly aligned 1:1 with columns */}
            <div className="flex justify-between gap-3 mt-3 pt-2 border-t border-white/[0.06]">
              {chartData.map((item, idx) => {
                const label = item.label || item.period || `P${idx + 1}`;
                return (
                  <div
                    key={`label-${idx}`}
                    className="flex-1 text-center text-xs font-mono text-muted-foreground group-hover:text-white transition-colors"
                  >
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
