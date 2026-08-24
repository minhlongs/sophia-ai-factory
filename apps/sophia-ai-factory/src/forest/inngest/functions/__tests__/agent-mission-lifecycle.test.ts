/**
 * Agent Mission Lifecycle helpers tests.
 *
 * Covers: emitMissionCompleted / emitMissionFailed payload exactness
 *         (compile-time checked against seed AgentMissionCompletedData /
 *         AgentMissionFailedData), advanceMissionToReview swallow-warn on
 *         MissionError.
 *
 * @module forest/inngest/functions/__tests__/agent-mission-lifecycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockInngestSend: vi.fn(),
  mockUpdateMissionStatus: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Cast to never: emit helpers accept the seeded Inngest client type; the mock
// only implements `send`, which is the sole member exercised here.
const mockInngest = { send: mocks.mockInngestSend } as never;

vi.mock('@/seed/inngest/client', () => ({
  inngest: mockInngest,
}));

vi.mock('@/tree/mission', () => ({
  updateMissionStatus: mocks.mockUpdateMissionStatus,
}));

vi.mock('@/tree/mission/types', () => ({
  updateMissionStatus: mocks.mockUpdateMissionStatus,
  MissionError: class MissionError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'MissionError';
      this.code = code;
    }
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.mockLogger,
}));

describe('agent-mission-lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── emitMissionCompleted ───────────────────────────────────────────────────

  describe('emitMissionCompleted', () => {
    it('sends agent.mission.completed with exact AgentMissionCompletedData payload keys', async () => {
      const { emitMissionCompleted } = await import('../agent-mission-lifecycle');

      await emitMissionCompleted(mockInngest, {
        runId: 'run_123',
        agentId: 'ag_456',
        missionId: 'msn_789',
        totalCostCents: 12345,
        totalTokens: 67890,
      });

      expect(mocks.mockInngestSend).toHaveBeenCalledTimes(1);
      const call = mocks.mockInngestSend.mock.calls[0][0];
      expect(call.name).toBe('agent.mission.completed');
      expect(call.data).toMatchObject({
        runId: 'run_123',
        agentId: 'ag_456',
        missionId: 'msn_789',
        totalCostCents: 12345,
        totalTokens: 67890,
      });
      // Ensure no extra fields — exact payload contract
      expect(Object.keys(call.data).sort()).toEqual(
        ['runId', 'agentId', 'missionId', 'totalCostCents', 'totalTokens'].sort()
      );
    });

    it('throws if inngest.send throws', async () => {
      mocks.mockInngestSend.mockRejectedValueOnce(new Error('Inngest down'));
      const { emitMissionCompleted } = await import('../agent-mission-lifecycle');

      await expect(
        emitMissionCompleted(mockInngest, {
          runId: 'run_123',
          agentId: 'ag_456',
          missionId: 'msn_789',
          totalCostCents: 100,
          totalTokens: 200,
        })
      ).rejects.toThrow('Inngest down');
    });
  });

  // ── emitMissionFailed ──────────────────────────────────────────────────────

  describe('emitMissionFailed', () => {
    it('sends agent.mission.failed with exact AgentMissionFailedData payload keys', async () => {
      const { emitMissionFailed } = await import('../agent-mission-lifecycle');

      await emitMissionFailed(mockInngest, {
        runId: 'run_123',
        agentId: 'ag_456',
        missionId: 'msn_789',
        errorCode: 'NO_PROVIDER',
        errorMessage: 'No healthy provider available',
      });

      expect(mocks.mockInngestSend).toHaveBeenCalledTimes(1);
      const call = mocks.mockInngestSend.mock.calls[0][0];
      expect(call.name).toBe('agent.mission.failed');
      expect(call.data).toMatchObject({
        runId: 'run_123',
        agentId: 'ag_456',
        missionId: 'msn_789',
        errorCode: 'NO_PROVIDER',
        errorMessage: 'No healthy provider available',
      });
      // Ensure no extra fields — exact payload contract
      expect(Object.keys(call.data).sort()).toEqual(
        ['runId', 'agentId', 'missionId', 'errorCode', 'errorMessage'].sort()
      );
    });

    it('throws if inngest.send throws', async () => {
      mocks.mockInngestSend.mockRejectedValueOnce(new Error('Inngest down'));
      const { emitMissionFailed } = await import('../agent-mission-lifecycle');

      await expect(
        emitMissionFailed(mockInngest, {
          runId: 'run_123',
          agentId: 'ag_456',
          missionId: 'msn_789',
          errorCode: 'RUNTIME_ERROR',
          errorMessage: 'Boom',
        })
      ).rejects.toThrow('Inngest down');
    });
  });

  // ── advanceMissionToReview ─────────────────────────────────────────────────

  describe('advanceMissionToReview', () => {
    it('calls updateMissionStatus with missionId, review, review and returns advanced=true', async () => {
      mocks.mockUpdateMissionStatus.mockResolvedValueOnce({
        id: 'msn_123',
        status: 'review',
        currentPhase: 'review',
      } as never);

      const { advanceMissionToReview } = await import('../agent-mission-lifecycle');
      const result = await advanceMissionToReview('msn_123');

      expect(mocks.mockUpdateMissionStatus).toHaveBeenCalledTimes(1);
      expect(mocks.mockUpdateMissionStatus).toHaveBeenCalledWith('msn_123', 'review', 'review');
      expect(result).toEqual({ advanced: true });
    });

    it('swallows MissionError.INVALID_TRANSITION, logs warn, returns advanced=false', async () => {
      const { MissionError } = await import('@/tree/mission/types');
      mocks.mockUpdateMissionStatus.mockRejectedValueOnce(
        new MissionError('INVALID_TRANSITION', 'completed → review not allowed')
      );

      const { advanceMissionToReview } = await import('../agent-mission-lifecycle');
      const result = await advanceMissionToReview('msn_123');

      expect(mocks.mockUpdateMissionStatus).toHaveBeenCalledTimes(1);
      expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
        'agentMissionLifecycle: advance-to-review rejected (non-fatal)',
        expect.objectContaining({
          missionId: 'msn_123',
          code: 'INVALID_TRANSITION',
        })
      );
      expect(result).toEqual({ advanced: false });
    });

    it('swallows MissionError.CONCURRENT_MODIFICATION, logs warn, returns advanced=false', async () => {
      const { MissionError } = await import('@/tree/mission/types');
      mocks.mockUpdateMissionStatus.mockRejectedValueOnce(
        new MissionError('CONCURRENT_MODIFICATION', 'Mission msn_123 status changed concurrently')
      );

      const { advanceMissionToReview } = await import('../agent-mission-lifecycle');
      const result = await advanceMissionToReview('msn_123');

      expect(mocks.mockUpdateMissionStatus).toHaveBeenCalledTimes(1);
      expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
        'agentMissionLifecycle: advance-to-review rejected (non-fatal)',
        expect.objectContaining({
          missionId: 'msn_123',
          code: 'CONCURRENT_MODIFICATION',
        })
      );
      expect(result).toEqual({ advanced: false });
    });

    it('swallows MissionError.NOT_FOUND, logs warn, returns advanced=false', async () => {
      const { MissionError } = await import('@/tree/mission/types');
      mocks.mockUpdateMissionStatus.mockRejectedValueOnce(
        new MissionError('NOT_FOUND', 'Mission msn_123 not found')
      );

      const { advanceMissionToReview } = await import('../agent-mission-lifecycle');
      const result = await advanceMissionToReview('msn_123');

      expect(mocks.mockUpdateMissionStatus).toHaveBeenCalledTimes(1);
      expect(mocks.mockLogger.warn).toHaveBeenCalledWith(
        'agentMissionLifecycle: advance-to-review rejected (non-fatal)',
        expect.objectContaining({
          missionId: 'msn_123',
          code: 'NOT_FOUND',
        })
      );
      expect(result).toEqual({ advanced: false });
    });

    it('propagates unexpected errors (not MissionError)', async () => {
      mocks.mockUpdateMissionStatus.mockRejectedValueOnce(new Error('DB connection lost'));

      const { advanceMissionToReview } = await import('../agent-mission-lifecycle');
      await expect(advanceMissionToReview('msn_123')).rejects.toThrow('DB connection lost');

      // No warn log for unexpected errors
      expect(mocks.mockLogger.warn).not.toHaveBeenCalled();
    });

    it('does not call logger.warn on success', async () => {
      mocks.mockUpdateMissionStatus.mockResolvedValueOnce({
        id: 'msn_123',
        status: 'review',
        currentPhase: 'review',
      } as never);

      const { advanceMissionToReview } = await import('../agent-mission-lifecycle');
      await advanceMissionToReview('msn_123');

      expect(mocks.mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});