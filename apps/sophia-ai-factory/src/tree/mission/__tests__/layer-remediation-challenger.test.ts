/**
 * Empirical Challenger Test Suite: Layer Boundary Remediation & Inngest Decoupling
 *
 * This test suite adversarial stress-tests:
 * 1. dispatchMultiTrackMission (direct in-memory & Inngest fallback, error propagation)
 * 2. getMissionTrackStatus & caching (hits, immutability, TTL eviction, capacity boundary, fallback chain)
 * 3. Static layer boundary verification across all src/land/ files.
 *
 * @module tree/mission/__tests__/layer-remediation-challenger.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
  sendInngestWithRetry: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.getD1,
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: mocks.inngestSend },
}));

vi.mock('@/seed/inngest/send-with-retry', () => ({
  sendInngestWithRetry: (fn: () => Promise<unknown>) => mocks.sendInngestWithRetry(fn),
}));

describe('Empirical Challenge 1: dispatchMultiTrackMission', () => {
  beforeEach(() => {
    registerMultiTrackExecutor(null as never);
    vi.clearAllMocks();
    // Default pass-through for sendInngestWithRetry
    mocks.sendInngestWithRetry.mockImplementation((fn: () => Promise<unknown>) => fn());
  });

  describe('Direct Executor Path', () => {
    it('executes registered executor and returns exact resolved result', async () => {
      const mockResult: MultiTrackExecutionResult = {
        success: true,
        missionId: 'msn_direct_pass',
        workspaceId: 'ws_direct_1',
        status: 'completed',
        currentPhase: 'composited',
        trackStatus: {
          script: 'completed',
          audio: 'completed',
          visual: 'completed',
          video: 'completed',
        },
        tracks: {
          script: {
            title: 'Mock Script',
            fullNarration: 'Full narration text',
            scenes: [{ index: 1, prompt: 'Hello scene' }],
            estimatedDurationSec: 30,
            wordCount: 50,
          },
        },
      };

      const executor = vi.fn().mockResolvedValue(mockResult);
      registerMultiTrackExecutor(executor);

      expect(getRegisteredExecutor()).toBe(executor);

      const result = await dispatchMultiTrackMission('msn_direct_pass', {
        userId: 'u_1',
        workspaceId: 'ws_direct_1',
        topic: 'AI Tech Documentary',
      });

      expect(executor).toHaveBeenCalledTimes(1);
      expect(executor).toHaveBeenCalledWith('msn_direct_pass', {
        userId: 'u_1',
        workspaceId: 'ws_direct_1',
        topic: 'AI Tech Documentary',
      });
      expect(result).toEqual(mockResult);
      expect(mocks.inngestSend).not.toHaveBeenCalled();
    });

    it('defaults options to empty object when omitted in direct invocation', async () => {
      const mockResult: MultiTrackExecutionResult = {
        success: true,
        missionId: 'msn_no_opts',
        workspaceId: '',
        status: 'running',
        currentPhase: 'executing',
        trackStatus: {
          script: 'pending',
          audio: 'pending',
          visual: 'pending',
          video: 'pending',
        },
        tracks: {},
      };

      const executor = vi.fn().mockResolvedValue(mockResult);
      registerMultiTrackExecutor(executor);

      const result = await dispatchMultiTrackMission('msn_no_opts');
      expect(executor).toHaveBeenCalledWith('msn_no_opts', {});
      expect(result).toEqual(mockResult);
    });

    it('propagates rejection when registered executor rejects with Error', async () => {
      const expectedError = new Error('Direct executor crashed due to GPU out of memory');
      const executor = vi.fn().mockRejectedValue(expectedError);
      registerMultiTrackExecutor(executor);

      await expect(
        dispatchMultiTrackMission('msn_fail', { workspaceId: 'ws_1' }),
      ).rejects.toThrow('Direct executor crashed due to GPU out of memory');
    });

    it('propagates error when registered executor throws synchronously', async () => {
      const syncError = new Error('Synchronous assertion failed in executor');
      const executor = vi.fn().mockImplementation(() => {
        throw syncError;
      });
      registerMultiTrackExecutor(executor);

      await expect(
        dispatchMultiTrackMission('msn_sync_fail'),
      ).rejects.toThrow('Synchronous assertion failed in executor');
    });
  });

  describe('Unregistered Inngest Event Fallback Path', () => {
    it('dispatches creative.mission.multitrack.requested event with correct payload structure', async () => {
      mocks.inngestSend.mockResolvedValue({ ids: ['evt_test_success'] });

      const startTime = Date.now();
      const result = await dispatchMultiTrackMission('msn_inngest_pass', {
        userId: 'u_2',
        workspaceId: 'ws_inngest_2',
        topic: 'Robotics Future',
        estimatedScenes: 5,
        durationSeconds: 60,
        aspectRatio: '9:16',
        estimatedCostCents: 45,
      });

      expect(mocks.sendInngestWithRetry).toHaveBeenCalledTimes(1);
      expect(mocks.inngestSend).toHaveBeenCalledTimes(1);

      const sentCall = mocks.inngestSend.mock.calls[0][0];
      expect(sentCall.name).toBe('creative.mission.multitrack.requested');
      expect(sentCall.id).toMatch(/^mt_msn_inngest_pass_\d+$/);
      expect(sentCall.ts).toBeGreaterThanOrEqual(startTime);
      expect(sentCall.data).toEqual({
        missionId: 'msn_inngest_pass',
        userId: 'u_2',
        workspaceId: 'ws_inngest_2',
        topic: 'Robotics Future',
        estimatedScenes: 5,
        durationSeconds: 60,
        aspectRatio: '9:16',
        estimatedCostCents: 45,
      });

      expect(result).toEqual({
        success: true,
        missionId: 'msn_inngest_pass',
        workspaceId: 'ws_inngest_2',
        status: 'running',
        currentPhase: 'executing',
        trackStatus: {
          script: 'pending',
          audio: 'pending',
          visual: 'pending',
          video: 'pending',
        },
        tracks: {},
      });
    });

    it('safely handles missing optional fields in options parameter', async () => {
      mocks.inngestSend.mockResolvedValue({ ids: ['evt_partial'] });

      const result = await dispatchMultiTrackMission('msn_partial');
      expect(result.success).toBe(true);
      expect(result.workspaceId).toBe('');

      const sentData = mocks.inngestSend.mock.calls[0][0].data;
      expect(sentData.userId).toBe('');
      expect(sentData.workspaceId).toBe('');
      expect(sentData.topic).toBeUndefined();
      expect(sentData.aspectRatio).toBeUndefined();
    });

    it('propagates error when Inngest client send throws', async () => {
      const inngestError = new Error('Inngest 503 Service Unavailable: Event ingestion gateway down');
      mocks.inngestSend.mockRejectedValue(inngestError);

      await expect(
        dispatchMultiTrackMission('msn_inngest_fail', {
          userId: 'u_fail',
          workspaceId: 'ws_fail',
        }),
      ).rejects.toThrow('Inngest 503 Service Unavailable');
    });

    it('propagates error when sendInngestWithRetry itself rejects', async () => {
      mocks.sendInngestWithRetry.mockRejectedValue(new Error('Retry queue max attempts exhausted'));

      await expect(
        dispatchMultiTrackMission('msn_retry_exhausted'),
      ).rejects.toThrow('Retry queue max attempts exhausted');
    });
  });
});

describe('Empirical Challenge 2: getMissionTrackStatus & In-Memory Caching', () => {
  beforeEach(() => {
    clearTrackStatusCache();
    vi.clearAllMocks();
  });

  describe('Cache Immutability & Lifecycle', () => {
    it('defends against caller mutation of retrieved cache object (read immutability)', () => {
      const original: MissionTrackStatus = {
        script: 'pending',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      };
      setCachedTrackStatus('msn_mut_read', original);

      const retrieved1 = getCachedTrackStatus('msn_mut_read')!;
      expect(retrieved1).toEqual(original);

      // Mutate retrieved object
      retrieved1.script = 'failed';
      retrieved1.video = 'completed';

      // Subsequent read must NOT be affected
      const retrieved2 = getCachedTrackStatus('msn_mut_read')!;
      expect(retrieved2.script).toBe('pending');
      expect(retrieved2.video).toBe('pending');
    });

    it('defends against caller mutation of source object after setting (write immutability)', () => {
      const source: MissionTrackStatus = {
        script: 'running',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      };
      setCachedTrackStatus('msn_mut_write', source);

      // Mutate original source object
      source.script = 'completed';

      // Cache should retain the value at time of set
      const retrieved = getCachedTrackStatus('msn_mut_write')!;
      expect(retrieved.script).toBe('running');
    });

    it('evicts expired entries on access when TTL is reached', () => {
      const status: MissionTrackStatus = {
        script: 'running',
        audio: 'running',
        visual: 'pending',
        video: 'pending',
      };

      // Set with negative TTL
      setCachedTrackStatus('msn_ttl_expired', status, -50);
      expect(getCachedTrackStatus('msn_ttl_expired')).toBeUndefined();
    });

    it('clears specific entry while leaving other entries intact', () => {
      const s1: MissionTrackStatus = { script: 'running', audio: 'pending', visual: 'pending', video: 'pending' };
      const s2: MissionTrackStatus = { script: 'completed', audio: 'completed', visual: 'completed', video: 'completed' };

      setCachedTrackStatus('msn_keep', s1);
      setCachedTrackStatus('msn_remove', s2);

      clearTrackStatusCache('msn_remove');

      expect(getCachedTrackStatus('msn_remove')).toBeUndefined();
      expect(getCachedTrackStatus('msn_keep')).toEqual(s1);
    });

    it('clears entire cache on clearTrackStatusCache() without arguments', () => {
      setCachedTrackStatus('msn_a', { script: 'running', audio: 'pending', visual: 'pending', video: 'pending' });
      setCachedTrackStatus('msn_b', { script: 'completed', audio: 'completed', visual: 'completed', video: 'completed' });

      clearTrackStatusCache();

      expect(getCachedTrackStatus('msn_a')).toBeUndefined();
      expect(getCachedTrackStatus('msn_b')).toBeUndefined();
    });

    it('handles capacity bounds (MAX_CACHE_ENTRIES = 500) and evicts oldest entries', () => {
      // Insert 500 entries
      for (let i = 0; i < 500; i++) {
        setCachedTrackStatus(`msn_fill_${i}`, {
          script: 'running',
          audio: 'pending',
          visual: 'pending',
          video: 'pending',
        });
      }

      expect(getCachedTrackStatus('msn_fill_0')).toBeDefined();
      expect(getCachedTrackStatus('msn_fill_499')).toBeDefined();

      // Adding the 501st entry triggers capacity prune of oldest 50 entries
      setCachedTrackStatus('msn_fill_500', {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      });

      // The first 50 entries (0..49) should have been evicted
      for (let i = 0; i < 50; i++) {
        expect(getCachedTrackStatus(`msn_fill_${i}`)).toBeUndefined();
      }

      // Entries 50..500 must remain
      expect(getCachedTrackStatus('msn_fill_50')).toBeDefined();
      expect(getCachedTrackStatus('msn_fill_500')).toBeDefined();
    });

    it('prunes expired entries before evicting active entries when capacity is reached', () => {
      // Add 250 expired entries
      for (let i = 0; i < 250; i++) {
        setCachedTrackStatus(`msn_exp_${i}`, {
          script: 'running',
          audio: 'pending',
          visual: 'pending',
          video: 'pending',
        }, -100);
      }

      // Add 250 active entries
      for (let i = 250; i < 500; i++) {
        setCachedTrackStatus(`msn_act_${i}`, {
          script: 'completed',
          audio: 'completed',
          visual: 'completed',
          video: 'completed',
        }, 100000);
      }

      // Adding 1 more entry when total keys == 500 triggers sweep:
      // The 250 expired ones get deleted, so active ones are preserved without pruning oldest
      setCachedTrackStatus('msn_new', {
        script: 'pending',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      });

      expect(getCachedTrackStatus('msn_act_250')).toBeDefined();
      expect(getCachedTrackStatus('msn_act_499')).toBeDefined();
      expect(getCachedTrackStatus('msn_new')).toBeDefined();
    });
  });

  describe('getMissionTrackStatus Fallback Pipeline', () => {
    it('uses cache hit first without querying DB', async () => {
      const cachedStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'running',
        visual: 'pending',
        video: 'pending',
      };
      setCachedTrackStatus('msn_cache_priority', cachedStatus);

      const result = await getMissionTrackStatus('msn_cache_priority');
      expect(result).toEqual(cachedStatus);
      expect(mocks.getD1).not.toHaveBeenCalled();
    });

    it('uses valid preloadedConstraints without querying DB', async () => {
      const expected: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'running',
        video: 'pending',
      };
      const constraints = JSON.stringify({
        track_status: expected,
        aspect_ratio: '16:9',
      });

      const result = await getMissionTrackStatus('msn_preloaded_valid', constraints);
      expect(result).toEqual(expected);
      expect(mocks.getD1).not.toHaveBeenCalled();
    });

    it('falls through to D1 if preloadedConstraints is invalid JSON', async () => {
      mocks.getD1.mockResolvedValue({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: async () => ({
              status: 'completed',
              current_phase: 'composited',
              constraints: null,
            }),
          })),
        })),
      });

      const result = await getMissionTrackStatus('msn_malformed_json', '{"invalid_json: 123');
      expect(mocks.getD1).toHaveBeenCalled();
      expect(result).toEqual({
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      });
    });

    it('falls through to D1 if preloadedConstraints has no track_status field', async () => {
      mocks.getD1.mockResolvedValue({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: async () => ({
              status: 'running',
              current_phase: 'script_generation',
              constraints: null,
            }),
          })),
        })),
      });

      const result = await getMissionTrackStatus('msn_no_track_status', JSON.stringify({ other: true }));
      expect(mocks.getD1).toHaveBeenCalled();
      expect(result).toEqual({
        script: 'running',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      });
    });

    it('queries D1 and parses constraints JSON, caching if mission status is running', async () => {
      const dbStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'running',
        video: 'pending',
      };

      mocks.getD1.mockResolvedValue({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: async () => ({
              status: 'running',
              current_phase: 'voice_and_visuals',
              constraints: JSON.stringify({ track_status: dbStatus }),
            }),
          })),
        })),
      });

      const result = await getMissionTrackStatus('msn_d1_running');
      expect(result).toEqual(dbStatus);

      // Verify that it got cached because status === 'running'
      expect(getCachedTrackStatus('msn_d1_running')).toEqual(dbStatus);
    });

    it('queries D1 and parses constraints JSON, NOT caching if mission status is completed', async () => {
      const dbStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      };

      mocks.getD1.mockResolvedValue({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: async () => ({
              status: 'completed',
              current_phase: 'composited',
              constraints: JSON.stringify({ track_status: dbStatus }),
            }),
          })),
        })),
      });

      const result = await getMissionTrackStatus('msn_d1_completed');
      expect(result).toEqual(dbStatus);

      // Verify that it was NOT cached because status !== 'running'
      expect(getCachedTrackStatus('msn_d1_completed')).toBeUndefined();
    });

    it('infers track status for failed or cancelled missions', async () => {
      mocks.getD1.mockResolvedValue({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: async () => ({
              status: 'failed',
              current_phase: 'voice_and_visuals',
              constraints: null,
            }),
          })),
        })),
      });

      const result = await getMissionTrackStatus('msn_failed');
      expect(result).toEqual({
        script: 'failed',
        audio: 'failed',
        visual: 'failed',
        video: 'failed',
      });
    });

    it('infers track status for video_compositing phase', async () => {
      mocks.getD1.mockResolvedValue({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: async () => ({
              status: 'running',
              current_phase: 'video_compositing',
              constraints: null,
            }),
          })),
        })),
      });

      const result = await getMissionTrackStatus('msn_phase_video');
      expect(result).toEqual({
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'running',
      });
    });

    it('returns default all-pending when getD1 returns null', async () => {
      mocks.getD1.mockResolvedValue(null);

      const result = await getMissionTrackStatus('msn_no_db');
      expect(result).toEqual({
        script: 'pending',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      });
    });

    it('returns default all-pending when D1 query throws an error', async () => {
      mocks.getD1.mockResolvedValue({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: async () => {
              throw new Error('D1 connection timeout');
            },
          })),
        })),
      });

      const result = await getMissionTrackStatus('msn_db_error');
      expect(result).toEqual({
        script: 'pending',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      });
    });
  });
});

describe('Empirical Challenge 3: Static Layer Boundary Scan across src/land/', () => {
  function getAllFiles(dir: string): string[] {
    const entries = readdirSync(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath));
      } else if (/\.(ts|tsx)$/.test(entry)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('verifies zero static imports from @/forest across all src/land/ files', () => {
    // Search directory is apps/sophia-ai-factory/src/land
    const landDir = join(__dirname, '../../../../src/land');
    const allLandFiles = getAllFiles(landDir);

    const violations: { file: string; line: number; text: string }[] = [];

    // Check for static ES import: from ['"]@/forest
    const regex = /from\s+['"]@\/forest/g;

    for (const file of allLandFiles) {
      // Exclude test files
      if (file.includes('__tests__') || file.includes('.test.') || file.includes('.spec.')) {
        continue;
      }
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          violations.push({
            file,
            line: i + 1,
            text: lines[i].trim(),
          });
        }
        regex.lastIndex = 0; // reset regex state
      }
    }

    expect(violations).toEqual([]);
  });
});
