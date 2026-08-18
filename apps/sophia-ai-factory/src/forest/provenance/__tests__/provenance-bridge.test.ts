/**
 * Tests for forest/provenance/provenance-bridge
 */

import { describe, it, expect, vi } from 'vitest';

// Hoist mock refs used inside vi.mock factories
const {
  mockGetAgentRun,
  mockRecordProvenance,
  mockNewProvenanceId,
  mockRecordLearning,
} = vi.hoisted(() => {
  const mockGetAgentRun = vi.fn();
  const mockRecordProvenance = vi.fn();
  const mockNewProvenanceId = vi.fn().mockReturnValue('prov_newid123');
  const mockRecordLearning = vi.fn();
  return { mockGetAgentRun, mockRecordProvenance, mockNewProvenanceId, mockRecordLearning };
});

vi.mock('@/tree/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_opts: unknown, trigger: unknown, fn: unknown) => ({ trigger, fn })),
  },
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/tree/mission/agent-run-repo', () => ({
  getAgentRun: mockGetAgentRun,
}));

vi.mock('@/tree/provenance', () => ({
  recordProvenance: mockRecordProvenance,
  newProvenanceId: mockNewProvenanceId,
}));

vi.mock('@/tree/creative-memory', () => ({
  recordLearning: mockRecordLearning,
}));

import { provenanceBridge } from '../provenance-bridge';

beforeEach(() => {
  mockGetAgentRun.mockReset();
  mockRecordProvenance.mockReset();
  mockNewProvenanceId.mockReset();
  mockNewProvenanceId.mockReturnValue('prov_newid123');
  mockRecordLearning.mockReset();
});

function makeStep() {
  return {
    run: (_name: string, fn: () => Promise<unknown> | unknown) => Promise.resolve(fn()),
  };
}

async function invokeBridge(data: {
  runId: string;
  agentId: string;
  missionId: string;
  totalCostCents: number;
  totalTokens: number;
}) {
  const bridge = provenanceBridge as unknown as {
    trigger: { event: string };
    fn: (opts: {
      event: { data: typeof data };
      step: ReturnType<typeof makeStep>;
    }) => Promise<unknown>;
  };
  expect(bridge.trigger.event).toBe('agent.mission.completed');
  return bridge.fn({ event: { data }, step: makeStep() });
}

describe('provenanceBridge', () => {
  it('is registered for agent.mission.completed event', async () => {
    // createFunction is stubbed to return the handler; the event is encoded
    // in the handler's closure. Verify by invoking with a completed event
    // and asserting the bridge reacts (skips on missing run).
    mockGetAgentRun.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'not found' },
    });
    const result = await invokeBridge({
      runId: 'run_1',
      agentId: 'agent_1',
      missionId: 'mission_1',
      totalCostCents: 100,
      totalTokens: 500,
    });
    expect(result).toEqual({
      skipped: true,
      reason: 'AGENT_RUN_NOT_FOUND',
      runId: 'run_1',
    });
  });

  it('skips when agent run not found', async () => {
    mockGetAgentRun.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'not found' },
    });
    const result = await invokeBridge({
      runId: 'run_1',
      agentId: 'agent_1',
      missionId: 'mission_1',
      totalCostCents: 100,
      totalTokens: 500,
    });
    expect(result).toEqual({
      skipped: true,
      reason: 'AGENT_RUN_NOT_FOUND',
      runId: 'run_1',
    });
    expect(mockRecordProvenance).not.toHaveBeenCalled();
  });

  it('records run-level provenance when no artifacts present', async () => {
    mockGetAgentRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: 'run_1',
        agentId: 'agent_1',
        workspaceId: 'ws_1',
        missionId: 'mission_1',
        status: 'completed',
        phase: 'completed',
        outputJson: {},
        totalCostCents: 100,
        totalTokens: 500,
      },
    });
    mockRecordProvenance.mockResolvedValueOnce({
      id: 'prov_newid123',
      workspaceId: 'ws_1',
      assetId: 'run_1',
      action: 'generated',
      actorType: 'agent',
      actorId: 'agent_1',
      metadata: {},
      createdAt: 0,
    });

    const result = await invokeBridge({
      runId: 'run_1',
      agentId: 'agent_1',
      missionId: 'mission_1',
      totalCostCents: 100,
      totalTokens: 500,
    });

    expect(mockRecordProvenance).toHaveBeenCalledTimes(1);
    const record = mockRecordProvenance.mock.calls[0][0];
    expect(record.assetId).toBe('run_1');
    expect(record.agentRunId).toBe('run_1');
    expect(record.actorType).toBe('agent');
    expect(record.actorId).toBe('agent_1');
    expect(record.metadata.missionId).toBe('mission_1');
    expect(mockRecordLearning).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      runId: 'run_1',
      workspaceId: 'ws_1',
      recordedCount: 1,
      provenanceRecordIds: ['prov_newid123'],
    });
  });

  it('records one provenance record per artifact', async () => {
    mockGetAgentRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: 'run_1',
        agentId: 'agent_1',
        workspaceId: 'ws_1',
        missionId: 'mission_1',
        status: 'completed',
        phase: 'completed',
        outputJson: {
          assets: [
            { assetId: 'asset_a', type: 'video', action: 'generated', model: 'openai/gpt-4o' },
            { assetId: 'asset_b', type: 'script', action: 'derived', sourceAssetId: 'asset_a' },
          ],
        },
        totalCostCents: 100,
        totalTokens: 500,
      },
    });
    mockRecordProvenance.mockResolvedValue({});
    mockNewProvenanceId.mockReturnValueOnce('prov_a').mockReturnValueOnce('prov_b');

    const result = await invokeBridge({
      runId: 'run_1',
      agentId: 'agent_1',
      missionId: 'mission_1',
      totalCostCents: 100,
      totalTokens: 500,
    });

    expect(mockRecordProvenance).toHaveBeenCalledTimes(2);
    expect(mockRecordProvenance.mock.calls[0][0].assetId).toBe('asset_a');
    expect(mockRecordProvenance.mock.calls[0][0].model).toBe('openai/gpt-4o');
    expect(mockRecordProvenance.mock.calls[1][0].assetId).toBe('asset_b');
    expect(mockRecordProvenance.mock.calls[1][0].sourceAssetId).toBe('asset_a');
    expect(result).toEqual({
      success: true,
      runId: 'run_1',
      workspaceId: 'ws_1',
      recordedCount: 2,
      provenanceRecordIds: ['prov_a', 'prov_b'],
    });
  });

  it('skips artifacts missing an id', async () => {
    mockGetAgentRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: 'run_1',
        agentId: 'agent_1',
        workspaceId: 'ws_1',
        missionId: 'mission_1',
        status: 'completed',
        phase: 'completed',
        outputJson: {
          assets: [{ type: 'video' }, { assetId: 'asset_a', type: 'script' }],
        },
        totalCostCents: 100,
        totalTokens: 500,
      },
    });
    mockRecordProvenance.mockResolvedValue({});
    mockNewProvenanceId.mockReturnValueOnce('prov_a');

    const result = await invokeBridge({
      runId: 'run_1',
      agentId: 'agent_1',
      missionId: 'mission_1',
      totalCostCents: 100,
      totalTokens: 500,
    });

    expect(mockRecordProvenance).toHaveBeenCalledTimes(1);
    expect(mockRecordProvenance.mock.calls[0][0].assetId).toBe('asset_a');
    expect(result).toEqual({
      success: true,
      runId: 'run_1',
      workspaceId: 'ws_1',
      recordedCount: 1,
      provenanceRecordIds: ['prov_a'],
    });
  });

  it('continues when a single artifact record fails', async () => {
    mockGetAgentRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: 'run_1',
        agentId: 'agent_1',
        workspaceId: 'ws_1',
        missionId: 'mission_1',
        status: 'completed',
        phase: 'completed',
        outputJson: {
          assets: [
            { assetId: 'asset_a', type: 'script' },
            { assetId: 'asset_b', type: 'video' },
          ],
        },
        totalCostCents: 100,
        totalTokens: 500,
      },
    });
    mockRecordProvenance.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({});
    mockNewProvenanceId.mockReturnValueOnce('prov_a').mockReturnValueOnce('prov_b');

    const result = await invokeBridge({
      runId: 'run_1',
      agentId: 'agent_1',
      missionId: 'mission_1',
      totalCostCents: 100,
      totalTokens: 500,
    });

    expect(mockRecordProvenance).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      success: true,
      runId: 'run_1',
      workspaceId: 'ws_1',
      recordedCount: 1,
      provenanceRecordIds: ['prov_b'],
    });
  });

  it('records learning entry non-fatally even when memory fails', async () => {
    mockGetAgentRun.mockResolvedValueOnce({
      ok: true,
      value: {
        id: 'run_1',
        agentId: 'agent_1',
        workspaceId: 'ws_1',
        missionId: 'mission_1',
        status: 'completed',
        phase: 'completed',
        outputJson: {},
        totalCostCents: 100,
        totalTokens: 500,
      },
    });
    mockRecordProvenance.mockResolvedValueOnce({});
    mockRecordLearning.mockRejectedValueOnce(new Error('memory down'));

    const result = await invokeBridge({
      runId: 'run_1',
      agentId: 'agent_1',
      missionId: 'mission_1',
      totalCostCents: 100,
      totalTokens: 500,
    });

    expect(result).toEqual({
      success: true,
      runId: 'run_1',
      workspaceId: 'ws_1',
      recordedCount: 1,
      provenanceRecordIds: ['prov_newid123'],
    });
  });
});