'use client';

/**
 * Presentation Layer: Growth Telemetry Polling Hook
 * SWR-style polling hook with exponential backoff and jitter.
 * Layer: presentation/components/growth/hooks | Max LOC: < 200 | Zero :any
 * @module components/growth/hooks/use-growth-telemetry
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PredictiveRenderJob } from '@/seed/types/growth-triad-v14';

export interface UseGrowthTelemetryOptions {
  pollingIntervalMs?: number;
  maxBackoffMs?: number;
  enabled?: boolean;
}

export interface UseGrowthTelemetryReturn {
  jobs: PredictiveRenderJob[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  totalAllocatedMcu: number;
  totalHaltedJobs: number;
}

export function useGrowthTelemetry(
  fetcher: () => Promise<PredictiveRenderJob[]>,
  options: UseGrowthTelemetryOptions = {}
): UseGrowthTelemetryReturn {
  const {
    pollingIntervalMs = 15000,
    maxBackoffMs = 60000,
    enabled = true,
  } = options;

  const [jobs, setJobs] = useState<PredictiveRenderJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const backoffRef = useRef<number>(pollingIntervalMs);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const executeFetch = useCallback(async () => {
    try {
      const data = await fetcher();
      setJobs(data);
      setIsError(false);
      setError(null);
      // Reset backoff on success
      backoffRef.current = pollingIntervalMs;
    } catch (err) {
      setIsError(true);
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      // Exponential backoff with jitter
      const jitter = Math.random() * 1000;
      backoffRef.current = Math.min(maxBackoffMs, backoffRef.current * 1.5 + jitter);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, pollingIntervalMs, maxBackoffMs]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await executeFetch();
  }, [executeFetch]);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const scheduleNext = () => {
      timerRef.current = setTimeout(async () => {
        if (!mounted) return;
        await executeFetch();
        if (mounted) scheduleNext();
      }, backoffRef.current);
    };

    executeFetch().then(() => {
      if (mounted) scheduleNext();
    });

    return () => {
      mounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, executeFetch]);

  const totalAllocatedMcu = jobs.reduce((sum, j) => sum + j.allocatedMcu, 0);
  const totalHaltedJobs = jobs.filter((j) => j.status === 'HALTED_EARLY').length;

  return {
    jobs,
    isLoading,
    isError,
    error,
    refresh,
    totalAllocatedMcu,
    totalHaltedJobs,
  };
}
