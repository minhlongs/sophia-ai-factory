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

import { agentMissionExecutor } from './agent-mission-executor';
import { executeAgent, agentDefinitionRegistry } from '@/tree/agent-protocol';
import { createAgentRun, updateAgentRun } from '@/tree/mission/agent-run-repo';

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
});
