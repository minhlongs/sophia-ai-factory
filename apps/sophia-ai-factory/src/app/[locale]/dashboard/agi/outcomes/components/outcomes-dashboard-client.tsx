"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Eye, MousePointerClick, DollarSign, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/seed/components/ui/card";
import { Skeleton } from "@/seed/components/ui/skeleton";
import { OutcomeMetricCard } from "./outcome-metric-card";
import { OutcomesRecentTable } from "./outcomes-recent-table";
import type { OutcomeMetric, CreatorSopOutcome } from "@/seed/types/outcome";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopSop {
  name: string;
  revenue: number;
}

interface RecentRow {
  id: string;
  sop: string;
  metric: string;
  value: number;
  date: string;
}

interface ApiResponse {
  recentOutcomes?: OutcomeMetric[];
  topSops?: Array<{ sopId: string; totalRevenue: number }>;
  sopSummaries?: CreatorSopOutcome[];
}

const revenueFormatter = (value: string | number | readonly (string | number)[] | undefined) =>
  `$${Number(Array.isArray(value) ? value[0] : value ?? 0).toLocaleString()}`;

const TOOLTIP_STYLE = {
  contentStyle: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#e2e8f0" },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface OutcomesDashboardClientProps {
  userId: string;
  tier: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

function formatMetricType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function OutcomesDashboardClient({ userId: _userId, tier: _tier }: OutcomesDashboardClientProps) {
  const [mounted, setMounted] = useState(false);
  const [recentOutcomes, setRecentOutcomes] = useState<OutcomeMetric[]>([]);
  const [topSopsData, setTopSopsData] = useState<TopSop[]>([]);
  const [sopSummaries, setSopSummaries] = useState<CreatorSopOutcome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch('/api/v1/agi/outcomes')
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        setRecentOutcomes(data.recentOutcomes ?? []);
        setTopSopsData(
          (data.topSops ?? []).map((s) => ({ name: s.sopId, revenue: s.totalRevenue }))
        );
        setSopSummaries(data.sopSummaries ?? []);
      })
      .catch(() => { /* keep empty */ })
      .finally(() => setLoading(false));
  }, []);

  const totalExecutions = useMemo(
    () => sopSummaries.reduce((sum, s) => sum + s.executionCount, 0),
    [sopSummaries]
  );
  const totalRevenue = useMemo(
    () => topSopsData.reduce((s, p) => s + p.revenue, 0),
    [topSopsData]
  );
  const avgViews = useMemo(() => {
    const viewMetrics = recentOutcomes.filter((o) => o.metricType === 'video_views');
    return viewMetrics.length > 0
      ? Math.round(viewMetrics.reduce((s, o) => s + o.metricValue, 0) / viewMetrics.length)
      : 0;
  }, [recentOutcomes]);
  const avgCtr = useMemo(() => {
    const ctrMetrics = recentOutcomes.filter((o) => o.metricType === 'click_through_rate');
    return ctrMetrics.length > 0
      ? (ctrMetrics.reduce((s, o) => s + o.metricValue, 0) / ctrMetrics.length).toFixed(2)
      : '0';
  }, [recentOutcomes]);

  const recentRows: RecentRow[] = useMemo(
    () =>
      recentOutcomes.slice(0, 10).map((o) => ({
        id: o.id,
        sop: o.sopId,
        metric: formatMetricType(o.metricType),
        value: o.metricValue,
        date: new Date(o.recordedAt * 1000).toISOString().slice(0, 10),
      })),
    [recentOutcomes]
  );

  if (!mounted || loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-[380px] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (recentOutcomes.length === 0 && topSopsData.length === 0) {
    return (
      <Card className="border border-slate-800 bg-slate-900/60">
        <CardContent className="p-12 text-center">
          <TrendingUp className="mx-auto mb-4 text-muted-foreground" size={48} />
          <h3 className="text-lg font-medium mb-2">No Outcome Data Yet</h3>
          <p className="text-sm text-muted-foreground">
            Outcome metrics will appear here once SOP executions generate results.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OutcomeMetricCard title="Total Executions" value={totalExecutions.toLocaleString()} icon={<TrendingUp className="h-5 w-5" />} />
        <OutcomeMetricCard title="Avg Views" value={avgViews.toLocaleString()} icon={<Eye className="h-5 w-5" />} />
        <OutcomeMetricCard title="Total Revenue" value={`$${(totalRevenue / 100).toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
        <OutcomeMetricCard title="Avg CTR" value={`${avgCtr}%`} icon={<MousePointerClick className="h-5 w-5" />} />
      </div>

      {/* Top SOPs bar chart */}
      {topSopsData.length > 0 && (
        <Card className="border border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-300">Top SOPs by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSopsData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={revenueFormatter} />
                  <Bar dataKey="revenue" fill="var(--chart-1, #00f0ff)" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <OutcomesRecentTable rows={recentRows} />
    </div>
  );
}
