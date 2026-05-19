import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import type { LicenseUtilization } from '@/forest/raas-gateway-client';

interface LocalLicenseMetricsResponse {
  utilization?: LicenseUtilization[];
}

export interface LicenseMetricsOptions {
  status?: 'active' | 'expired' | 'revoked' | 'all';
  tier?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching license metrics from RaaS Gateway
 * Returns { data, isLoading, error, refetch, isFetching }
 */
export function useLicenseMetrics(options: LicenseMetricsOptions = {}) {
  const { status = 'active', tier, enabled = true } = options;

  return useQuery<LicenseUtilization[] | null, Error>({
    queryKey: queryKeys.license.list({ status, tier }),
    queryFn: async () => {
      const params = new URLSearchParams({ status });
      if (tier) params.set('tier', tier);

      const response = await fetch(`/api/analytics/licenses?${params.toString()}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json() as LocalLicenseMetricsResponse;
      return data.utilization ?? [];
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled,
    retry: 0,
  });
}
