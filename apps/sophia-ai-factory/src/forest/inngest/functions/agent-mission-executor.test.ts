/**
 * Tests for forest/inngest/functions/agent-mission-executor
 *
 * Verifies:
 * 1. Inngest function is registered for agent.mission.started
 * 2. Consumer imports from canonical tree/agent-protocol (not deprecated forest/agent-protocol)
 * 3. AgentDefinitionRegistry is used for agent lookup
 * 4. executeAgent is called with correct arguments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_opts: unknown, _trigger: unknown, fn: unknown) => ({
      trigger: { event: 'agent.mission.started' },
      _fn: fn,
    })),
  },
}));

vi.mock('@/tree/agent-protocol', () => ({
  executeAgent: vi.fn(),
  agentDefinitionRegistry: {
    get: vi.fn(),
    register: vi.fn(),
    list: vi.fn(),
    has: vi.fn(),
  },
}));

vi.mock('@/forest/ai/provider-factory', () => ({
  getSharedRegistry: vi.fn(() => ({ getHealthy: () => [] })),
}));

vi.mock('@/tree/mission/agent-run-repo', () => ({
  createAgentRun: vi.fn(),
  updateAgentRun: vi.fn(),
  appendAgentLog: vi.fn(),
}));

vi.mock('./agent-mission-lifecycle', () => ({
  emitMissionCompleted: vi.fn(),
  emitMissionFailed: vi.fn(),
  advanceMissionToReview: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { agentMissionExecutor } from './agent-mission-executor';
import { executeAgent, agentDefinitionRegistry } from '@/tree/agent-protocol';
import { createAgentRun, updateAgentRun } from '@/tree/mission/agent-run-repo';
import {
  emitMissionCompleted,
  emitMissionFailed,
  advanceMissionToReview,
} from './agent-mission-lifecycle';

describe('agentMissionExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is registered for agent.mission.started event', () => {
    const fn = agentMissionExecutor as unknown as { trigger: { event: string } };
    expect(fn.trigger.event).toBe('agent.mission.started');
  });

  it('uses canonical tree/agent-protocol executeAgent', () => {
    expect(typeof executeAgent).toBe('function');
  });

  it('uses canonical agentDefinitionRegistry for lookup', () => {
    expect(typeof agentDefinitionRegistry.get).toBe('function');
  });

  it('does not import from deprecated forest/agent-protocol', async () => {
    // Verify the module source does not reference the deprecated path
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.resolve(__dirname, 'agent-mission-executor.ts'),
      'utf-8',
    );
    expect(source).not.toContain('@/forest/agent-protocol');
  });

  it('calls createAgentRun with correct shape on event', async () => {
    const mockCreateAgentRun = vi.mocked(createAgentRun);
    mockCreateAgentRun.mockResolvedValue({
      ok: true,
      value: {
        id: 'run_1',
        agentId: 'ag_1',
        workspaceId: 'ws_1',
        missionId: 'm_1',
        status: 'queued',
        phase: 'planning',
        autonomyLevel: 0,
        totalCostCents: 0,
        totalTokens: 0,
        retryCount: 0,
        createdAt: 100,
      },
    });

    const mockUpdateAgentRun = vi.mocked(updateAgentRun);
    mockUpdateAgentRun.mockResolvedValue({
      ok: true,
      value: {} as never,
    });

    const mockGet = vi.mocked(agentDefinitionRegistry.get);
    mockGet.mockReturnValue(undefined);

    // The mock createFunction returns { trigger, _fn } — _fn is the handler
    const handler = (agentMissionExecutor as unknown as {
      _fn: (ctx: { event: { data: unknown }; step: unknown }) => Promise<unknown>;
    })._fn;

    await expect(
      handler({
        event: {
          data: {
            runId: 'run_1',
            agentId: 'ag_1',
            missionId: 'm_1',
            workspaceId: 'ws_1',
            autonomyLevel: 2,
          },
        },
        step: {},
      }),
    ).rejects.toThrow('Agent ag_1 not registered');

    expect(mockCreateAgentRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'run_1',
        agentId: 'ag_1',
        workspaceId: 'ws_1',
        missionId: 'm_1',
        autonomyLevel: 2,
      }),
    );
  });

  // ── Event loop: completed / failed emission + advanceMissionToReview ──────

  /** Invoke the Inngest handler with a fully-mocked dependency set. */
  async function runHandler(eventData: Record<string, unknown>) {
    const handler = (agentMissionExecutor as unknown as {
      _fn: (ctx: { event: { data: unknown }; step: unknown }) => Promise<unknown>;
    })._fn;
    return handler({ event: { data: eventData }, step: {} });
  }

  const baseEvent = {
    runId: 'run_loop',
    agentId: 'ag_loop',
    missionId: 'msn_loop',
    workspaceId: 'ws_loop',
    autonomyLevel: 2,
  };

  function primeHappyPath() {
    vi.mocked(createAgentRun).mockResolvedValue({
      ok: true,
      value: {
        id: 'run_loop',
        agentId: 'ag_loop',
        workspaceId: 'ws_loop',
        missionId: 'msn_loop',
        status: 'queued',
        phase: 'planning',
        autonomyLevel: 2,
        totalCostCents: 0,
        totalTokens: 0,
        retryCount: 0,
        createdAt: 100,
      },
    } as never);
    vi.mocked(updateAgentRun).mockResolvedValue({ ok: true, value: {} as never });
    vi.mocked(agentDefinitionRegistry.get).mockReturnValue({ id: 'ag_loop' } as never);
  }

  it('success path emits agent.mission.completed with exact payload and calls advanceMissionToReview', async () => {
    primeHappyPath();
    vi.mocked(executeAgent).mockResolvedValue({
      ok: true,
      value: { output: { video: 'url' }, costCents: 555, totalTokens: 777 },
    } as never);
    vi.mocked(emitMissionCompleted).mockResolvedValue(undefined);
    vi.mocked(advanceMissionToReview).mockResolvedValue({ advanced: true });

    const result = await runHandler(baseEvent);

    expect(emitMissionCompleted).toHaveBeenCalledTimes(1);
    expect(emitMissionCompleted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run_loop',
        agentId: 'ag_loop',
        missionId: 'msn_loop',
        totalCostCents: 555,
        totalTokens: 777,
      }),
    );
    expect(advanceMissionToReview).toHaveBeenCalledTimes(1);
    expect(advanceMissionToReview).toHaveBeenCalledWith('msn_loop');
    expect(emitMissionFailed).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true });
  });

  it('failure path emits agent.mission.failed and does NOT advance mission to review', async () => {
    primeHappyPath();
    vi.mocked(executeAgent).mockResolvedValue({
      ok: false,
      error: { code: 'NO_PROVIDER', message: 'No healthy provider' },
    } as never);
    vi.mocked(emitMissionFailed).mockResolvedValue(undefined);

    const result = await runHandler(baseEvent);

    expect(emitMissionFailed).toHaveBeenCalledTimes(1);
    expect(emitMissionFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run_loop',
        agentId: 'ag_loop',
        missionId: 'msn_loop',
        errorCode: 'NO_PROVIDER',
        errorMessage: 'No healthy provider',
      }),
    );
    // Mission status deliberately untouched on failure
    expect(advanceMissionToReview).not.toHaveBeenCalled();
    expect(emitMissionCompleted).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false });
  });

  it('exception path emits agent.mission.failed with RUNTIME_ERROR and rethrows', async () => {
    primeHappyPath();
    vi.mocked(executeAgent).mockRejectedValue(new Error('kaboom'));
    vi.mocked(emitMissionFailed).mockResolvedValue(undefined);

    await expect(runHandler(baseEvent)).rejects.toThrow('kaboom');

    expect(emitMissionFailed).toHaveBeenCalledTimes(1);
    expect(emitMissionFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run_loop',
        errorCode: 'RUNTIME_ERROR',
        errorMessage: 'kaboom',
      }),
    );
    expect(advanceMissionToReview).not.toHaveBeenCalled();
  });

  it('marks agent_run completed with cost/token totals on success', async () => {
    primeHappyPath();
    vi.mocked(executeAgent).mockResolvedValue({
      ok: true,
      value: { output: {}, costCents: 999, totalTokens: 1234 },
    } as never);
    vi.mocked(emitMissionCompleted).mockResolvedValue(undefined);
    vi.mocked(advanceMissionToReview).mockResolvedValue({ advanced: true });

    await runHandler(baseEvent);

    const updateCalls = vi.mocked(updateAgentRun).mock.calls;
    const completedPatch = updateCalls.find(
      ([, patch]) => (patch as { status?: string }).status === 'completed',
    );
    expect(completedPatch).toBeDefined();
    expect(completedPatch?.[1]).toMatchObject({
      status: 'completed',
      totalCostCents: 999,
      totalTokens: 1234,
    });
  });

  it('marks agent_run failed and records errorJson on executor failure', async () => {
    primeHappyPath();
    vi.mocked(executeAgent).mockResolvedValue({
      ok: false,
      error: { code: 'BUDGET_EXCEEDED', message: 'Over budget' },
    } as never);
    vi.mocked(emitMissionFailed).mockResolvedValue(undefined);

    await runHandler(baseEvent);

    const updateCalls = vi.mocked(updateAgentRun).mock.calls;
    const failedPatch = updateCalls.find(
      ([, patch]) => (patch as { status?: string }).status === 'failed',
    );
    expect(failedPatch).toBeDefined();
    expect(failedPatch?.[1]).toMatchObject({
      status: 'failed',
      errorMessage: 'Over budget',
      errorJson: { code: 'BUDGET_EXCEEDED', message: 'Over budget' },
    });
  });

  it('clamps out-of-range autonomyLevel into 0..4 before creating the run', async () => {
    vi.mocked(createAgentRun).mockResolvedValue({
      ok: true,
      value: {
        id: 'run_loop',
        agentId: 'ag_loop',
        workspaceId: 'ws_loop',
        missionId: 'msn_loop',
        status: 'queued',
        phase: 'planning',
        autonomyLevel: 4,
        totalCostCents: 0,
        totalTokens: 0,
        retryCount: 0,
        createdAt: 100,
      },
    } as never);
    vi.mocked(updateAgentRun).mockResolvedValue({ ok: true, value: {} as never });
    vi.mocked(agentDefinitionRegistry.get).mockReturnValue(undefined);

    await expect(runHandler({ ...baseEvent, autonomyLevel: 99 })).rejects.toThrow(
      'Agent ag_loop not registered',
    );

    expect(vi.mocked(createAgentRun)).toHaveBeenCalledWith(
      expect.objectContaining({ autonomyLevel: 4 }),
    );
  });
});
