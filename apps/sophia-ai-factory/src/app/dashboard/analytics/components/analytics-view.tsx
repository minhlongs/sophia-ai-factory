"use client";

import React, { useMemo } from "react";
import { Campaign } from "@/types";
import { StatusDistributionChart, CompletionTimeChart, CampaignsByTypeChart } from "./charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, CheckCircle2, Clock } from "lucide-react";

interface AnalyticsViewProps {
  campaigns: Campaign[];
}

export function AnalyticsView({ campaigns }: AnalyticsViewProps) {
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-xs text-muted-foreground">Completed campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgTime}m</div>
            <p className="text-xs text-muted-foreground">Per completed campaign</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campaign Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart data={statusData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Performance (Duration)</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPerformanceData.length > 0 ? (
                <CompletionTimeChart data={recentPerformanceData} />
            ) : (
                <div className="h-[300px] w-full flex items-center justify-center text-gray-400 border-2 border-dashed rounded-lg">
                    No completed campaigns data
                </div>
            )}
          </CardContent>
        </Card>

        {typeData.length > 0 && (
             <Card>
             <CardHeader>
               <CardTitle className="text-lg">Template Usage</CardTitle>
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
