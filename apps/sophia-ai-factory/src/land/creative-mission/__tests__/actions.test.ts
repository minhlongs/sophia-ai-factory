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
  executeMultiTrackMission: vi.fn(),
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

vi.mock('@/tree/mission/preflight-check', () => ({
  runMissionPreflightCheck: mocks.runMissionPreflightCheck,
}));

vi.mock('@/forest/mission/preflight-check', () => ({
  runMissionPreflightCheck: mocks.runMissionPreflightCheck,
}));

vi.mock('@/tree/mission', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tree/mission')>();
  return {
    ...actual,
    beginMissionExecution: mocks.beginMissionExecution,
    createApproval: vi.fn(),
    getMissionWithGoals: vi.fn(),
    listPendingApprovals: vi.fn(),
    resolveApproval: mocks.resolveApproval,
    updateMissionStatus: mocks.treeUpdateMissionStatus,
    createMission: vi.fn(),
    dispatchMultiTrackMission: mocks.executeMultiTrackMission,
  };
});


vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
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
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: async () => results[i++],
        all: async () => ({ results: (results[i++] as unknown[]) ?? [], meta: {} }),
        run: async () => ({ success: true, meta: { changes: 1 } }),
      })),
    })),
  };
}

const USER = { id: 'user_1' };

describe('land/creative-mission actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runMissionPreflightCheck.mockResolvedValue({ passed: true, gates: {} });
    mocks.executeMultiTrackMission.mockResolvedValue({
      success: true,
      missionId: 'msn_multi_1',
      status: 'review',
      currentPhase: 'review',
      trackStatus: { script: 'completed', audio: 'completed', visual: 'completed', video: 'completed' },
      tracks: {},
    });
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

    it('passes estimatedCostCents to runMissionPreflightCheck unconditionally', async () => {
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
        estimatedCostCents: 250,
      });

      expect(result.ok).toBe(true);
      expect(mocks.runMissionPreflightCheck).toHaveBeenCalledWith({
        userId: 'user_1',
        workspaceId: 'ws_1',
        estimatedCostCents: 250,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
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

    it('retries transient inngest.send failure and succeeds', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([{ workspace_id: 'ws_1', creator_id: 'user_1' }, 1]),
      );
      mocks.beginMissionExecution.mockResolvedValue({ status: 'running' });
      mocks.inngestSend
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce(undefined);

      const { startMissionExecution } = await import('../actions');
      const result = await startMissionExecution(validInput);

      expect(result.ok).toBe(true);
      expect(mocks.inngestSend).toHaveBeenCalledTimes(2);
      if (result.ok) {
        expect(result.value.agentId).toBe('ag_1');
      }
    });

    it('safely rolls back mission in D1 when inngest.send exhausts retries', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      const fakeD1 = makeD1([
        { workspace_id: 'ws_1', creator_id: 'user_1', status: 'planned', current_phase: 'init' },
        1,
      ]);
      mocks.getD1.mockReturnValue(fakeD1);
      mocks.beginMissionExecution.mockResolvedValue({ status: 'running' });
      mocks.inngestSend.mockRejectedValue(new Error('Gateway Timeout 504'));

      const { startMissionExecution } = await import('../actions');
      const result = await startMissionExecution(validInput);

      expect(result.ok).toBe(false);
      // inngest.send was attempted 3 times (1 initial + 2 retries)
      expect(mocks.inngestSend).toHaveBeenCalledTimes(3);
      // Rollback UPDATE query was executed in D1
      expect(fakeD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE creative_missions'),
      );
      expect(mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('inngest.send failed, rolling back mission status'),
        expect.objectContaining({
          missionId: 'msn_1',
          previousStatus: 'planned',
        }),
      );
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

  // ── getMissionTrackStatus: live track state query ──────────────────────────

  describe('getMissionTrackStatus', () => {
    it('returns track status for authorized user', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([
          {
            workspace_id: 'ws_1',
            creator_id: 'user_1',
            status: 'running',
            current_phase: 'voice_and_visuals',
            constraints: JSON.stringify({
              track_status: {
                script: 'completed',
                audio: 'running',
                visual: 'running',
                video: 'pending',
              },
            }),
          },
          1, // membership access verified
        ])
      );

      const { getMissionTrackStatus } = await import('../actions');
      const result = await getMissionTrackStatus('msn_track_query_1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.missionId).toBe('msn_track_query_1');
        expect(result.value.status).toBe('running');
        expect(result.value.currentPhase).toBe('voice_and_visuals');
        expect(result.value.trackStatus.script).toBe('completed');
        expect(result.value.trackStatus.audio).toBe('running');
        expect(result.value.trackStatus.visual).toBe('running');
        expect(result.value.trackStatus.video).toBe('pending');
      }
    });

    it('fails when user lacks workspace access', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([
          { workspace_id: 'ws_private', creator_id: 'other_user', status: 'running', current_phase: 'executing' },
          null, // membership access denied
        ])
      );

      const { getMissionTrackStatus } = await import('../actions');
      const result = await getMissionTrackStatus({ missionId: 'msn_forbidden' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns NOT_FOUND when mission does not exist', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(makeD1([null]));

      const { getMissionTrackStatus } = await import('../actions');
      const result = await getMissionTrackStatus('msn_missing');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ── executeMultiTrackMissionAction: Zod, Auth, Preflight, IDOR ───────────

  describe('executeMultiTrackMissionAction', () => {
    const validInput = {
      missionId: 'msn_multi_1',
      topic: 'Autonomous AI Growth in SEA',
      estimatedScenes: 5,
      durationSeconds: 60,
      aspectRatio: '9:16' as const,
      estimatedCostCents: 150,
    };

    it('rejects unauthenticated caller with NOT_AUTHENTICATED', async () => {
      mocks.getCurrentUser.mockResolvedValue(null);

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_AUTHENTICATED');
      }
    });

    it('rejects invalid schema with VALIDATION_ERROR', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction({
        missionId: '',
        durationSeconds: 9999, // Exceeds max allowable duration (180s)
      } as unknown as Parameters<typeof executeMultiTrackMissionAction>[0]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns NOT_FOUND when mission does not exist in D1', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(makeD1([null]));

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('fails with FORBIDDEN when user lacks workspace access (IDOR)', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([
          { workspace_id: 'ws_forbidden', creator_id: 'other_user', status: 'draft' },
          null, // workspace membership lookup returns null
        ])
      );

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
        expect(result.error.message).toContain('workspace');
      }
    });

    it('fails with FORBIDDEN when user is a workspace member but neither creator nor admin', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([
          { workspace_id: 'ws_1', creator_id: 'other_user', status: 'draft' },
          { role: 'MEMBER' }, // membership check passes
          { role: 'MEMBER' }, // ADMIN role check fails (insufficient role)
        ])
      );

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
        expect(result.error.message).toContain('permission');
      }
    });

    it('fails with EXECUTION_START_INVALID when mission status is running or terminal', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([
          { workspace_id: 'ws_1', creator_id: 'user_1', status: 'running' },
          1, // membership check passes
        ])
      );

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EXECUTION_START_INVALID');
      }
    });

    it('fails closed when runMissionPreflightCheck fails due to MCU quota or capabilities', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([
          { workspace_id: 'ws_1', creator_id: 'user_1', status: 'draft' },
          1, // membership check passes
        ])
      );
      mocks.runMissionPreflightCheck.mockResolvedValue({
        passed: false,
        failureCode: 'INSUFFICIENT_ENTITLEMENT',
        failureReason: 'Insufficient MCU balance (0 remaining)',
        gates: {},
      });

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction(validInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INSUFFICIENT_ENTITLEMENT');
        expect(result.error.message).toBe('Insufficient MCU balance (0 remaining)');
      }
      expect(mocks.runMissionPreflightCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_1',
          workspaceId: 'ws_1',
          requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
          estimatedCostCents: 150,
          overrides: { membershipVerified: true },
        })
      );
    });

    it('executes successfully when caller is creator, status is startable, and preflight passes', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([
          { workspace_id: 'ws_1', creator_id: 'user_1', status: 'draft' },
          1, // membership check passes
        ])
      );
      mocks.runMissionPreflightCheck.mockResolvedValue({ passed: true, gates: {} });

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction(validInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('review');
        expect(result.value.currentPhase).toBe('review');
      }
      expect(mocks.executeMultiTrackMission).toHaveBeenCalledWith(
        'msn_multi_1',
        expect.objectContaining({
          userId: 'user_1',
          workspaceId: 'ws_1',
          topic: 'Autonomous AI Growth in SEA',
          estimatedScenes: 5,
          durationSeconds: 60,
          aspectRatio: '9:16',
        })
      );
    });

    it('executes successfully when caller is not creator but has workspace ADMIN role', async () => {
      mocks.getCurrentUser.mockResolvedValue(USER);
      mocks.getD1.mockReturnValue(
        makeD1([
          { workspace_id: 'ws_1', creator_id: 'other_user', status: 'planned' },
          { role: 'ADMIN' }, // membership check
          { role: 'ADMIN' }, // role check
        ])
      );
      mocks.runMissionPreflightCheck.mockResolvedValue({ passed: true, gates: {} });

      const { executeMultiTrackMissionAction } = await import('../actions');
      const result = await executeMultiTrackMissionAction(validInput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('review');
      }
    });
  });
});
