import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { RaasGatewayClient, type LicenseUtilization } from '@/forest/raas-gateway-client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

// RaaS Gateway client instance (singleton)
const raasClient = new RaasGatewayClient({
  baseURL: process.env.NEXT_PUBLIC_RAAS_GATEWAY_URL || 'https://raas.agencyos.network',
  apiKey: process.env.NEXT_PUBLIC_RAAS_API_KEY || '',
  timeout: 10000,
});

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
      try {
        return await raasClient.getLicenseUtilization();
      } catch (error) {
        logger.error('[useLicenseMetrics] Failed to fetch license metrics', toError(error));
        return null;
      }
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled,
    retry: 2,
  });
}
