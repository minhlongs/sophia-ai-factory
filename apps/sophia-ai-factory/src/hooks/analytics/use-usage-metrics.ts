import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { RaasGatewayClient, type RaasUsageMetrics } from '@/lib/raas-gateway-client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

// RaaS Gateway client instance (singleton)
const raasClient = new RaasGatewayClient({
  baseURL: process.env.NEXT_PUBLIC_RAAS_GATEWAY_URL || 'https://raas.agencyos.network',
  apiKey: process.env.NEXT_PUBLIC_RAAS_API_KEY || '',
  timeout: 10000,
});

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
      try {
        return await raasClient.getUsageMetrics(start, end);
      } catch (error) {
        logger.error('[useUsageMetrics] Failed to fetch usage metrics', toError(error));
        return null;
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled,
    retry: 2,
  });
}
