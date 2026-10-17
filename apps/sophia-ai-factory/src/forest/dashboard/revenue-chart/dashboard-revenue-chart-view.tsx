"use client";

/**
 * Rebuilt Revenue & Performance Financial Chart Component
 * Layer: forest/dashboard/revenue-chart
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import type { ChartPeriod, RevenueDataPoint, RevenuePoint } from "../types";
import { RevenueChartHeader } from "./chart-header";
import { ChartCanvas } from "./chart-canvas";

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

  const chartData = data || (periodData ? periodData[activePeriod] : undefined) || [];
  const totalRevenue = chartData.reduce((acc, curr) => acc + (curr.revenue || 0), 0);

  const activeTrend = trend || (totalRevenue > 0 ? "up" : "neutral");
  const activeTrendPercentage = trendPercentage || (totalRevenue > 0 ? "+0.0%" : "0.0%");

  return (
    <div
      className={cn(
        "lg:col-span-2 bg-card dark:bg-[#11131F] backdrop-blur-xl border border-border dark:border-white/[0.08] hover:border-primary/30 transition-all duration-300 rounded-xl p-5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.35)] flex flex-col justify-between",
        className
      )}
      data-testid="revenue-chart-card"
    >
      <RevenueChartHeader
        title={t("revenueChart.title")}
        subtitle={t("revenueChart.subtitle")}
        totalRevenue={totalRevenue}
        activeTrend={activeTrend}
        activeTrendPercentage={activeTrendPercentage}
        activePeriod={activePeriod}
        periodOptions={periodOptions}
        onPeriodChange={handlePeriodChange}
      />
      <ChartCanvas
        chartData={chartData}
        emptyTitle={t("revenueChart.emptyTitle") || "No Revenue Recorded"}
        emptyDesc={t("revenueChart.emptyDesc") || "No transaction revenue recorded for this period."}
      />
    </div>
  );
}
