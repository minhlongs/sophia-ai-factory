"use client";

import React from "react";
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
import { OutcomeMetricCard } from "./outcome-metric-card";
import { OutcomesRecentTable } from "./outcomes-recent-table";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeSeriesPoint {
  date: string;
  views: number;
  revenue: number;
  ctr: number;
  engagement: number;
}

interface TopSop {
  name: string;
  revenue: number;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

function buildTimeSeriesData(): TimeSeriesPoint[] {
  const now = new Date();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views: Math.floor(800 + Math.random() * 1200),
      revenue: Math.floor(120 + Math.random() * 380),
      ctr: parseFloat((2.5 + Math.random() * 4.5).toFixed(2)),
      engagement: Math.floor(40 + Math.random() * 60),
    };
  });
}

const TIME_SERIES: TimeSeriesPoint[] = buildTimeSeriesData();

const TOP_SOPS: TopSop[] = [
  { name: "Lead Nurture", revenue: 4820 },
  { name: "Email Outreach", revenue: 3910 },
  { name: "Social Proof", revenue: 3280 },
  { name: "Upsell Flow", revenue: 2640 },
  { name: "Onboarding", revenue: 1990 },
];

const RECENT_OUTCOMES = [
  { id: "1", sop: "Lead Nurture", metric: "Views", value: 2340, date: "2026-05-21" },
  { id: "2", sop: "Email Outreach", metric: "CTR", value: 6.8, date: "2026-05-21" },
  { id: "3", sop: "Social Proof", metric: "Revenue", value: 980, date: "2026-05-20" },
  { id: "4", sop: "Upsell Flow", metric: "Engagement", value: 74, date: "2026-05-20" },
  { id: "5", sop: "Onboarding", metric: "Views", value: 1820, date: "2026-05-19" },
  { id: "6", sop: "Lead Nurture", metric: "Revenue", value: 1240, date: "2026-05-19" },
];

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

export function OutcomesDashboardClient({ userId: _userId, tier: _tier }: OutcomesDashboardClientProps) {
  const avgViews = Math.round(TIME_SERIES.reduce((s, p) => s + p.views, 0) / TIME_SERIES.length);
  const totalRevenue = TOP_SOPS.reduce((s, p) => s + p.revenue, 0);
  const avgCtr = (TIME_SERIES.reduce((s, p) => s + p.ctr, 0) / TIME_SERIES.length).toFixed(2);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OutcomeMetricCard title="Total Executions" value="1,247" change={12.4} icon={<TrendingUp className="h-5 w-5" />} />
        <OutcomeMetricCard title="Avg Views" value={avgViews.toLocaleString()} change={8.7} icon={<Eye className="h-5 w-5" />} />
        <OutcomeMetricCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} change={21.3} icon={<DollarSign className="h-5 w-5" />} />
        <OutcomeMetricCard title="Avg CTR" value={`${avgCtr}%`} change={-2.1} icon={<MousePointerClick className="h-5 w-5" />} />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-300">Outcome Metrics — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={TIME_SERIES} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(_, i) => i % 5 === 0 ? TIME_SERIES[i]?.date ?? "" : ""} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="views" stroke="var(--chart-1, #00f0ff)" strokeWidth={2} dot={false} name="Views" />
                  <Line type="monotone" dataKey="engagement" stroke="var(--chart-2, #818cf8)" strokeWidth={2} dot={false} name="Engagement" />
                  <Line type="monotone" dataKey="revenue" stroke="var(--chart-3, #34d399)" strokeWidth={2} dot={false} name="Revenue ($)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-300">Top 5 SOPs by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TOP_SOPS} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
      </div>

      <OutcomesRecentTable rows={RECENT_OUTCOMES} />
    </div>
  );
}
