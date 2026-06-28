import { useMemo } from "react";
import { Campaign } from "@/seed/types";

export function useAnalyticsData(campaigns: Campaign[]) {
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
      .filter((t) => t > 0);

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

  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    let hasData = false;
    campaigns.forEach((c) => {
      if (c.template_id) {
        counts[c.template_id] = (counts[c.template_id] || 0) + 1;
        hasData = true;
      }
    });

    if (!hasData) return [];

    return Object.entries(counts).map(([name, value]) => ({
      name: `Template ${name.substring(0, 8)}`,
      value,
    }));
  }, [campaigns]);

  return { stats, statusData, recentPerformanceData, typeData };
}
