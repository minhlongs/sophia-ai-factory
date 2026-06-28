import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/land/query-client';
import type { RaasUsageMetrics } from '@/forest/raas-gateway-client';

interface LocalUsageMetricsResponse {
  summary?: {
    totalRequests?: number;
    totalCredits?: number;
  };
  timeSeries?: Array<{
    timestamp: number;
    credits: number;
  }>;
}

export interface UsageMetricsOptions {
  start: number;
  end: number;
  granularity?: 'hour' | 'day';
  service?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching usage metrics from RaaS Gateway
 * Returns { data, isLoading, error, refetch, isFetching }
 */
export function useUsageMetrics(options: UsageMetricsOptions) {
  const { start, end, granularity = 'hour', service, enabled = true } = options;

  return useQuery<RaasUsageMetrics | null, Error>({
    queryKey: queryKeys.usage.list({ start, end, granularity, service }),
    queryFn: async () => {
      const params = new URLSearchParams({
        start: String(start),
        end: String(end),
        granularity,
      });

      if (service) params.set('service', service);

      const response = await fetch(`/api/analytics/usage?${params.toString()}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json() as LocalUsageMetricsResponse;
      const quotaConsumption = (data.timeSeries ?? []).map((point) => ({
        timestamp: point.timestamp,
        used: point.credits,
        limit: 0,
        percentage: 0,
      }));

      return {
        apiCallVolume: data.summary?.totalRequests ?? 0,
        activeLicenses: 0,
        costPerTenant: {},
        quotaConsumption,
        timestamp: Date.now(),
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled,
    retry: 0,
  });
}
