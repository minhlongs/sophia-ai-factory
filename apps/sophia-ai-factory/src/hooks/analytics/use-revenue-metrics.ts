import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { RaasGatewayClient, type BillingMetrics } from '@/lib/raas-gateway-client';
import { logger } from '@/lib/utils/logger-utility';

// RaaS Gateway client instance (singleton)
const raasClient = new RaasGatewayClient({
  baseURL: process.env.NEXT_PUBLIC_RAAS_GATEWAY_URL || 'https://raas.agencyos.network',
  apiKey: process.env.NEXT_PUBLIC_RAAS_API_KEY || '',
  timeout: 10000,
});

export interface RevenueMetricsOptions {
  period?: 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days';
  tier?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching revenue metrics from RaaS Gateway
 * Returns { data, isLoading, error, refetch, isFetching }
 */
export function useRevenueMetrics(options: RevenueMetricsOptions = {}) {
  const { period = 'current_month', tier, enabled = true } = options;

  return useQuery<BillingMetrics | null, Error>({
    queryKey: queryKeys.revenue.list({ period, tier }),
    queryFn: async () => {
      try {
        return await raasClient.getBillingMetrics(period);
      } catch (error) {
        logger.error('[useRevenueMetrics] Failed to fetch revenue metrics', error as Error);
        return null;
      }
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled,
    retry: 2,
  });
}
