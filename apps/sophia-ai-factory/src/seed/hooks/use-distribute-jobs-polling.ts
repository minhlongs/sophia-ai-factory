/**
 * Client-side hook for polling distribute job status.
 * Adaptive interval: 4s for first 60s, then 10s.
 * Auto-stops when all jobs reach a terminal state (live | failed | paused).
 * Pauses when tab is hidden; resumes on visibility.
 *
 * @module seed/hooks/use-distribute-jobs-polling
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/seed/utils/logger-utility';

const FAST_INTERVAL_MS = 4_000;
const SLOW_INTERVAL_MS = 10_000;
const FAST_PHASE_MS = 60_000;
const TERMINAL_STATUSES = new Set(['live', 'failed', 'paused']);

export interface DistributeJob {
  id: string;
  channelId: string;
  provider: string;
  status: string;
  attempts: number;
  lastError: string | null;
  updatedAt: number | null;
}

export interface UseDistributeJobsPollingResult {
  jobs: DistributeJob[];
  isPolling: boolean;
  lastError: string | null;
  refresh: () => void;
}

function allTerminal(jobs: DistributeJob[]): boolean {
  return jobs.length > 0 && jobs.every((j) => TERMINAL_STATUSES.has(j.status));
}

export function useDistributeJobsPolling(videoId: string): UseDistributeJobsPollingResult {
  const [jobs, setJobs] = useState<DistributeJob[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Track when polling started to decide fast vs slow interval
  const startTimeRef = useRef<number>(0);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);

  const fetchJobs = useCallback(async (): Promise<DistributeJob[] | null> => {
    if (!videoId) return null;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/v1/distribute/jobs/${encodeURIComponent(videoId)}/status`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.text().catch((err) => {
          logger.warn('Failed to read distribute job status error body', {
            error: String(err),
            context: 'fetchJobs',
            videoId,
          });
          return '';
        });
        setLastError(`HTTP ${res.status}: ${body.slice(0, 100)}`);
        return null;
      }
      const data = (await res.json()) as { jobs: DistributeJob[] };
      setLastError(null);
      return data.jobs;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      setLastError(err instanceof Error ? err.message : 'Fetch error');
      return null;
    }
  }, [videoId]);

  const refresh = useCallback(async () => {
    const result = await fetchJobs();
    if (result !== null) setJobs(result);
  }, [fetchJobs]);

  useEffect(() => {
    if (!videoId) return;

    stoppedRef.current = false;
    startTimeRef.current = Date.now();
    setIsPolling(true);
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (stoppedRef.current) return;
      if (document.visibilityState === 'hidden') {
        schedule();
        return;
      }

      const result = await fetchJobs();
      if (stoppedRef.current) return;

      if (result !== null) {
        setJobs(result);
        if (allTerminal(result)) {
          stoppedRef.current = true;
          setIsPolling(false);
          return;
        }
      }

      schedule();
    };

    const schedule = () => {
      if (stoppedRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const delay = elapsed < FAST_PHASE_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
      timerId = setTimeout(tick, delay);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !stoppedRef.current) {
        // immediate poll on resume
        void tick();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    // Kick off immediately
    void tick();

    return () => {
      stoppedRef.current = true;
      if (timerId) clearTimeout(timerId);
      abortRef.current?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
      setIsPolling(false);
    };
  }, [videoId, fetchJobs]);

  return { jobs, isPolling, lastError, refresh };
}
