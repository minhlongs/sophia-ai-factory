'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import type { UsageMetrics, RevenueMetrics, LicenseMetrics } from '@/lib/analytics/types';
import { RaasGatewayClient, type RaasUsageMetrics, type BillingMetrics, type LicenseUtilization } from '@/lib/raas-gateway-client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

// RaaS Gateway client instance (singleton)
const raasClient = new RaasGatewayClient({
  baseURL: process.env.NEXT_PUBLIC_RAAS_GATEWAY_URL || 'https://raas.agencyos.network',
  apiKey: process.env.NEXT_PUBLIC_RAAS_API_KEY || '',
  timeout: 10000,
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch' }));
    throw new Error(error.error || 'Failed to fetch analytics data');
  }
  return res.json();
};

// RaaS Gateway fetcher
const raasFetcher = {
  usage: async (start: number, end: number) => {
    try {
      return await raasClient.getUsageMetrics(start, end);
    } catch (error) {
      logger.error('[RaaS] Failed to fetch usage metrics', toError(error));
      return null;
    }
  },
  billing: async (period: string) => {
    try {
      return await raasClient.getBillingMetrics(period);
    } catch (error) {
      logger.error('[RaaS] Failed to fetch billing metrics', toError(error));
      return null;
    }
  },
  licenses: async () => {
    try {
      return await raasClient.getLicenseUtilization();
    } catch (error) {
      logger.error('[RaaS] Failed to fetch license utilization', toError(error));
      return null;
    }
  },
};

interface UseRaasAnalyticsOptions {
  start?: number;
  end?: number;
  autoRefresh?: boolean;
  isEnabled?: boolean;
}

/**
 * Hook for fetching RaaS Gateway analytics data
 */
export function useRaasAnalytics(options: UseRaasAnalyticsOptions = {}) {
  const { start, end, autoRefresh = false, isEnabled = true } = options;

  // Fetch metrics with caching
  const { data, error, isLoading, mutate } = useSWR<RaasUsageMetrics | null>(
    isEnabled ? `raas-metrics-${start}-${end}` : null,
    async () => raasFetcher.usage(start!, end!),
    {
      dedupingInterval: 30000, // 30s cache
      revalidateOnFocus: autoRefresh,
      keepPreviousData: true,
    }
  );

  return { data, loading: isLoading, error, mutate };
}

/**
 * Hook for fetching RaaS Gateway billing data
 */
export function useRaasBillingAnalytics(options: {
  period?: string;
  isEnabled?: boolean;
} = {}) {
  const { period = 'last_30_days', isEnabled = true } = options;

  const { data, error, isLoading, mutate } = useSWR<BillingMetrics | null>(
    isEnabled ? `raas-billing-${period}` : null,
    async () => raasFetcher.billing(period),
    {
      dedupingInterval: 300000, // 5 minutes cache
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  return { data, loading: isLoading, error, mutate };
}

/**
 * Hook for fetching RaaS Gateway license utilization
 */
export function useRaasLicenseAnalytics(options: { isEnabled?: boolean } = {}) {
  const { isEnabled = true } = options;

  const { data, error, isLoading, mutate } = useSWR<LicenseUtilization[] | null>(
    isEnabled ? 'raas-licenses' : null,
    async () => raasFetcher.licenses(),
    {
      dedupingInterval: 300000, // 5 minutes cache
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  return { data, loading: isLoading, error, mutate };
}

interface UseUsageAnalyticsOptions {
  licenseNonce?: string | null;
  start?: number;
  end?: number;
  granularity?: 'hour' | 'day';
  service?: string;
  isEnabled?: boolean;
}

/**
 * Hook for fetching usage analytics data (merged Supabase + RaaS)
 */
export function useUsageAnalytics(options: UseUsageAnalyticsOptions = {}) {
  const {
    licenseNonce,
    start,
    end,
    granularity = 'hour',
    service,
    isEnabled = true,
  } = options;

  // Build query params
  const params = new URLSearchParams();
  if (licenseNonce) params.set('license_nonce', licenseNonce);
  if (start) params.set('start', start.toString());
  if (end) params.set('end', end.toString());
  if (granularity) params.set('granularity', granularity);
  if (service) params.set('service', service);

  const url = `/api/analytics/usage?${params.toString()}`;

  const { data: supabaseData, error: supabaseError, isLoading: supabaseLoading, mutate: supabaseMutate } = useSWR<UsageMetrics>(
    isEnabled ? url : null,
    fetcher,
    {
      dedupingInterval: 60000, // 1 minute
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  // Add RaaS Gateway data
  const { data: raasData, error: raasError, loading: raasLoading, mutate: raasMutate } = useRaasAnalytics({
    start,
    end,
    isEnabled,
  });

  // Merge data sources
  const mergedData = useMemo(() => {
    if (!supabaseData) return null;
    if (!raasData) return supabaseData;

    return {
      ...supabaseData,
      summary: {
        ...supabaseData.summary,
        // Add RaaS-specific fields
        activeLicenses: raasData.activeLicenses,
      },
      timeSeries: supabaseData.timeSeries, // Prefer Supabase for detailed history
      serviceBreakdown: supabaseData.serviceBreakdown,
      quotaTrend: raasData.quotaConsumption,
    };
  }, [supabaseData, raasData]);

  return {
    data: mergedData,
    loading: supabaseLoading || raasLoading,
    error: supabaseError || raasError,
    mutate: () => { supabaseMutate(); raasMutate(); },
  };
}

interface UseRevenueAnalyticsOptions {
  period?: 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days';
  tier?: string;
  isEnabled?: boolean;
}

/**
 * Hook for fetching revenue analytics data (merged Supabase + RaaS)
 */
export function useRevenueAnalytics(options: UseRevenueAnalyticsOptions = {}) {
  const {
    period = 'current_month',
    tier,
    isEnabled = true,
  } = options;

  const params = new URLSearchParams();
  params.set('period', period);
  if (tier) params.set('tier', tier);

  const url = `/api/analytics/revenue?${params.toString()}`;

  const { data: supabaseData, error: supabaseError, isLoading: supabaseLoading, mutate: supabaseMutate } = useSWR<RevenueMetrics>(
    isEnabled ? url : null,
    fetcher,
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  // Add RaaS Gateway billing data
  const { data: raasData, error: raasError, loading: raasLoading, mutate: raasMutate } = useRaasBillingAnalytics({
    period,
    isEnabled,
  });

  // Merge data sources
  const mergedData = useMemo(() => {
    if (!supabaseData) return null;
    if (!raasData) return supabaseData;

    return {
      ...supabaseData,
      totalRevenue: raasData.totalRevenue || supabaseData.totalRevenue,
      recurringRevenue: raasData.recurringRevenue || supabaseData.recurringRevenue,
      oneTimeRevenue: raasData.oneTimeRevenue || supabaseData.oneTimeRevenue,
      byTier: raasData.byTier.length > 0 ? raasData.byTier : supabaseData.byTier,
      trend: raasData.trend.length > 0 ? raasData.trend : supabaseData.trend,
    };
  }, [supabaseData, raasData]);

  return {
    data: mergedData,
    loading: supabaseLoading || raasLoading,
    error: supabaseError || raasError,
    mutate: () => { supabaseMutate(); raasMutate(); },
  };
}

interface UseLicenseAnalyticsOptions {
  status?: 'active' | 'expired' | 'revoked' | 'all';
  tier?: string;
  isEnabled?: boolean;
}

/**
 * Hook for fetching license analytics data (merged Supabase + RaaS)
 */
export function useLicenseAnalytics(options: UseLicenseAnalyticsOptions = {}) {
  const {
    status = 'active',
    tier,
    isEnabled = true,
  } = options;

  const params = new URLSearchParams();
  params.set('status', status);
  if (tier) params.set('tier', tier);

  const url = `/api/analytics/licenses?${params.toString()}`;

  const { data: supabaseData, error: supabaseError, isLoading: supabaseLoading, mutate: supabaseMutate } = useSWR<LicenseMetrics>(
    isEnabled ? url : null,
    fetcher,
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  // Add RaaS Gateway license utilization
  const { data: raasData, error: raasError, loading: raasLoading, mutate: raasMutate } = useRaasLicenseAnalytics({
    isEnabled,
  });

  // Merge data sources
  const mergedData = useMemo(() => {
    if (!supabaseData) return null;
    if (!raasData) return supabaseData;

    return {
      ...supabaseData,
      utilization: raasData.length > 0 ? raasData : supabaseData.utilization,
    };
  }, [supabaseData, raasData]);

  return {
    data: mergedData,
    loading: supabaseLoading || raasLoading,
    error: supabaseError || raasError,
    mutate: () => { supabaseMutate(); raasMutate(); },
  };
}

/**
 * Combined hook for fetching all analytics data
 */
export function useAllAnalytics(options: {
  licenseNonce?: string | null;
  period?: string;
  status?: string;
  isEnabled?: boolean;
} = {}) {
  const { licenseNonce, isEnabled = true } = options;

  const usage = useUsageAnalytics({ licenseNonce, isEnabled });
  const revenue = useRevenueAnalytics({ isEnabled });
  const licenses = useLicenseAnalytics({ isEnabled });

  return {
    usage,
    revenue,
    licenses,
    loading: usage.loading || revenue.loading || licenses.loading,
    error: usage.error || revenue.error || licenses.error,
  };
}
