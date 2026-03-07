"use client";

import React from "react";
import { Campaign, Tier } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, CheckCircle2, Clock, Loader2, Lock, BarChart as BarChartIcon } from "lucide-react";
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useAnalyticsData } from "../hooks/use-analytics-data";
import { UsageAnalyticsView } from "./usage-analytics-view";

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
  userId: string;
}

export function AnalyticsView({ campaigns, userTier, userId }: AnalyticsViewProps) {
  const t = useTranslations('dashboard.analytics');
  const isAdvanced = userTier !== "BASIC";
  const { stats, statusData, recentPerformanceData, typeData } = useAnalyticsData(campaigns);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <BarChartIcon className="w-4 h-4" />
            {t('usage_tab')}
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('campaigns_tab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="mt-6">
          <UsageAnalyticsView userTier={userTier} userId={userId} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
