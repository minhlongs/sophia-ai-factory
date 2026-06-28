/**
 * Unit tests: useDistributeJobsPolling hook
 *
 * Covers:
 * 1. polls every 4s for first 60s (fast phase)
 * 2. backs off to 10s after 60s elapsed (slow phase)
 * 3. stops polling when all jobs are terminal
 * 4. cleanup on unmount — no further fetches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDistributeJobsPolling } from '../use-distribute-jobs-polling';

const VIDEO_ID = '00000000-0000-0000-0000-000000000002';

function makeJobResponse(status: string) {
  return {
    ok: true,
    json: async () => ({
      jobs: [
        {
          id: 'job-1',
          channelId: 'chan-1',
          provider: 'youtube',
          status,
          attempts: 0,
          lastError: null,
          updatedAt: 1234567890,
        },
      ],
    }),
    text: async () => '',
  } as unknown as Response;
}

describe('useDistributeJobsPolling', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    // Default: queued (non-terminal)
    fetchSpy.mockResolvedValue(makeJobResponse('queued'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Case 1: polls immediately on mount and every 4s during fast phase', async () => {
    const { unmount } = renderHook(() => useDistributeJobsPolling(VIDEO_ID));

    // Initial fetch fires immediately
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance 4s → second poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Advance another 4s → third poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    unmount();
  });

  it('Case 2: backs off to 10s interval after 60s elapsed', async () => {
    const { unmount } = renderHook(() => useDistributeJobsPolling(VIDEO_ID));

    // First immediate tick
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Fast forward past the 60s threshold (15 × 4s = 60s; advances to slow phase)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    const countAtSixtySeconds = fetchSpy.mock.calls.length;

    // In slow phase: 10s interval, so 10s advance = 1 more poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchSpy.mock.calls.length).toBe(countAtSixtySeconds + 1);

    // Another 4s should NOT trigger a poll (slow phase = 10s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(fetchSpy.mock.calls.length).toBe(countAtSixtySeconds + 1);

    unmount();
  });

  it('Case 3: stops polling when all jobs reach terminal state', async () => {
    fetchSpy.mockResolvedValue(makeJobResponse('live'));

    const { result, unmount } = renderHook(() => useDistributeJobsPolling(VIDEO_ID));

    // Allow the initial tick + fetch to complete
    await act(async () => {
      // Flush microtasks from the initial void tick() call
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isPolling).toBe(false);
    expect(result.current.jobs[0].status).toBe('live');

    const callCountAfterTerminal = fetchSpy.mock.calls.length;

    // Advance 8s — no more polls should fire since stopped
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(fetchSpy.mock.calls.length).toBe(callCountAfterTerminal);

    unmount();
  });

  it('Case 4: cleanup on unmount — no further fetches after unmount', async () => {
    const { unmount } = renderHook(() => useDistributeJobsPolling(VIDEO_ID));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const callsAfterFirstTick = fetchSpy.mock.calls.length;

    // Unmount immediately
    unmount();

    // Advance 20s — no new fetches should happen
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirstTick);
  });
});
