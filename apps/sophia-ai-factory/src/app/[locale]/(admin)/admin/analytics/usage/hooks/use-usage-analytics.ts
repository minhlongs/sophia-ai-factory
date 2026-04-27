'use client';

import { useState, useEffect, useCallback } from 'react';
import type { UsageMetrics, LicenseMetrics, AnalyticsGranularity } from '@/lib/analytics/types';
import { logger } from '@/lib/utils/logger-utility';

export interface UseUsageAnalyticsResult {
  granularity: AnalyticsGranularity;
  setGranularity: (value: AnalyticsGranularity) => void;
  isLoading: boolean;
  error: string | null;
  usageMetrics: UsageMetrics | null;
  licenseMetrics: LicenseMetrics | null;
  refresh: () => void;
}

export function useUsageAnalytics(): UseUsageAnalyticsResult {
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('hour');
  const [isLoading, setIsLoading] = useState(false);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [licenseMetrics, setLicenseMetrics] = useState<LicenseMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const start = granularity === 'hour'
      ? now - (24 * 3600)
      : now - (7 * 86400);
    return { start, end: now };
  }, [granularity]);

  const fetchUsageMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange();
      const params = new URLSearchParams({
        start: start.toString(),
        end: end.toString(),
        granularity,
      });

      const response = await fetch(`/api/analytics/usage?${params}`);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to fetch usage metrics');
      }

      const data: UsageMetrics = await response.json();
      setUsageMetrics(data);
      logger.debug('[Usage Analytics] Fetched usage metrics', {
        totalRequests: data.summary.totalRequests,
        totalCredits: data.summary.totalCredits,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      logger.error('[Usage Analytics] Failed to fetch usage metrics', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [granularity, getDateRange]);

  const fetchLicenseMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics/licenses?status=all');

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to fetch license metrics');
      }

      const data: LicenseMetrics = await response.json();
      setLicenseMetrics(data);
      logger.debug('[Usage Analytics] Fetched license metrics', {
        total: data.total,
        utilizationCount: data.utilization.length,
      });
    } catch (err) {
      logger.error('[Usage Analytics] Failed to fetch license metrics', err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  useEffect(() => {
    fetchUsageMetrics();
    fetchLicenseMetrics();
  }, [fetchUsageMetrics, fetchLicenseMetrics]);

  const refresh = useCallback(() => {
    fetchUsageMetrics();
    fetchLicenseMetrics();
  }, [fetchUsageMetrics, fetchLicenseMetrics]);

  return {
    granularity,
    setGranularity,
    isLoading,
    error,
    usageMetrics,
    licenseMetrics,
    refresh,
  };
}
