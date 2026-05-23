'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { JobStatus } from '@/tree/clients/muapi-media-client';

interface ImageStatusResponse {
  id: string;
  status: JobStatus;
  resultUrl: string | null;
  thumbnailUrl: string | null;
}

interface UseImageGenerationState {
  status: JobStatus | 'idle';
  resultUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  isPolling: boolean;
}

const POLL_INTERVAL_MS = 3_000;
const TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

export function useImageGeneration(jobId: string | null): UseImageGenerationState {
  const [state, setState] = useState<UseImageGenerationState>({
    status: 'idle',
    resultUrl: null,
    thumbnailUrl: null,
    error: null,
    isPolling: false,
  });

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, isPolling: false }));
  }, []);

  const pollOnce = useCallback(async (id: string) => {
    // Timeout guard
    if (startTimeRef.current && Date.now() - startTimeRef.current > TIMEOUT_MS) {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        error: 'Generation timed out after 5 minutes',
        isPolling: false,
      }));
      stopPolling();
      return;
    }

    try {
      const res = await fetch(`/api/v1/creative-studio/images/${id}/status`);
      if (!res.ok) {
        // Non-fatal network hiccup — keep polling
        if (res.status >= 500) {
          scheduleNext(id);
          return;
        }
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: `Status check failed: ${res.status}`,
          isPolling: false,
        }));
        return;
      }

      const data = (await res.json()) as ImageStatusResponse;

      setState((prev) => ({
        ...prev,
        status: data.status,
        resultUrl: data.resultUrl,
        thumbnailUrl: data.thumbnailUrl,
        error: null,
      }));

      if (data.status === 'completed' || data.status === 'failed') {
        stopPolling();
        return;
      }

      scheduleNext(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      // Keep polling on transient errors unless timed out
      if (startTimeRef.current && Date.now() - startTimeRef.current > TIMEOUT_MS) {
        setState((prev) => ({
          ...prev,
          status: 'failed',
          error: message,
          isPolling: false,
        }));
      } else {
        scheduleNext(id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPolling]);

  function scheduleNext(id: string) {
    timerRef.current = setTimeout(() => {
      if (activeJobIdRef.current === id) {
        pollOnce(id);
      }
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    if (!jobId) {
      stopPolling();
      setState({
        status: 'idle',
        resultUrl: null,
        thumbnailUrl: null,
        error: null,
        isPolling: false,
      });
      return;
    }

    // New job — reset and start polling
    activeJobIdRef.current = jobId;
    startTimeRef.current = Date.now();
    setState({
      status: 'pending',
      resultUrl: null,
      thumbnailUrl: null,
      error: null,
      isPolling: true,
    });

    pollOnce(jobId);

    return () => {
      activeJobIdRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [jobId, pollOnce, stopPolling]);

  return state;
}
