'use client';

import useSWR from 'swr';
import type { UsageMetrics, RevenueMetrics, LicenseMetrics } from '@/lib/analytics/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to fetch' }));
    throw new Error(error.error || 'Failed to fetch analytics data');
  }
  return res.json();
};

interface UseUsageAnalyticsOptions {
  licenseNonce?: string | null;
  start?: number;
  end?: number;
  granularity?: 'hour' | 'day';
  service?: string;
  isEnabled?: boolean;
}

/**
 * Hook for fetching usage analytics data
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

  const { data, error, isLoading, mutate } = useSWR<UsageMetrics>(
    isEnabled ? url : null,
    fetcher,
    {
      dedupingInterval: 60000, // 1 minute
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  return {
    data,
    loading: isLoading,
    error,
    mutate,
  };
}

interface UseRevenueAnalyticsOptions {
  period?: 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days';
  tier?: string;
  isEnabled?: boolean;
}

/**
 * Hook for fetching revenue analytics data
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

  const { data, error, isLoading, mutate } = useSWR<RevenueMetrics>(
    isEnabled ? url : null,
    fetcher,
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  return {
    data,
    loading: isLoading,
    error,
    mutate,
  };
}

interface UseLicenseAnalyticsOptions {
  status?: 'active' | 'expired' | 'revoked' | 'all';
  tier?: string;
  isEnabled?: boolean;
}

/**
 * Hook for fetching license analytics data
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

  const { data, error, isLoading, mutate } = useSWR<LicenseMetrics>(
    isEnabled ? url : null,
    fetcher,
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  return {
    data,
    loading: isLoading,
    error,
    mutate,
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
