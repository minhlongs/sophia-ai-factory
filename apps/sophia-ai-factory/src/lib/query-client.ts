import { QueryClient, QueryClientConfig } from '@tanstack/react-query';

/**
 * Query client configuration for TanStack Query
 * Optimized for analytics dashboard with intelligent caching
 */
const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - data fresh for 30s
      gcTime: 5 * 60 * 1000, // 5 minutes - keep unused data in cache
      refetchOnWindowFocus: false,
      retry: 2,
      refetchOnReconnect: true,
    },
  },
};

/**
 * Create a new QueryClient instance
 * Call this in your QueryClientProvider
 */
export function createQueryClient() {
  return new QueryClient(queryClientConfig);
}

/**
 * Query key factory for consistent caching keys
 */
export const queryKeys = {
  // Usage metrics
  usage: {
    all: ['usage'] as const,
    list: (filters: { start: number; end: number; granularity?: string }) =>
      [...queryKeys.usage.all, 'list', filters] as const,
    detail: (nonce: string) => [...queryKeys.usage.all, 'detail', nonce] as const,
  },

  // License metrics
  license: {
    all: ['license'] as const,
    list: (filters?: { status?: string; tier?: string }) =>
      [...queryKeys.license.all, 'list', filters] as const,
    utilization: () => [...queryKeys.license.all, 'utilization'] as const,
  },

  // Revenue metrics
  revenue: {
    all: ['revenue'] as const,
    list: (filters: { period: string; tier?: string }) =>
      [...queryKeys.revenue.all, 'list', filters] as const,
  },

  // RaaS Gateway metrics
  raas: {
    usage: (start: number, end: number) => ['raas', 'usage', start, end] as const,
    billing: (period: string) => ['raas', 'billing', period] as const,
    licenses: () => ['raas', 'licenses'] as const,
  },
};
