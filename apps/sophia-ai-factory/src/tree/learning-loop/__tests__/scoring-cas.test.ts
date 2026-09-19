/**
 * Tests for OCC CAS Scoring Engine (Phase 5 Milestone 1)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  updatePatternScoreCAS,
  transitionMissionLifecycleCAS,
  transitionMissionToLearningCAS,
  transitionMissionToIteratingCAS,
  canMissionTransition,
  LearningLoopError,
} from '../scoring-cas';
import type { CreativeMissionStatus, PatternScoreUpdates } from '../types';

interface MockStmt {
  first?: unknown;
  run?: { success: boolean; meta: { changes: number; duration: number } };
}

function createMockD1(stmts: MockStmt[]) {
  let callIndex = 0;
  return {
    prepare: vi.fn((sql: string) => {
      const current = stmts[callIndex++];
      return {
        bind: vi.fn((..._args: unknown[]) => ({
          first: async <T>() => (current?.first ?? null) as T,
          run: async () => current?.run ?? { success: true, meta: { changes: 0, duration: 1 } },
        })),
      };
    }),
  } as unknown as D1Database;
}

describe('scoring-cas', () => {
  const updates: PatternScoreUpdates = {
    avgMetric: 0.15,
    sampleSize: 20,
    confidence: 0.85,
    confidenceLevel: 'high',
  };

  describe('canMissionTransition', () => {
    it('permits canonical Phase 5 lifecycle transitions (completed -> learning -> iterating)', () => {
      expect(canMissionTransition('completed', 'learning')).toBe(true);
      expect(canMissionTransition('learning', 'iterating')).toBe(true);
      expect(canMissionTransition('iterating', 'running')).toBe(true);
      expect(canMissionTransition('running', 'completed')).toBe(true);
    });

    it('rejects invalid or illegal lifecycle transitions', () => {
      expect(canMissionTransition('draft', 'learning')).toBe(false);
      expect(canMissionTransition('completed', 'running')).toBe(false);
      expect(canMissionTransition('completed', 'iterating')).toBe(false);
      expect(canMissionTransition('iterating', 'completed')).toBe(false);
    });
  });

  describe('updatePatternScoreCAS', () => {
    it('succeeds on first attempt when timestamp matches without collision', async () => {
      const mockD1 = createMockD1([
        { run: { success: true, meta: { changes: 1, duration: 1 } } },
      ]);

      const result = await updatePatternScoreCAS('pattern_1', 1700000000, updates, 3, mockD1);

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(result.retries).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('resolves concurrent collision by refreshing detected_at and retrying', async () => {
      const mockD1 = createMockD1([
        // Attempt 0: conflict (0 changes)
        { run: { success: true, meta: { changes: 0, duration: 1 } } },
        // Read refreshed detected_at
        { first: { detected_at: 1700000500 } },
        // Attempt 1: succeeds with 1 change
        { run: { success: true, meta: { changes: 1, duration: 1 } } },
      ]);

      const result = await updatePatternScoreCAS('pattern_1', 1700000000, updates, 3, mockD1);

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(result.retries).toBe(1);
    });

    it('fails closed with CONCURRENT_MODIFICATION when collisions exhaust all retries', async () => {
      const mockD1 = createMockD1([
        // Attempt 0
        { run: { success: true, meta: { changes: 0, duration: 1 } } },
        { first: { detected_at: 1700000100 } },
        // Attempt 1
        { run: { success: true, meta: { changes: 0, duration: 1 } } },
        { first: { detected_at: 1700000200 } },
        // Attempt 2
        { run: { success: true, meta: { changes: 0, duration: 1 } } },
      ]);

      const result = await updatePatternScoreCAS('pattern_1', 1700000000, updates, 2, mockD1);

      expect(result.success).toBe(false);
      expect(result.changes).toBe(0);
      expect(result.retries).toBe(2);
      expect(result.error).toBe('CONCURRENT_MODIFICATION');
    });

    it('returns PATTERN_NOT_FOUND if row is deleted during conflict retry', async () => {
      const mockD1 = createMockD1([
        // Attempt 0: conflict
        { run: { success: true, meta: { changes: 0, duration: 1 } } },
        // Refresh query returns null (row was deleted)
        { first: null },
      ]);

      const result = await updatePatternScoreCAS('pattern_1', 1700000000, updates, 3, mockD1);

      expect(result.success).toBe(false);
      expect(result.changes).toBe(0);
      expect(result.error).toBe('PATTERN_NOT_FOUND');
    });

    it('returns D1_UNAVAILABLE if database client is not provided or resolved', async () => {
      // Pass undefined and mock getD1 returning null
      const result = await updatePatternScoreCAS('pattern_1', 1700000000, updates, 3, null as unknown as D1Database);

      expect(result.success).toBe(false);
      expect(result.error).toBe('D1_UNAVAILABLE');
    });
  });

  describe('transitionMissionLifecycleCAS', () => {
    it('successfully transitions mission from completed to learning via CAS', async () => {
      const mockD1 = createMockD1([
        { run: { success: true, meta: { changes: 1, duration: 1 } } },
      ]);

      await expect(
        transitionMissionLifecycleCAS('msn_1', 'completed', 'learning', 'analyzing', mockD1),
      ).resolves.not.toThrow();
    });

    it('successfully transitions mission from learning to iterating via CAS', async () => {
      const mockD1 = createMockD1([
        { run: { success: true, meta: { changes: 1, duration: 1 } } },
      ]);

      await expect(
        transitionMissionLifecycleCAS('msn_1', 'learning', 'iterating', 'iterating_run', mockD1),
      ).resolves.not.toThrow();
    });

    it('throws CONCURRENT_MODIFICATION when status was altered concurrently (changes === 0)', async () => {
      const mockD1 = createMockD1([
        { run: { success: true, meta: { changes: 0, duration: 1 } } },
      ]);

      await expect(
        transitionMissionLifecycleCAS('msn_1', 'completed', 'learning', 'analyzing', mockD1),
      ).rejects.toThrowError(LearningLoopError);

      try {
        await transitionMissionLifecycleCAS('msn_1', 'completed', 'learning', 'analyzing', mockD1);
      } catch (err) {
        expect((err as LearningLoopError).code).toBe('CONCURRENT_MODIFICATION');
      }
    });

    it('throws INVALID_STATUS_TRANSITION when attempting an illegal lifecycle transition', async () => {
      const mockD1 = createMockD1([]);

      await expect(
        transitionMissionLifecycleCAS('msn_1', 'completed', 'running', 'phase', mockD1),
      ).rejects.toThrowError(LearningLoopError);

      try {
        await transitionMissionLifecycleCAS('msn_1', 'completed', 'running', 'phase', mockD1);
      } catch (err) {
        expect((err as LearningLoopError).code).toBe('INVALID_STATUS_TRANSITION');
      }
    });

    it('throws D1_UNAVAILABLE if D1 client is missing', async () => {
      await expect(
        transitionMissionLifecycleCAS('msn_1', 'completed', 'learning', 'phase', null as unknown as D1Database),
      ).rejects.toThrowError(LearningLoopError);

      try {
        await transitionMissionLifecycleCAS('msn_1', 'completed', 'learning', 'phase', null as unknown as D1Database);
      } catch (err) {
        expect((err as LearningLoopError).code).toBe('D1_UNAVAILABLE');
      }
    });
  });

  describe('helper methods', () => {
    it('transitionMissionToLearningCAS invokes completed -> learning transition', async () => {
      const mockD1 = createMockD1([
        { run: { success: true, meta: { changes: 1, duration: 1 } } },
      ]);

      await expect(transitionMissionToLearningCAS('msn_test', mockD1)).resolves.not.toThrow();
    });

    it('transitionMissionToIteratingCAS invokes learning -> iterating transition', async () => {
      const mockD1 = createMockD1([
        { run: { success: true, meta: { changes: 1, duration: 1 } } },
      ]);

      await expect(transitionMissionToIteratingCAS('msn_test', mockD1)).resolves.not.toThrow();
    });
  });
});
