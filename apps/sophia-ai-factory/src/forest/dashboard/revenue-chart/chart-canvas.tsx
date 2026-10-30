"use client";

/**
 * Revenue Chart Bars & Empty State Canvas
 *
 * Layer: forest/dashboard/revenue-chart
 */

import React from "react";
import { TrendingUp } from "lucide-react";
import type { RevenueDataPoint } from "../types";

export interface ChartCanvasProps {
  chartData: RevenueDataPoint[];
  /**
   * True when the server could not report figures at all. Distinct from an
   * empty array, which is a verified-empty period.
   */
  unavailable?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
  unavailableTitle?: string;
  unavailableDesc?: string;
}

export function ChartCanvas({
  chartData,
  unavailable = false,
  emptyTitle = "No Revenue Recorded",
  emptyDesc = "No transaction revenue recorded for this period.",
  unavailableTitle = "Revenue unavailable",
  unavailableDesc = "We could not load your revenue figures. Please reload the page or check your connection.",
}: ChartCanvasProps) {
  return (
    <div className="relative pt-6">
      {/* Subtle Horizontal Reference Grid Lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40 dark:opacity-20">
        <div className="border-b border-border dark:border-white/20 w-full" />
        <div className="border-b border-border dark:border-white/20 w-full" />
        <div className="border-b border-border dark:border-white/20 w-full" />
        <div className="border-b border-border dark:border-white/20 w-full" />
      </div>

      {chartData.length === 0 ? (
        <div
          className="h-56 flex flex-col items-center justify-center text-center p-6 relative z-10"
          data-testid={unavailable ? "chart-unavailable-state" : "chart-empty-state"}
          data-status={unavailable ? "error" : "verified_empty"}
        >
          <div className="w-10 h-10 rounded-xl bg-muted dark:bg-white/[0.04] border border-border dark:border-white/[0.08] flex items-center justify-center mb-2.5 text-muted-foreground dark:text-slate-400">
            <TrendingUp className="w-5 h-5 opacity-40" />
          </div>
          <p className="text-xs font-semibold text-foreground dark:text-slate-300">
            {unavailable ? unavailableTitle : emptyTitle}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
            {unavailable ? unavailableDesc : emptyDesc}
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
                  <div className="w-full h-full bg-white/[0.03] border border-border/60 dark:border-white/[0.04] rounded-t-md relative flex flex-col justify-end overflow-hidden group-hover:border-primary/40 transition-colors">
                    <div
                      className="w-full bg-gradient-to-t from-primary/80 via-primary to-indigo-400 rounded-t-md transition-all duration-500 ease-out group-hover:from-primary group-hover:to-amber-400"
                      style={heightStyle ? { height: heightStyle } : undefined}
                      data-testid={`revenue-bar-${idx}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Date / Period Axis Labels strictly aligned 1:1 with columns */}
          <div className="flex justify-between gap-3 mt-3 pt-2 border-t border-border dark:border-white/[0.06]">
            {chartData.map((item, idx) => {
              const label = item.label || item.period || `P${idx + 1}`;
              return (
                <div
                  key={`label-${idx}`}
                  className="flex-1 text-center text-xs font-mono text-muted-foreground group-hover:text-foreground dark:group-hover:text-white transition-colors"
                >
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
