/**
 * Land creative-mission server action tests.
 *
 * Covers the land→tree delegation contract:
 *   - updateMissionStatus surfaces tree MissionError codes unchanged
 *   - startMissionExecution returns EXECUTION_START_INVALID WITHOUT emitting
 *     the Inngest event (atomic flip rejects before send)
 *   - startMissionExecution happy path emits agent.mission.started rich payload
 *   - resolveApprovalAction emits agent.approval.resolved (approval loop closure)
 *     and a send failure never flips the approve/reject outcome
 *
 * Harness: vi.mock module style (see campaigns-tier-integration.test.ts).
 *
 * @module land/creative-mission/__tests__/actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getD1: vi.fn(),
  inngestSend: vi.fn(),
  treeUpdateMissionStatus: vi.fn(),
  beginMissionExecution: vi.fn(),
  resolveApproval: vi.fn(),
  runMissionPreflightCheck: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.getD1,
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: mocks.inngestSend },
}));

vi.mock('@/forest/mission/preflight-check', () => ({
  runMissionPreflightCheck: mocks.runMissionPreflightCheck,
}));

vi.mock('@/tree/mission', () => ({
  beginMissionExecution: mocks.beginMissionExecution,
  createApproval: vi.fn(),
  getMissionWithGoals: vi.fn(),
  listPendingApprovals: vi.fn(),
  resolveApproval: mocks.resolveApproval,
  updateMissionStatus: mocks.treeUpdateMissionStatus,
  createMission: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

/** Build a MissionError-shaped error (name-based detection in actionFailure). */
function missionError(code: string, message: string): Error {
  const err = new Error(message);
  err.name = 'MissionError';
  (err as Error & { code: string }).code = code;
  return err;
}

/** Minimal D1 stub: prepare().bind().first()/all() driven by a queue. */
function makeD1(results: Array<unknown>) {
  let i = 0;
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => results[i++],
        all: async () => ({ results: (results[i++] as unknown[]) ?? [], meta: {} }),
      }),
    }),
  };
}

const USER = { id: 'user_1' };

describe('land/creative-mission actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── updateMissionStatus: tree error-code passthrough ───────────────────────

  describe('updateMissionStatus', () => {
    const validInput = { missionId: 'msn_1', status: 'planned' as const };

    it('surfaces tree INVALID_TRANSITION code unchanged', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      // SELECT mission, SELECT membership
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1', current_phase: 'init' }, 1]),
      );
      mocks.treeUpdateMissionStatus.mockRejectedValue(
        missionError('INVALID_TRANSITION', 'draft → completed not allowed'),
      );

      const { updateMissionStatus } = await import('../actions');
      const result = await updateMissionStatus(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TRANSITION');
      }
    });

    it('surfaces tree CONCURRENT_MODIFICATION code unchanged', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1', current_phase: 'init' }, 1]),
      );
      mocks.treeUpdateMissionStatus.mockRejectedValue(
        missionError('CONCURRENT_MODIFICATION', 'status changed concurrently'),
      );

      const { updateMissionStatus } = await import('../actions');
      const result = await updateMissionStatus(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONCURRENT_MODIFICATION');
      }
    });

    it('returns success and delegates the write to the tree authority', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1', current_phase: 'init' }, 1]),
      );
      mocks.treeUpdateMissionStatus.mockResolvedValue({ status: 'planned' });

      const { updateMissionStatus } = await import('../actions');
      const result = await updateMissionStatus(validInput);

      expect(result.ok).toBe(true);
      expect(mocks.treeUpdateMissionStatus).toHaveBeenCalledWith('msn_1', 'planned', 'init');
    });

    it('maps non-MissionError exceptions to INTERNAL', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1', current_phase: 'init' }, 1]),
      );
      mocks.treeUpdateMissionStatus.mockRejectedValue(new Error('DB connection lost'));

      const { updateMissionStatus } = await import('../actions');
      const result = await updateMissionStatus(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INTERNAL');
      }
    });
  });

  // ── startMissionExecution: atomic flip before Inngest emit ─────────────────

  describe('startMissionExecution', () => {
    const validInput = { missionId: 'msn_1', agentId: 'ag_1', autonomyLevel: 2 };

    it('returns EXECUTION_START_INVALID WITHOUT calling inngest.send', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      // SELECT mission, SELECT membership
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1' }, 1]),
      );
      mocks.beginMissionExecution.mockRejectedValue(
        missionError('EXECUTION_START_INVALID', 'review → running not allowed'),
      );

      const { startMissionExecution } = await import('../actions');
      const result = await startMissionExecution(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EXECUTION_START_INVALID');
      }
      // Critical invariant: no event emitted when the atomic flip rejects
      expect(mocks.inngestSend).not.toHaveBeenCalled();
    });

    it('happy path emits agent.mission.started with rich payload', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1' }, 1]),
      );
      mocks.beginMissionExecution.mockResolvedValue({ status: 'running' });
      mocks.inngestSend.mockResolvedValue(undefined);

      const { startMissionExecution } = await import('../actions');
      const result = await startMissionExecution(validInput);

      expect(result.ok).toBe(true);
      expect(mocks.beginMissionExecution).toHaveBeenCalledWith('msn_1');
      expect(mocks.inngestSend).toHaveBeenCalledTimes(1);

      const sent = mocks.inngestSend.mock.calls[0][0];
      expect(sent.name).toBe('agent.mission.started');
      expect(sent.data).toMatchObject({
        agentId: 'ag_1',
        missionId: 'msn_1',
        workspaceId: 'ws_1',
        autonomyLevel: 2,
      });
      expect(sent.data.runId).toBeTypeOf('string');
      if (result.ok) {
        expect(result.value.agentId).toBe('ag_1');
        expect(result.value.runId).toBe(sent.data.runId);
      }
    });

    it('passes estimatedCostCents to runMissionPreflightCheck when skipPreflight is false', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1' }, 1]),
      );
      mocks.runMissionPreflightCheck.mockResolvedValue({
        passed: true,
        gates: {} as unknown,
      });
      mocks.beginMissionExecution.mockResolvedValue({ status: 'running' });
      mocks.inngestSend.mockResolvedValue(undefined);

      const { startMissionExecution } = await import('../actions');
      const result = await startMissionExecution({
        ...validInput,
        skipPreflight: false,
        estimatedCostCents: 250,
      });

      expect(result.ok).toBe(true);
      expect(mocks.runMissionPreflightCheck).toHaveBeenCalledWith({
        userId: 'user_1',
        workspaceId: 'ws_1',
        estimatedCostCents: 250,
        overrides: {
          membershipVerified: true,
        },
      });
    });

    it('fails closed when runMissionPreflightCheck fails due to cost spike or billing failure', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1' }, 1]),
      );
      mocks.runMissionPreflightCheck.mockResolvedValue({
        passed: false,
        failureCode: 'BILLING_FAILURE',
        failureReason: 'Preflight aborted: Estimated cost (600¢) exceeds single mission limit (500¢)',
        gates: {} as unknown,
      });

      const { startMissionExecution } = await import('../actions');
      const result = await startMissionExecution({
        ...validInput,
        skipPreflight: false,
        estimatedCostCents: 600,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BILLING_FAILURE');
        expect(result.error.message).toContain('exceeds single mission limit');
      }
      expect(mocks.beginMissionExecution).not.toHaveBeenCalled();
      expect(mocks.inngestSend).not.toHaveBeenCalled();
    });

    it('returns NOT_FOUND without touching tree or Inngest when mission missing', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(makeD1([null]));

      const { startMissionExecution } = await import('../actions');
      const result = await startMissionExecution(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
      expect(mocks.beginMissionExecution).not.toHaveBeenCalled();
      expect(mocks.inngestSend).not.toHaveBeenCalled();
    });
  });

  // ── resolveApprovalAction: approval loop closure ───────────────────────────

  describe('resolveApprovalAction', () => {
    const validInput = { approvalId: 'apr_1', approved: true, reason: 'looks good' };

    /** D1 queue: approval row, agent run, membership, admin access. */
    function approveD1() {
      return makeD1([
        { id: 'apr_1', agent_run_id: 'run_1', status: 'pending' },
        { workspace_id: 'ws_1' },
        1,
        1,
      ]);
    }

    it('emits agent.approval.resolved with the handler payload shape', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(approveD1());
      mocks.resolveApproval.mockResolvedValue({
        ok: true,
        value: { id: 'apr_1', agent_run_id: 'run_1', status: 'approved' },
      });
      mocks.inngestSend.mockResolvedValue(undefined);

      const { resolveApprovalAction } = await import('../actions');
      const result = await resolveApprovalAction(validInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('approved');
      }
      expect(mocks.inngestSend).toHaveBeenCalledTimes(1);

      const sent = mocks.inngestSend.mock.calls[0][0];
      expect(sent.name).toBe('agent.approval.resolved');
      expect(sent.data).toEqual({
        approvalId: 'apr_1',
        runId: 'run_1',
        status: 'approved',
        reviewerId: 'user_1',
        comment: 'looks good',
      });
    });

    it('keeps the success response unchanged when inngest.send throws', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(approveD1());
      mocks.resolveApproval.mockResolvedValue({
        ok: true,
        value: { id: 'apr_1', agent_run_id: 'run_1', status: 'approved' },
      });
      mocks.inngestSend.mockRejectedValue(new Error('Inngest unreachable'));

      const { resolveApprovalAction } = await import('../actions');
      const result = await resolveApprovalAction(validInput);

      // Non-fatal emit: the approve outcome must not flip on send failure.
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('approved');
      }
      expect(mocks.inngestSend).toHaveBeenCalledTimes(1);
      expect(mocks.logger.warn).toHaveBeenCalled();
    });

    it('emits rejected status and omits comment when reason is absent', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(approveD1());
      mocks.resolveApproval.mockResolvedValue({
        ok: true,
        value: { id: 'apr_1', agent_run_id: 'run_1', status: 'rejected' },
      });
      mocks.inngestSend.mockResolvedValue(undefined);

      const { resolveApprovalAction } = await import('../actions');
      const result = await resolveApprovalAction({ approvalId: 'apr_1', approved: false });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('rejected');
      }
      const sent = mocks.inngestSend.mock.calls[0][0];
      expect(sent.name).toBe('agent.approval.resolved');
      expect(sent.data).toEqual({
        approvalId: 'apr_1',
        runId: 'run_1',
        status: 'rejected',
        reviewerId: 'user_1',
        comment: undefined,
      });
    });

    it('does not emit when the tree resolve fails', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(approveD1());
      mocks.resolveApproval.mockResolvedValue({
        ok: false,
        error: { code: 'ALREADY_RESOLVED', message: 'Approval apr_1 already resolved' },
      });

      const { resolveApprovalAction } = await import('../actions');
      const result = await resolveApprovalAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ALREADY_RESOLVED');
      }
      expect(mocks.inngestSend).not.toHaveBeenCalled();
    });
  });
});
