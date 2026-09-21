"use client";

/**
 * Obsidian Cyber-Glass KPI Metrics Grid
 * Layer: forest/dashboard (Infrastructure Orchestrators & UI; imports from @/seed)
 *
 * Implements:
 * 1. 4 Obsidian glass cards (#12141F / bg-card/85) with letterpress border glow
 * 2. 4 distinct tinted icon pills:
 *    - Total Campaigns: Electric Indigo
 *    - Active Jobs: Emerald
 *    - Videos Generated: Radiant Violet
 *    - Success Rate: Cyber Amber
 * 3. Trend badges with dynamic directional indicators
 * 4. High-contrast typography and tabular figures
 *
 * @module forest/dashboard/dashboard-metrics-grid
 */

import React from "react";
import {
  Megaphone,
  Play,
  Video,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import type { DashboardMetric } from "@/forest/dashboard/types";

export interface DashboardMetricsGridProps {
  metrics?: DashboardMetric[];
  className?: string;
}

interface MetricPillConfig {
  icon: LucideIcon;
  pillClass: string;
  defaultLabel: string;
}

const METRIC_CONFIGS: Record<string, MetricPillConfig> = {
  total_campaigns: {
    icon: Megaphone,
    pillClass:
      "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
    defaultLabel: "Total Campaigns",
  },
  active_campaigns: {
    icon: Play,
    pillClass:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    defaultLabel: "Active Jobs",
  },
  videos_generated: {
    icon: Video,
    pillClass:
      "bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-[0_0_12px_rgba(168,85,247,0.15)]",
    defaultLabel: "Videos Generated",
  },
  success_rate: {
    icon: TrendingUp,
    pillClass:
      "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    defaultLabel: "Success Rate",
  },
};

const DEFAULT_METRICS: DashboardMetric[] = [
  { id: "total_campaigns", value: "24", change: "+12%", trend: "up", icon: "Megaphone" },
  { id: "active_campaigns", value: "8", change: "+3", trend: "up", icon: "Play" },
  { id: "videos_generated", value: "142", change: "+28%", trend: "up", icon: "Video" },
  { id: "success_rate", value: "98.4%", change: "neutral", trend: "neutral", icon: "TrendingUp" },
];

export function DashboardMetricsGrid({ metrics = DEFAULT_METRICS, className }: DashboardMetricsGridProps) {
  let t: (key: string) => string;
  try {
    const hookT = useTranslations("stitch.dashboard");
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  const items = metrics.length > 0 ? metrics : DEFAULT_METRICS;

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6",
        className
      )}
      data-testid="dashboard-metrics-grid"
    >
      {items.map((metric) => {
        const config = METRIC_CONFIGS[metric.id] || {
          icon: DollarSign,
          pillClass: "bg-white/[0.05] text-white border border-white/10",
          defaultLabel: metric.id,
        };
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
            className="bg-[#12141F]/85 backdrop-blur-xl border border-white/[0.08] hover:border-primary/40 rounded-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] group relative overflow-hidden"
            data-testid={`kpi-card-${metric.id}`}
          >
            {/* Ambient Background Accent Glow */}
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors pointer-events-none" />

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
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                  {metric.change}
                </span>
              )}
              {metric.trend === "neutral" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.05] text-slate-400 border border-white/[0.08]">
                  <Minus className="w-3 h-3 mr-0.5" />
                  {metric.change}
                </span>
              )}
              {metric.trend === "down" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                  {metric.change}
                </span>
              )}
            </div>

            {/* Metric Label */}
            <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">
              {label}
            </p>

            {/* Metric Value */}
            <h3 className="text-2xl lg:text-3xl font-bold font-mono text-white tracking-tight mt-1">
              {metric.value}
            </h3>
          </div>
        );
      })}
    </div>
  );
}
