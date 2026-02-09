"use client";

import React, { useMemo } from "react";
import { Campaign, Tier } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, CheckCircle2, Clock, Loader2, Lock } from "lucide-react";
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

// Lazy load chart components
const StatusDistributionChart = dynamic(
  () => import('./charts').then(mod => mod.StatusDistributionChart),
  { loading: () => <div className="h-[300px] w-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>, ssr: false }
);

const CompletionTimeChart = dynamic(
  () => import('./charts').then(mod => mod.CompletionTimeChart),
  { loading: () => <div className="h-[300px] w-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>, ssr: false }
);

const CampaignsByTypeChart = dynamic(
  () => import('./charts').then(mod => mod.CampaignsByTypeChart),
  { loading: () => <div className="h-[300px] w-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>, ssr: false }
);

interface AnalyticsViewProps {
  campaigns: Campaign[];
  userTier: Tier;
}

export function AnalyticsView({ campaigns, userTier }: AnalyticsViewProps) {
  const t = useTranslations('dashboard.analytics');
  const isAdvanced = userTier !== "BASIC";

  // Calculate stats
  const stats = useMemo(() => {
    const total = campaigns.length;
    const completed = campaigns.filter((c) => c.status === "completed");
    const successRate = total > 0 ? (completed.length / total) * 100 : 0;

    // Calculate average completion time for completed campaigns
    const completionTimes = completed
      .map((c) => {
        const start = new Date(c.created_at).getTime();
        const end = new Date(c.updated_at).getTime();
        // Return duration in minutes
        return (end - start) / (1000 * 60);
      })
      .filter((t) => t > 0); // Filter out zero or negative times just in case

    const avgTime =
      completionTimes.length > 0
        ? completionTimes.reduce((acc, curr) => acc + curr, 0) / completionTimes.length
        : 0;

    return {
      total,
      successRate: successRate.toFixed(1),
      avgTime: avgTime.toFixed(1),
    };
  }, [campaigns]);

  // Prepare chart data
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach((c) => {
      const status = c.status || "unknown";
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace("_", " ").toUpperCase(),
      value,
    }));
  }, [campaigns]);

  const recentPerformanceData = useMemo(() => {
    // Get last 5 completed campaigns for performance chart
    return campaigns
      .filter((c) => c.status === "completed")
      .slice(0, 5)
      .map((c) => {
        const start = new Date(c.created_at).getTime();
        const end = new Date(c.updated_at).getTime();
        const duration = (end - start) / (1000 * 60);
        return {
          name: c.title.substring(0, 15) + (c.title.length > 15 ? "..." : ""),
          duration: parseFloat(duration.toFixed(1)),
        };
      });
  }, [campaigns]);

  // Placeholder for Tier/Type data since we might not have it populated yet
  // We'll group by template_id if available, otherwise just mock it or hide it
  const typeData = useMemo(() => {
      const counts: Record<string, number> = {};
      let hasData = false;
      campaigns.forEach(c => {
          if (c.template_id) {
              counts[c.template_id] = (counts[c.template_id] || 0) + 1;
              hasData = true;
          }
      });

      if (!hasData) return [];

      return Object.entries(counts).map(([name, value]) => ({
          name: `Template ${name.substring(0, 8)}`, // truncate if UUID
          value
      }));
  }, [campaigns]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">{t('total_campaigns')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-xs text-muted-foreground">{t('all_time')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">{t('success_rate')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">{t('completed_campaigns')}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">{t('avg_completion_time')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.avgTime}m</div>
            <p className="text-xs text-muted-foreground">{t('per_completed')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">{t('status_distribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart data={statusData} />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">{t('recent_performance')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!isAdvanced ? (
                <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg gap-2">
                    <Lock className="h-6 w-6" />
                    <p className="text-sm font-medium">Advanced Analytics</p>
                    <p className="text-xs">Upgrade to Growth or higher to unlock detailed performance charts</p>
                </div>
            ) : recentPerformanceData.length > 0 ? (
                <CompletionTimeChart data={recentPerformanceData} />
            ) : (
                <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                    {t('no_completed_data')}
                </div>
            )}
          </CardContent>
        </Card>

        {isAdvanced && typeData.length > 0 && (
             <Card className="bg-card border-border">
             <CardHeader>
               <CardTitle className="text-lg text-foreground">{t('template_usage')}</CardTitle>
             </CardHeader>
             <CardContent>
               <CampaignsByTypeChart data={typeData} />
             </CardContent>
           </Card>
        )}
      </div>
    </div>
  );
}
