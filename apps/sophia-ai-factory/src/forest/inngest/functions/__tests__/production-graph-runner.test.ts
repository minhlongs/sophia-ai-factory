/**
 * Production Graph Runner — Inngest function tests.
 *
 * Drives the exported handler (captured from a mocked inngest.createFunction)
 * against mocked collaborators. Heavy dependencies (DB repo, executor, provider
 * factory, autonomy resolver, approval gate, mission repo, performance) are all
 * mocked so the tests isolate the runner's orchestration logic: load/validate,
 * guarded status flips, node execution in topological order, resume-skip,
 * approval gating, budget guard, and terminal success/failure emission.
 *
 * @module forest/inngest/functions/__tests__/production-graph-runner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GraphDefinition,
  GraphNodeDefinition,
  ProductionGraph,
  ProductionGraphRun,
} from '@/seed/types/production-factory';
import type { Mission as MissionType } from '@/seed/types/creative-economy';

const mocks = vi.hoisted(() => ({
  executeAgent: vi.fn(),
  registryList: vi.fn(),
  registryGet: vi.fn(),
  buildProviders: vi.fn(),
  getMission: vi.fn(),
  recordSpend: vi.fn(),
  newPerformanceEventId: vi.fn(),
  recordPerformanceEvent: vi.fn(),
  resolveEffectiveAutonomy: vi.fn(),
  getGraphById: vi.fn(),
  getRun: vi.fn(),
  updateRunStatus: vi.fn(),
  setNodeStates: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  validateGraphDefinition: vi.fn(),
  toAutonomyLevel: vi.fn(),
  initAgentRun: vi.fn(),
  loadWorkspaceIdentity: vi.fn(),
  loadMissionMemories: vi.fn(),
  advanceMissionToReview: vi.fn(),
  requestApprovalAndAwait: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_cfg: unknown, _trigger: unknown, handler: unknown) => ({
      _handler: handler,
    })),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));

vi.mock('@/tree/agent-protocol', () => ({
  executeAgent: (...args: unknown[]) => mocks.executeAgent(...args),
  agentDefinitionRegistry: {
    list: (...args: unknown[]) => mocks.registryList(...args),
    get: (...args: unknown[]) => mocks.registryGet(...args),
  },
}));

vi.mock('@/tree/agent-protocol/graph-agents', () => ({
  PUBLISH_CONTENT_TOOL: 'publish_content',
}));

vi.mock('@/forest/ai/provider-factory', () => ({
  buildProviders: (...args: unknown[]) => mocks.buildProviders(...args),
}));

vi.mock('@/tree/mission/repository', () => ({
  getMission: (...args: unknown[]) => mocks.getMission(...args),
  recordSpend: (...args: unknown[]) => mocks.recordSpend(...args),
}));

vi.mock('@/tree/performance', () => ({
  newPerformanceEventId: (...args: unknown[]) => mocks.newPerformanceEventId(...args),
  recordPerformanceEvent: (...args: unknown[]) => mocks.recordPerformanceEvent(...args),
}));

vi.mock('@/tree/autonomy/effective-autonomy', () => ({
  resolveEffectiveAutonomy: (...args: unknown[]) => mocks.resolveEffectiveAutonomy(...args),
}));

vi.mock('@/tree/production-graph/repo', () => ({
  getGraphById: (...args: unknown[]) => mocks.getGraphById(...args),
  getRun: (...args: unknown[]) => mocks.getRun(...args),
  updateRunStatus: (...args: unknown[]) => mocks.updateRunStatus(...args),
  setNodeStates: (...args: unknown[]) => mocks.setNodeStates(...args),
  completeRun: (...args: unknown[]) => mocks.completeRun(...args),
  failRun: (...args: unknown[]) => mocks.failRun(...args),
}));

vi.mock('@/tree/production-graph/validate', () => ({
  validateGraphDefinition: (...args: unknown[]) => mocks.validateGraphDefinition(...args),
}));

vi.mock('../agent-context', () => ({
  toAutonomyLevel: (...args: unknown[]) => mocks.toAutonomyLevel(...args),
  initAgentRun: (...args: unknown[]) => mocks.initAgentRun(...args),
  loadWorkspaceIdentity: (...args: unknown[]) => mocks.loadWorkspaceIdentity(...args),
  loadMissionMemories: (...args: unknown[]) => mocks.loadMissionMemories(...args),
}));

vi.mock('../agent-mission-lifecycle', () => ({
  advanceMissionToReview: (...args: unknown[]) => mocks.advanceMissionToReview(...args),
}));

vi.mock('../agent-approval-gate', () => ({
  requestApprovalAndAwait: (...args: unknown[]) => mocks.requestApprovalAndAwait(...args),
}));

const { productionGraphRunner } = await import('../production-graph-runner');

// ─── Local types (no `any`) ───────────────────────────────────────────────────

interface StartedData {
  graphRunId: string;
  graphId: string;
  missionId: string;
  workspaceId: string;
  missionType: string;
  retryCount: number;
}

interface SentEvent {
  id: string;
  payload: { name: string; data: Record<string, unknown> };
}

interface FakeStep {
  run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  sendEvent: (id: string, payload: { name: string; data: Record<string, unknown> }) => Promise<void>;
}

type RunnerOutcome =
  | { ok: false; code: string }
  | { ok: true; totalCostCents: number; totalTokens: number };

type RunnerHandler = (args: {
  event: { data: StartedData };
  step: FakeStep;
}) => Promise<RunnerOutcome>;

interface ExecValue {
  success: boolean;
  output?: unknown;
  error?: { code: string; message: string };
  artifacts: string[];
  costCents: number;
  durationMs: number;
  totalTokens: number;
}

interface EffectivePolicy {
  tier: 0 | 1 | 2 | 3;
  storedLevel: 0 | 1 | 2 | 3 | 4;
  requiresApproval: (actionType: string) => boolean;
  budgetCapCents: number | null;
  maxAutoRetries: number;
}

interface ValidatedValue {
  definition: GraphDefinition;
  sinkIds: string[];
  topologicalOrder: string[];
}

function getHandler(): RunnerHandler {
  return (productionGraphRunner as unknown as { _handler: RunnerHandler })._handler;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NODE_A: GraphNodeDefinition = { id: 'a', agentSlug: 'sophia-researcher' };
const NODE_B: GraphNodeDefinition = { id: 'b', agentSlug: 'sophia-editor' };
const NODE_C: GraphNodeDefinition = { id: 'c', agentSlug: 'sophia-editor', isPublishNode: true };

const AGENT_DEFS = new Map<string, { id: string }>([
  ['sophia-researcher', { id: 'sophia-researcher' }],
  ['sophia-editor', { id: 'sophia-editor' }],
  ['sophia-strategist', { id: 'sophia-strategist' }],
]);

function makeEvent(overrides: Partial<StartedData> = {}): StartedData {
  return {
    graphRunId: 'run_1',
    graphId: 'graph_1',
    missionId: 'mission_1',
    workspaceId: 'ws_1',
    missionType: 'article-factory',
    retryCount: 0,
    ...overrides,
  };
}

function makeRunRow(overrides: Partial<ProductionGraphRun> = {}): ProductionGraphRun {
  return {
    id: 'run_1',
    graphId: 'graph_1',
    missionId: 'mission_1',
    workspaceId: 'ws_1',
    status: 'queued',
    phase: 'planning',
    nodeStates: null,
    outputJson: null,
    errorJson: null,
    errorMessage: null,
    totalCostCents: 0,
    totalTokens: 0,
    retryCount: 0,
    createdAt: 1_750_000_000_000,
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}

function makeGraph(overrides: Partial<ProductionGraph> = {}): ProductionGraph {
  return {
    id: 'graph_1',
    workspaceId: 'ws_1',
    missionType: 'article-factory',
    slug: 'article-factory',
    name: 'Article Factory',
    definition: { nodes: [NODE_A, NODE_B, NODE_C], edges: [] },
    isTemplate: true,
    createdAt: 1_750_000_000_000,
    updatedAt: 1_750_000_000_000,
    ...overrides,
  };
}

function makeMission(overrides: Partial<MissionType> = {}): MissionType {
  return {
    id: 'mission_1',
    workspaceId: 'ws_1',
    creatorId: 'user_1',
    title: 'Test Mission',
    objective: 'test',
    audience: 'test',
    geography: 'global',
    timeframeStart: 0,
    timeframeEnd: 0,
    budgetCents: 10_000,
    spentCents: 0,
    autonomyLevel: 4,
    channels: [],
    monetizationGoals: [],
    constraints: {},
    successMetrics: {},
    status: 'running',
    currentPhase: 'executing',
    createdAt: 1_750_000_000_000,
    updatedAt: 1_750_000_000_000,
    ...overrides,
  };
}

function makeExecSuccess(costCents: number, totalTokens: number, output: unknown = { ok: true }): ExecValue {
  return { success: true, output, artifacts: [], costCents, durationMs: 10, totalTokens };
}

function fullAutoPolicy(): EffectivePolicy {
  return { tier: 3, storedLevel: 4, requiresApproval: () => false, budgetCapCents: null, maxAutoRetries: 3 };
}

function gatedPolicy(): EffectivePolicy {
  return {
    tier: 2,
    storedLevel: 3,
    requiresApproval: (actionType: string) => actionType === 'publish_content',
    budgetCapCents: null,
    maxAutoRetries: 3,
  };
}

function threeNodeValidated(): ValidatedValue {
  return {
    definition: {
      nodes: [NODE_A, NODE_B, NODE_C],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    },
    sinkIds: ['c'],
    topologicalOrder: ['a', 'b', 'c'],
  };
}

function singlePublishNodeValidated(): ValidatedValue {
  return {
    definition: { nodes: [NODE_C], edges: [] },
    sinkIds: ['c'],
    topologicalOrder: ['c'],
  };
}

function makeStep(): { step: FakeStep; sentEvents: SentEvent[]; runIds: string[] } {
  const sentEvents: SentEvent[] = [];
  const runIds: string[] = [];
  const step: FakeStep = {
    run: async (id, fn) => {
      runIds.push(id);
      return fn();
    },
    sendEvent: async (id, payload) => {
      sentEvents.push({ id, payload });
    },
  };
  return { step, sentEvents, runIds };
}

/** Wire all collaborators for a successful three-node run (no approval gate). */
function setupThreeNodeSuccess(): void {
  mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow() });
  mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
  mocks.getMission.mockResolvedValue(makeMission());
  mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: threeNodeValidated() });
  mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.registryGet.mockImplementation((id: string) => AGENT_DEFS.get(id));
  mocks.registryList.mockImplementation(() => Array.from(AGENT_DEFS.values()));
  mocks.buildProviders.mockResolvedValue({ providers: new Map(), registry: {} });
  mocks.resolveEffectiveAutonomy.mockResolvedValue(fullAutoPolicy());
  mocks.updateRunStatus.mockResolvedValue({ ok: true, value: { flipped: true } });
  mocks.setNodeStates.mockResolvedValue({ ok: true, value: undefined });
  mocks.completeRun.mockResolvedValue({ ok: true, value: { flipped: true } });
  mocks.failRun.mockResolvedValue({ ok: true, value: { flipped: true } });
  mocks.initAgentRun.mockResolvedValue({ id: 'agent-run-1' });
  mocks.loadWorkspaceIdentity.mockResolvedValue(null);
  mocks.loadMissionMemories.mockResolvedValue([]);
  mocks.toAutonomyLevel.mockImplementation((level: number) => level);
  mocks.advanceMissionToReview.mockResolvedValue({ advanced: true });
  mocks.recordSpend.mockResolvedValue(undefined);
  mocks.newPerformanceEventId.mockReturnValue('perf_1');
  mocks.recordPerformanceEvent.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('productionGraphRunner — load failures', () => {
  it('emits RUN_NOT_FOUND when the run row is missing (no terminal write)', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: null });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'RUN_NOT_FOUND' });
    expect(mocks.failRun).not.toHaveBeenCalled();
    const failed = sentEvents.find((e) => e.id === 'emit-failed');
    expect(failed?.payload.name).toBe('production.graph.failed');
    expect(failed?.payload.data.errorCode).toBe('RUN_NOT_FOUND');
  });

  it('emits RUN_NOT_FOUND when the run read itself fails', async () => {
    mocks.getRun.mockResolvedValue({ ok: false, error: { code: 'DB_ERROR', message: 'down' } });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'RUN_NOT_FOUND' });
    expect(sentEvents.find((e) => e.id === 'emit-failed')?.payload.data.errorCode).toBe('RUN_NOT_FOUND');
  });

  it('fails terminally with GRAPH_NOT_FOUND when the graph is missing', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow() });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: null });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'GRAPH_NOT_FOUND' });
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    expect(sentEvents.find((e) => e.id === 'emit-failed')?.payload.data.errorCode).toBe('GRAPH_NOT_FOUND');
  });

  it('fails terminally with MISSION_NOT_FOUND when the mission is missing', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow() });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(null);
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'MISSION_NOT_FOUND' });
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    expect(sentEvents.find((e) => e.id === 'emit-failed')?.payload.data.errorCode).toBe('MISSION_NOT_FOUND');
  });

  it('fails terminally with INVALID_GRAPH when validation rejects the definition', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow() });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({
      ok: false,
      error: { code: 'CYCLE_DETECTED', message: 'cycle found' },
    });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'INVALID_GRAPH' });
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    const failError = mocks.failRun.mock.calls[0]?.[2] as { code: string; details?: { validationCode?: string } };
    expect(failError.code).toBe('INVALID_GRAPH');
    expect(failError.details?.validationCode).toBe('CYCLE_DETECTED');
    expect(sentEvents.find((e) => e.id === 'emit-failed')?.payload.data.errorCode).toBe('INVALID_GRAPH');
  });
});

describe('productionGraphRunner — happy path', () => {
  it('executes all nodes in order, completes the run, and emits completed', async () => {
    setupThreeNodeSuccess();
    const { step, sentEvents, runIds } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: true, totalCostCents: 30, totalTokens: 150 });
    expect(mocks.executeAgent).toHaveBeenCalledTimes(3);
    expect(mocks.completeRun).toHaveBeenCalledTimes(1);
    expect(mocks.advanceMissionToReview).toHaveBeenCalledWith('mission_1');
    // queued → running flip happened via a step.
    expect(runIds).toContain('flip-to-running');
    expect(runIds).toContain('complete-run');

    const completed = sentEvents.find((e) => e.id === 'emit-completed');
    expect(completed?.payload.name).toBe('production.graph.completed');
    expect(completed?.payload.data).toMatchObject({
      graphRunId: 'run_1',
      graphId: 'graph_1',
      missionId: 'mission_1',
      workspaceId: 'ws_1',
      totalCostCents: 30,
      totalTokens: 150,
    });
    expect(sentEvents.find((e) => e.id === 'emit-failed')).toBeUndefined();
  });

  it('records spend and a performance event per successful node with cost', async () => {
    setupThreeNodeSuccess();
    const { step } = makeStep();

    await getHandler()({ event: { data: makeEvent() }, step });

    expect(mocks.recordSpend).toHaveBeenCalledTimes(3);
    expect(mocks.recordSpend).toHaveBeenCalledWith('mission_1', 10);
    expect(mocks.recordPerformanceEvent).toHaveBeenCalledTimes(3);
  });

  it('skips already-completed nodes on resume', async () => {
    setupThreeNodeSuccess();
    mocks.getRun.mockResolvedValue({
      ok: true,
      value: makeRunRow({
        nodeStates: [{ nodeId: 'a', status: 'completed', outputJson: '{"done":true}' }],
        totalCostCents: 10,
        totalTokens: 50,
      }),
    });
    const { step } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent({ retryCount: 1 }) }, step });

    // Node 'a' is skipped; only 'b' and 'c' execute.
    expect(mocks.executeAgent).toHaveBeenCalledTimes(2);
    // Starting totals (10/50) plus two more nodes (10/50 each).
    expect(result).toEqual({ ok: true, totalCostCents: 30, totalTokens: 150 });
  });
});

describe('productionGraphRunner — node failure', () => {
  it('fails with NODE_FAILED when the executor returns a failure Result', async () => {
    setupThreeNodeSuccess();
    mocks.executeAgent.mockResolvedValue({
      ok: false,
      error: { code: 'PROVIDER_ERROR', message: 'provider blew up' },
    });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'NODE_FAILED' });
    // Fails on the first node; no further execution.
    expect(mocks.executeAgent).toHaveBeenCalledTimes(1);
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    const failError = mocks.failRun.mock.calls[0]?.[2] as { code: string; message?: string };
    expect(failError.code).toBe('NODE_FAILED');
    expect(failError.message).toContain('PROVIDER_ERROR');
    expect(sentEvents.find((e) => e.id === 'emit-failed')?.payload.data.errorCode).toBe('NODE_FAILED');
    expect(mocks.completeRun).not.toHaveBeenCalled();
  });

  it('fails with NODE_FAILED when the agent returns success=false and still accrues cost', async () => {
    setupThreeNodeSuccess();
    mocks.executeAgent.mockResolvedValue({
      ok: true,
      value: {
        success: false,
        error: { code: 'AUTONOMY_DENIED', message: 'denied' },
        artifacts: [],
        costCents: 5,
        durationMs: 1,
        totalTokens: 2,
      },
    });
    const { step } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'NODE_FAILED' });
    // Cost from the failed-but-ok execution is persisted in the terminal write.
    const totals = mocks.failRun.mock.calls[0]?.[3] as { totalCostCents: number; totalTokens: number };
    expect(totals.totalCostCents).toBe(5);
    expect(totals.totalTokens).toBe(2);
  });
});

describe('productionGraphRunner — budget guard', () => {
  it('fails with BUDGET_EXCEEDED before executing when the budget is exhausted', async () => {
    setupThreeNodeSuccess();
    mocks.getMission.mockResolvedValue(makeMission({ budgetCents: 100, spentCents: 100 }));
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'BUDGET_EXCEEDED' });
    // Budget guard fires before any agent execution.
    expect(mocks.executeAgent).not.toHaveBeenCalled();
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    expect(sentEvents.find((e) => e.id === 'emit-failed')?.payload.data.errorCode).toBe('BUDGET_EXCEEDED');
  });
});

describe('productionGraphRunner — approval gate', () => {
  it('pauses on a gated publish node and fails with APPROVAL_REJECTED when rejected', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow({ status: 'running' }) });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: singlePublishNodeValidated() });
    mocks.resolveEffectiveAutonomy.mockResolvedValue(gatedPolicy());
    mocks.requestApprovalAndAwait.mockResolvedValue({ outcome: 'rejected', reviewerId: 'rev_1' });
    const { step, sentEvents, runIds } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'APPROVAL_REJECTED' });
    expect(mocks.requestApprovalAndAwait).toHaveBeenCalledTimes(1);
    // Flipped to awaiting_approval before the gate.
    expect(runIds).toContain('set-awaiting-c');
    expect(mocks.updateRunStatus).toHaveBeenCalledWith('run_1', 'running', 'awaiting_approval', 'publishing');
    expect(mocks.executeAgent).not.toHaveBeenCalled();
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    expect(sentEvents.find((e) => e.id === 'emit-failed')?.payload.data.errorCode).toBe('APPROVAL_REJECTED');
  });

  it('fails with APPROVAL_TIMEOUT when the gate times out', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow({ status: 'running' }) });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: singlePublishNodeValidated() });
    mocks.resolveEffectiveAutonomy.mockResolvedValue(gatedPolicy());
    mocks.requestApprovalAndAwait.mockResolvedValue({ outcome: 'timeout' });
    const { step } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'APPROVAL_TIMEOUT' });
    expect(mocks.executeAgent).not.toHaveBeenCalled();
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
  });

  it('proceeds to execute and complete after approval is granted', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow({ status: 'running' }) });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: singlePublishNodeValidated() });
    mocks.resolveEffectiveAutonomy.mockResolvedValue(gatedPolicy());
    mocks.requestApprovalAndAwait.mockResolvedValue({
      outcome: 'approved',
      approvedActionIds: ['publish_content'],
      reviewerId: 'rev_1',
    });
    mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
    const { step, runIds } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: true, totalCostCents: 10, totalTokens: 50 });
    expect(mocks.executeAgent).toHaveBeenCalledTimes(1);
    // Approved publish node receives the publish token.
    const context = mocks.executeAgent.mock.calls[0]?.[1] as { approvedActionIds?: string[] };
    expect(context.approvedActionIds).toEqual(['publish_content']);
    // Flipped to awaiting then back to running.
    expect(runIds).toContain('set-awaiting-c');
    expect(runIds).toContain('resume-running-c');
    expect(mocks.completeRun).toHaveBeenCalledTimes(1);
  });

  it('treats a skipped approval gate as approved and executes', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow({ status: 'running' }) });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: singlePublishNodeValidated() });
    mocks.resolveEffectiveAutonomy.mockResolvedValue(gatedPolicy());
    mocks.requestApprovalAndAwait.mockResolvedValue({ outcome: 'skipped', reason: 'run_not_running' });
    mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
    const { step } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: true, totalCostCents: 10, totalTokens: 50 });
    expect(mocks.executeAgent).toHaveBeenCalledTimes(1);
  });

  it('grants the publish token without a gate when policy does not require approval', async () => {
    setupThreeNodeSuccess(); // full-auto policy: requiresApproval always false
    const { step } = makeStep();

    await getHandler()({ event: { data: makeEvent() }, step });

    // No approval gate for full-auto publish node.
    expect(mocks.requestApprovalAndAwait).not.toHaveBeenCalled();
    // The publish node (c) still receives the token via the non-gated branch.
    const publishCall = mocks.executeAgent.mock.calls[2]?.[1] as { approvedActionIds?: string[] };
    expect(publishCall.approvedActionIds).toEqual(['publish_content']);
    // Non-publish nodes get no approved action ids.
    const firstCall = mocks.executeAgent.mock.calls[0]?.[1] as { approvedActionIds?: string[] };
    expect(firstCall.approvedActionIds).toBeUndefined();
  });
});
