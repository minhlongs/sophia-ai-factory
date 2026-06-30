"use client";

import React from "react";
import { Campaign, Tier } from "@/seed/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/seed/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/seed/components/ui/tabs";
import { BarChart3, Lock, Loader2, BarChart as BarChartIcon } from "lucide-react";
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useAnalyticsData } from "../hooks/use-analytics-data";
import { UsageAnalyticsView } from "./usage-analytics-view";
import { AnalyticsRecentCampaigns } from "@/forest/dashboard/campaign/analytics-recent-campaigns";
import { AnalyticsStatsCards } from "@/forest/dashboard/campaign/analytics-stats-cards";
import { AnalyticsStatusChart } from "@/forest/dashboard/campaign/analytics-status-chart";
import { AnalyticsPerformanceChart } from "@/forest/dashboard/campaign/analytics-performance-chart";

// Lazy load chart components
const CampaignsByTypeChart = dynamic(
  () => import('./charts').then(mod => mod.CampaignsByTypeChart),
  { loading: () => <div className="h-[300px] w-full flex items-center justify-center"><Loader2 className="h-8 w-8 motion-safe:animate-spin text-muted-foreground" /></div>, ssr: false }
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

  const completedCount = campaigns.filter(c => c.status === 'completed').length;
  const failedCount = campaigns.filter(c => c.status === 'failed').length;
  const avgCompletionTimeMinutes = parseFloat(stats.avgTime);
  const successRate = parseFloat(stats.successRate);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/10 border border-border/50 p-1 rounded-xl">
          <TabsTrigger value="usage" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground transition-all duration-200">
            <BarChartIcon className="w-4 h-4" aria-hidden="true" />
            {t('usage_tab')}
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-muted data-[state=active]:text-foreground transition-all duration-200">
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            {t('campaigns_tab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="mt-6">
          <UsageAnalyticsView userTier={userTier} userId={userId} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <div className="space-y-6">
            {/* Stats Cards */}
            <AnalyticsStatsCards
              totalCampaigns={stats.total}
              successRate={successRate}
              avgCompletionTimeHours={avgCompletionTimeMinutes}
              completedCount={completedCount}
              failedCount={failedCount}
            />

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-muted/10 border-border/50 backdrop-blur-md transition-all duration-300 hover:hover:border-border">
                <CardHeader>
                  <CardTitle className="text-lg text-foreground">{t('status_distribution')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <AnalyticsStatusChart data={statusData} />
                </CardContent>
              </Card>

              <Card className="bg-muted/10 border-border/50 backdrop-blur-md transition-all duration-300 hover:hover:border-border">
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
                      <AnalyticsPerformanceChart data={recentPerformanceData} />
                  ) : (
                      <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
                          {t('no_completed_data')}
                      </div>
                  )}
                </CardContent>
              </Card>

              {isAdvanced && typeData.length > 0 && (
                  <Card className="bg-muted/10 border-border/50 backdrop-blur-md transition-all duration-300 hover:hover:border-border">
                  <CardHeader>
                    <CardTitle className="text-lg text-foreground">{t('template_usage')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CampaignsByTypeChart data={typeData} />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Recent Campaigns Table */}
            <AnalyticsRecentCampaigns
              campaigns={campaigns.map((c) => ({
                id: c.id,
                name: c.title,
                status: c.status,
                platform: '',
                createdAt: c.created_at,
                completedAt:
                  c.status === 'completed' ? c.updated_at : null,
              }))}
              maxRows={10}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
