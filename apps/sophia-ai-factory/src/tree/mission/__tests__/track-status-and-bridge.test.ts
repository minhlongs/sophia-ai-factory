/**
 * Unit tests for track-status and executor-bridge in Tree mission layer.
 *
 * Covers:
 * - In-memory track status caching with TTL, overwrite, clear, and capacity
 * - getMissionTrackStatus: cache hit, preloadedConstraints parsing, D1 query, phase inference
 * - executor-bridge: registerMultiTrackExecutor, getRegisteredExecutor, direct invocation
 * - executor-bridge: fallback dispatch via Inngest event
 *
 * @module tree/mission/__tests__/track-status-and-bridge.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCachedTrackStatus,
  setCachedTrackStatus,
  clearTrackStatusCache,
  getMissionTrackStatus,
  registerMultiTrackExecutor,
  getRegisteredExecutor,
  dispatchMultiTrackMission,
  type MissionTrackStatus,
  type MultiTrackExecutionResult,
} from '../index';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  inngestSend: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.getD1,
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: mocks.inngestSend },
}));

vi.mock('@/seed/inngest/send-with-retry', () => ({
  sendInngestWithRetry: async (fn: () => Promise<unknown>) => fn(),
}));

describe('track-status', () => {
  beforeEach(() => {
    clearTrackStatusCache();
    vi.clearAllMocks();
  });

  it('caches and retrieves track status correctly', () => {
    const status: MissionTrackStatus = {
      script: 'completed',
      audio: 'running',
      visual: 'pending',
      video: 'pending',
    };

    setCachedTrackStatus('msn_test_1', status);
    const cached = getCachedTrackStatus('msn_test_1');

    expect(cached).toEqual(status);
  });

  it('returns undefined when entry is not in cache or has expired', () => {
    expect(getCachedTrackStatus('msn_nonexistent')).toBeUndefined();

    const status: MissionTrackStatus = {
      script: 'running',
      audio: 'pending',
      visual: 'pending',
      video: 'pending',
    };
    // Set with negative TTL so it immediately expires
    setCachedTrackStatus('msn_expired', status, -1000);
    expect(getCachedTrackStatus('msn_expired')).toBeUndefined();
  });

  it('clears cache specifically by missionId or globally', () => {
    const status: MissionTrackStatus = {
      script: 'completed',
      audio: 'completed',
      visual: 'completed',
      video: 'completed',
    };
    setCachedTrackStatus('msn_1', status);
    setCachedTrackStatus('msn_2', status);

    clearTrackStatusCache('msn_1');
    expect(getCachedTrackStatus('msn_1')).toBeUndefined();
    expect(getCachedTrackStatus('msn_2')).toEqual(status);

    clearTrackStatusCache();
    expect(getCachedTrackStatus('msn_2')).toBeUndefined();
  });

  it('getMissionTrackStatus returns from preloadedConstraints when present', async () => {
    const trackStatus: MissionTrackStatus = {
      script: 'completed',
      audio: 'completed',
      visual: 'running',
      video: 'pending',
    };
    const constraints = JSON.stringify({ track_status: trackStatus });

    const result = await getMissionTrackStatus('msn_preloaded', constraints);
    expect(result).toEqual(trackStatus);
  });

  it('getMissionTrackStatus queries D1 when cache misses and infers phase status', async () => {
    mocks.getD1.mockResolvedValue({
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: async () => ({
            status: 'running',
            current_phase: 'voice_and_visuals',
            constraints: null,
          }),
        })),
      })),
    });

    const result = await getMissionTrackStatus('msn_d1_query');
    expect(result).toEqual({
      script: 'completed',
      audio: 'running',
      visual: 'running',
      video: 'pending',
    });
  });
});

describe('executor-bridge', () => {
  beforeEach(() => {
    registerMultiTrackExecutor(null as never);
    vi.clearAllMocks();
  });

  it('registers and retrieves direct executor', () => {
    const mockExecutor = vi.fn();
    registerMultiTrackExecutor(mockExecutor);
    expect(getRegisteredExecutor()).toBe(mockExecutor);
  });

  it('dispatches directly when registeredExecutor is present', async () => {
    const expectedResult: MultiTrackExecutionResult = {
      success: true,
      missionId: 'msn_direct',
      workspaceId: 'ws_1',
      status: 'running',
      currentPhase: 'executing',
      trackStatus: {
        script: 'running',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      },
      tracks: {},
    };

    const mockExecutor = vi.fn().mockResolvedValue(expectedResult);
    registerMultiTrackExecutor(mockExecutor);

    const result = await dispatchMultiTrackMission('msn_direct', {
      userId: 'user_1',
      workspaceId: 'ws_1',
      topic: 'Direct dispatch test',
    });

    expect(mockExecutor).toHaveBeenCalledWith('msn_direct', {
      userId: 'user_1',
      workspaceId: 'ws_1',
      topic: 'Direct dispatch test',
    });
    expect(result).toEqual(expectedResult);
  });

  it('dispatches Inngest event when no executor is registered', async () => {
    mocks.inngestSend.mockResolvedValue({ ids: ['evt_123'] });

    const result = await dispatchMultiTrackMission('msn_inngest', {
      userId: 'user_2',
      workspaceId: 'ws_2',
      topic: 'Inngest dispatch test',
      estimatedScenes: 4,
      durationSeconds: 45,
      aspectRatio: '16:9',
    });

    expect(mocks.inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'creative.mission.multitrack.requested',
        data: expect.objectContaining({
          missionId: 'msn_inngest',
          userId: 'user_2',
          workspaceId: 'ws_2',
          topic: 'Inngest dispatch test',
          estimatedScenes: 4,
          durationSeconds: 45,
          aspectRatio: '16:9',
        }),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('running');
    expect(result.trackStatus.script).toBe('pending');
  });
});
