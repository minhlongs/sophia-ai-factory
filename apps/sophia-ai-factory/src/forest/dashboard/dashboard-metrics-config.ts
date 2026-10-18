"use client";

import {
  Megaphone,
  Play,
  Video,
  TrendingUp,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import type { DashboardMetric } from "@/forest/dashboard/types";

export interface MetricPillConfig {
  icon: LucideIcon;
  pillClass: string;
  defaultLabel: string;
}

export const METRIC_CONFIGS: Record<string, MetricPillConfig> = {
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

export function getMetricPillConfig(metricId: string): MetricPillConfig {
  return (
    METRIC_CONFIGS[metricId] || {
      icon: DollarSign,
      pillClass:
        "bg-muted dark:bg-white/[0.05] text-foreground dark:text-white border border-border dark:border-white/10",
      defaultLabel: metricId,
    }
  );
}

export const ZERO_METRICS: DashboardMetric[] = [
  { id: "total_campaigns", value: "0", change: "0%", trend: "neutral", icon: "Megaphone" },
  { id: "active_campaigns", value: "0", change: "0", trend: "neutral", icon: "Play" },
  { id: "videos_generated", value: "0", change: "0%", trend: "neutral", icon: "Video" },
  { id: "success_rate", value: "0.0%", change: "neutral", trend: "neutral", icon: "TrendingUp" },
];
