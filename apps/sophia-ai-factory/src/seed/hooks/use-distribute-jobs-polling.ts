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
import {
  FAST_INTERVAL_MS,
  SLOW_INTERVAL_MS,
  FAST_PHASE_MS,
  allTerminal,
  fetchDistributeJobsStatus,
  type DistributeJob,
  type UseDistributeJobsPollingResult,
} from './distribute-jobs-polling-helpers';

export type { DistributeJob, UseDistributeJobsPollingResult };

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
    return fetchDistributeJobsStatus(videoId, controller.signal, setLastError);
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
