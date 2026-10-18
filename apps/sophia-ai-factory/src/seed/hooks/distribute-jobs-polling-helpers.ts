/**
 * Types and fetch helpers for distribute jobs status polling.
 *
 * @module seed/hooks/distribute-jobs-polling-helpers
 */

import { logger } from '@/seed/utils/logger-utility';

export const FAST_INTERVAL_MS = 4_000;
export const SLOW_INTERVAL_MS = 10_000;
export const FAST_PHASE_MS = 60_000;
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

export function allTerminal(jobs: DistributeJob[]): boolean {
  return jobs.length > 0 && jobs.every((j) => TERMINAL_STATUSES.has(j.status));
}

export async function fetchDistributeJobsStatus(
  videoId: string,
  signal: AbortSignal,
  onError: (errText: string | null) => void,
): Promise<DistributeJob[] | null> {
  try {
    const res = await fetch(`/api/v1/distribute/jobs/${encodeURIComponent(videoId)}/status`, {
      signal,
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
      onError(`HTTP ${res.status}: ${body.slice(0, 100)}`);
      return null;
    }
    const data = (await res.json()) as { jobs: DistributeJob[] };
    onError(null);
    return data.jobs;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return null;
    onError(err instanceof Error ? err.message : 'Fetch error');
    return null;
  }
}
