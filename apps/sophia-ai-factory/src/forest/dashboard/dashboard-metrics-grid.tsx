"use client";

/**
 * Obsidian Cyber-Glass KPI Metrics Grid
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * @module forest/dashboard/dashboard-metrics-grid
 */

import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import type { DashboardMetric } from "@/forest/dashboard/types";
import {
  getMetricPillConfig,
} from "./dashboard-metrics-config";

export {
  METRIC_CONFIGS,
  getMetricPillConfig,
  type MetricPillConfig,
} from "./dashboard-metrics-config";

export interface DashboardMetricsGridProps {
  /**
   * `undefined` means the numbers are unavailable, which is different from an
   * account that genuinely has none. See the status convention below.
   */
  metrics?: DashboardMetric[];
  className?: string;
}

export function DashboardMetricsGrid({ metrics, className }: DashboardMetricsGridProps) {
  let t: (key: string) => string;
  try {
    const hookT = useTranslations("stitch.dashboard");
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  // No data at all: say the numbers are unavailable instead of showing zero,
  // which a customer would read as "my account produced nothing".
  if (metrics === undefined) {
    return (
      <div
        className={cn(
          "mb-6 rounded-xl border border-border bg-muted/30 p-5",
          className
        )}
        data-testid="dashboard-metrics-unavailable"
        data-status="error"
      >
        <p className="text-sm text-muted-foreground">
          {t("metrics.unavailableHint")}
        </p>
      </div>
    );
  }

  // A verified empty account is its own state — it is not an error.
  if (metrics.length === 0) {
    return (
      <div
        className={cn(
          "mb-6 rounded-xl border border-border bg-muted/30 p-5",
          className
        )}
        data-testid="dashboard-metrics-empty"
        data-status="verified_empty"
      >
        <p className="text-sm text-muted-foreground">
          {t("metrics.emptyHint")}
        </p>
      </div>
    );
  }

  const items = metrics;
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6",
        className
      )}
      data-testid="dashboard-metrics-grid"
    >
      {items.map((metric) => {
        const config = getMetricPillConfig(metric.id);
        const IconComponent = config.icon;

        let label = config.defaultLabel;
        try {
          const translated = t(`metrics.${metric.id}`);
          if (translated && !translated.includes(`metrics.${metric.id}`)) {
            label = translated;
          }
        } catch {
          label = config.defaultLabel;
        }

        return (
          <div
            key={metric.id}
            className="bg-card dark:bg-[#11131F] backdrop-blur-xl border border-border dark:border-white/[0.08] hover:border-primary/40 rounded-xl p-5 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-0.5 group relative overflow-hidden"
            data-testid={`kpi-card-${metric.id}`}
          >
            {/* Top Row: Tinted Icon Pill + Trend Badge */}
            <div className="flex items-center justify-between mb-3">
              <div
                className={cn(
                  "p-2 rounded-xl transition-transform duration-300 group-hover:scale-105",
                  config.pillClass
                )}
                data-testid={`kpi-pill-${metric.id}`}
              >
                <IconComponent className="w-5 h-5" aria-hidden="true" />
              </div>

              {/* Trend Badge */}
              {metric.trend === "up" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                  {metric.change}
                </span>
              )}
              {metric.trend === "neutral" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-muted dark:bg-white/[0.05] text-muted-foreground dark:text-slate-400 border border-border dark:border-white/[0.08]">
                  <Minus className="w-3 h-3 mr-0.5" />
                  {metric.change}
                </span>
              )}
              {metric.trend === "down" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                  {metric.change}
                </span>
              )}
            </div>

            {/* Metric Label */}
            <p className="text-xs font-medium text-muted-foreground dark:text-slate-400 tracking-wide uppercase">
              {label}
            </p>

            {/* Metric Value */}
            <h3 className="text-2xl lg:text-3xl font-bold font-mono text-foreground dark:text-white tracking-tight mt-1 tabular-nums">
              {metric.value}
            </h3>
          </div>
        );
      })}
    </div>
  );
}
