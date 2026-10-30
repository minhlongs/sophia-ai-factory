"use client";

/**
 * Revenue Chart Header & Trend Badge
 *
 * Layer: forest/dashboard/revenue-chart
 */

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/seed/utils/cn";
import type { ChartPeriod } from "../types";

export interface RevenueChartHeaderProps {
  title: string;
  subtitle: string;
  /**
   * `undefined` means the server did not report a total, which must not be
   * rendered as the number zero.
   */
  totalRevenue?: number;
  activeTrend: "up" | "down" | "neutral";
  activeTrendPercentage?: string;
  activePeriod: ChartPeriod;
  periodOptions: Array<{ key: ChartPeriod; label: string }>;
  onPeriodChange: (period: ChartPeriod) => void;
}

export function RevenueChartHeader({
  title,
  subtitle,
  totalRevenue,
  activeTrend,
  activeTrendPercentage,
  activePeriod,
  periodOptions,
  onPeriodChange,
}: RevenueChartHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-base font-bold text-foreground dark:text-white tracking-tight">
            {title}
          </h4>
          {activeTrend === "up" && activeTrendPercentage && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              data-testid="revenue-trend-badge"
            >
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              {activeTrendPercentage}
            </span>
          )}
          {activeTrend === "down" && activeTrendPercentage && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              data-testid="revenue-trend-badge"
            >
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
              {activeTrendPercentage}
            </span>
          )}
          {activeTrend === "neutral" && activeTrendPercentage && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-muted dark:bg-white/[0.05] text-muted-foreground dark:text-slate-400 border border-border dark:border-white/[0.08]"
              data-testid="revenue-trend-badge"
            >
              <Minus className="w-3 h-3 mr-0.5" />
              {activeTrendPercentage}
            </span>
          )}
        </div>
        {/* No total when the server did not report one — "$0" would read as a
            real zero to a customer whose figure simply failed to load. */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {subtitle}
          {typeof totalRevenue === "number" && (
            <>
              {" • Total: "}
              <span className="text-foreground dark:text-white font-mono font-semibold">
                ${totalRevenue.toLocaleString()}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center bg-muted/60 dark:bg-white/[0.04] p-1 rounded-lg border border-border dark:border-white/[0.08] self-start sm:self-auto">
        {periodOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onPeriodChange(opt.key)}
            className={cn(
              "px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-all",
              activePeriod === opt.key
                ? "bg-primary text-white shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-background/60 dark:hover:bg-white/[0.04]"
            )}
            data-testid={`period-selector-${opt.key}`}
          >
            {opt.key.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
