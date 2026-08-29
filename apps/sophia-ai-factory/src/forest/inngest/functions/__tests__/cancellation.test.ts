/**
 * Cancellation — production-graph-runner tests.
 *
 * Verifies the runner observes a `cancelled` run status at node boundaries and
 * emits `production.graph.cancelled` instead of continuing execution.
 * The cancellation is triggered by an external PATCH to
 * /api/production-graph-runs/[id] (which flips the row via the guarded UPDATE
 * cancelProductionGraphRun helper). The runner poll-checks by re-reading the
 * run via getRun and short-circuits the loop.
 *
 * @module forest/inngest/functions/__tests__/cancellation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GraphDefinition,
  GraphNodeDefinition,
  ProductionGraph,
  ProductionGraphRun,
  ProductionGraphRunStatus,
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
  /**
   * getRun is implemented per-test to drive cancellation: returns a normal
   * run for the first N reads, then a 'cancelled' run to trigger the boundary
   * check. The sequence counter is reset in beforeEach.
   */
  getRun: vi.fn(),
  updateRunStatus: vi.fn(),
  setNodeStates: vi.fn(),
  completeRun: vi.fn(),
  failRun: vi.fn(),
  cancelProductionGraphRun: vi.fn(),
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
  cancelProductionGraphRun: (...args: unknown[]) => mocks.cancelProductionGraphRun(...args),
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

interface CancelledEvent {
  id: string;
  payload: { name: string; data: Record<string, unknown> };
}

interface CancelStep {
  run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  sendEvent: (id: string, payload: { name: string; data: Record<string, unknown> }) => Promise<void>;
}

type RunnerOutcome =
  | { ok: false; code: string }
  | { ok: true; totalCostCents: number; totalTokens: number };

type RunnerHandler = (args: {
  event: { data: StartedData };
  step: CancelStep;
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

/** Cancellation reason embedded in the cancelled-run row's error_json. */
const CANCEL_REASON = 'Stopped by operator via API';

function getHandler(): RunnerHandler {
  return (productionGraphRunner as unknown as { _handler: RunnerHandler })._handler;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NODE_A: GraphNodeDefinition = { id: 'a', agentSlug: 'sophia-researcher' };
const NODE_B: GraphNodeDefinition = { id: 'b', agentSlug: 'sophia-editor' };
const NODE_C: GraphNodeDefinition = { id: 'c', agentSlug: 'sophia-editor' };

const AGENT_DEFS = new Map<string, { id: string }>([
  ['sophia-researcher', { id: 'sophia-researcher' }],
  ['sophia-editor', { id: 'sophia-editor' }],
  ['sophia-strategist', { id: 'sophia-strategist' }],
]);

function makeEvent(overrides: Partial<StartedData> = {}): StartedData {
  return {
    graphRunId: 'run_cancel',
    graphId: 'graph_cancel',
    missionId: 'mission_cancel',
    workspaceId: 'ws_cancel',
    missionType: 'article-factory',
    retryCount: 0,
    ...overrides,
  };
}

function liveRun(overrides: Partial<ProductionGraphRun> = {}): ProductionGraphRun {
  return {
    id: 'run_cancel',
    graphId: 'graph_cancel',
    missionId: 'mission_cancel',
    workspaceId: 'ws_cancel',
    status: 'running',
    phase: 'executing',
    nodeStates: null,
    outputJson: null,
    errorJson: null,
    errorMessage: null,
    totalCostCents: 0,
    totalTokens: 0,
    retryCount: 0,
    createdAt: 1_750_000_000_000,
    startedAt: 1_750_000_000_001,
    endedAt: null,
    ...overrides,
  };
}

function cancelledRun(overrides: Partial<ProductionGraphRun> = {}): ProductionGraphRun {
  return {
    ...liveRun({
      status: 'cancelled',
      phase: 'executing',
      errorJson: JSON.stringify({ code: 'CANCELLED', message: CANCEL_REASON, details: { cancelledAt: 1_700_000_000_000 } }),
      endedAt: 1_700_000_000_005,
    }),
    ...overrides,
  };
}

function makeGraph(overrides: Partial<ProductionGraph> = {}): ProductionGraph {
  return {
    id: 'graph_cancel',
    workspaceId: 'ws_cancel',
    missionType: 'article-factory',
    slug: 'article-factory',
    name: 'Article Factory',
    definition: { nodes: [NODE_A, NODE_B, NODE_C], edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ] },
    isTemplate: true,
    createdAt: 1_750_000_000_000,
    updatedAt: 1_750_000_000_000,
    ...overrides,
  };
}

function makeMission(overrides: Partial<MissionType> = {}): MissionType {
  return {
    id: 'mission_cancel',
    workspaceId: 'ws_cancel',
    creatorId: 'user_cancel',
    title: 'Cancel Mission',
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

function makeExecSuccess(costCents: number, totalTokens: number): ExecValue {
  return {
    success: true,
    output: { ok: true },
    artifacts: [],
    costCents,
    durationMs: 10,
    totalTokens,
  };
}

function fullAutoPolicy(): EffectivePolicy {
  return { tier: 3, storedLevel: 4, requiresApproval: () => false, budgetCapCents: null, maxAutoRetries: 3 };
}

function threeNodeValidated(): ValidatedValue {
  return {
    definition: { nodes: [NODE_A, NODE_B, NODE_C], edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ] },
    sinkIds: ['c'],
    topologicalOrder: ['a', 'b', 'c'],
  };
}

function makeStep(): { step: CancelStep; sentEvents: CancelledEvent[] } {
  const sentEvents: CancelledEvent[] = [];
  const step: CancelStep = {
    run: async (_id, fn) => fn(),
    sendEvent: async (id, payload) => {
      sentEvents.push({ id, payload });
    },
  };
  return { step, sentEvents };
}

/**
 * Build a getRun mock that returns the `live` row for the first `liveReads`
 * invocations, then returns `cancelled` forever after. Read sequence for a
 * 3-node graph: 1 load + 1 boundary check per node (3) + 1 final check = 5.
 * So liveReads=2 cancels at the boundary before node b, liveReads=3 before
 * node c, liveReads=4 at the final post-loop check, liveReads>=5 never.
 */
function makeCancellableGetRun(
  live: ProductionGraphRun,
  cancelled: ProductionGraphRun,
  liveReads: number,
): () => Promise<{ ok: true; value: ProductionGraphRun }> {
  let count = 0;
  return () => {
    count += 1;
    return Promise.resolve({ ok: true as const, value: count <= liveReads ? live : cancelled });
  };
}

/** Wire the happy-path collaborators (no cancellation). */
function setupLive(): void {
  mocks.getRun.mockResolvedValue({ ok: true, value: liveRun() });
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
  mocks.cancelProductionGraphRun.mockResolvedValue({ ok: true, value: { flipped: true } });
  mocks.initAgentRun.mockResolvedValue({ id: 'agent-run-cancel' });
  mocks.loadWorkspaceIdentity.mockResolvedValue(null);
  mocks.loadMissionMemories.mockResolvedValue([]);
  mocks.toAutonomyLevel.mockImplementation((level: number) => level);
  mocks.advanceMissionToReview.mockResolvedValue({ advanced: true });
  mocks.recordSpend.mockResolvedValue(undefined);
  mocks.newPerformanceEventId.mockReturnValue('perf_cancel');
  mocks.recordPerformanceEvent.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('productionGraphRunner — cancellation', () => {
  it('aborts before the first node when the run is already cancelled at load', async () => {
    mocks.getRun.mockResolvedValue({ ok: true, value: cancelledRun() });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: threeNodeValidated() });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'CANCELLED' });
    // No agent execution, no status flips beyond load, no completion.
    expect(mocks.executeAgent).not.toHaveBeenCalled();
    expect(mocks.completeRun).not.toHaveBeenCalled();
    expect(mocks.failRun).not.toHaveBeenCalled();

    const cancelled = sentEvents.find((e) => e.id === 'emit-cancelled');
    expect(cancelled?.payload.name).toBe('production.graph.cancelled');
    expect(cancelled?.payload.data).toMatchObject({
      graphRunId: 'run_cancel',
      graphId: 'graph_cancel',
      missionId: 'mission_cancel',
      workspaceId: 'ws_cancel',
    });
    expect(cancelled?.payload.data.reason).toBe(CANCEL_REASON);
    // cancelledAt is stamped by the handler at emit time (real clock).
    expect(typeof cancelled?.payload.data.cancelledAt).toBe('number');
    expect(sentEvents.find((e) => e.id === 'emit-completed')).toBeUndefined();
    expect(sentEvents.find((e) => e.id === 'emit-failed')).toBeUndefined();
  });

  it('aborts at the second node boundary when the run is cancelled after the first node', async () => {
    // Read sequence: 1 load + boundary before node a (live) → node a executes;
    // boundary before node b (read 3) sees cancelled → nodes b, c never start.
    mocks.getRun.mockImplementation(makeCancellableGetRun(liveRun(), cancelledRun(), 2));
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: threeNodeValidated() });
    mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'CANCELLED' });
    // Node a ran (cost accrued), nodes b and c did not.
    expect(mocks.executeAgent).toHaveBeenCalledTimes(1);
    expect(mocks.completeRun).not.toHaveBeenCalled();
    expect(mocks.failRun).not.toHaveBeenCalled();

    const cancelled = sentEvents.find((e) => e.id === 'emit-cancelled');
    expect(cancelled?.payload.name).toBe('production.graph.cancelled');
    expect(cancelled?.payload.data.reason).toBe(CANCEL_REASON);
    // No failed/completed events emitted.
    expect(sentEvents.find((e) => e.id === 'emit-failed')).toBeUndefined();
    expect(sentEvents.find((e) => e.id === 'emit-completed')).toBeUndefined();
  });

  it('aborts at the third node boundary when cancelled after two nodes', async () => {
    // Read sequence: load + boundary-a + boundary-b live (reads 1-3) → nodes
    // a, b execute; boundary before node c (read 4) sees cancelled → c never starts.
    mocks.getRun.mockImplementation(makeCancellableGetRun(liveRun(), cancelledRun(), 3));
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: threeNodeValidated() });
    mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    expect(result).toEqual({ ok: false, code: 'CANCELLED' });
    // Nodes a and b ran; c did not.
    expect(mocks.executeAgent).toHaveBeenCalledTimes(2);
    expect(mocks.completeRun).not.toHaveBeenCalled();
    expect(sentEvents.find((e) => e.id === 'emit-cancelled')?.payload.name).toBe('production.graph.cancelled');
  });

  it('aborts at the final post-loop check when all nodes complete but cancel flips during them', async () => {
    // Reads 1-4 live (load + boundaries before a, b, c) → all 3 nodes execute;
    // the final post-loop check (read 5) sees cancelled → CANCELLED, not completed.
    let count = 0;
    mocks.getRun.mockImplementation(() => {
      count += 1;
      return Promise.resolve({ ok: true, value: count <= 4 ? liveRun() : cancelledRun() });
    });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: threeNodeValidated() });
    mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    // All nodes ran.
    expect(mocks.executeAgent).toHaveBeenCalledTimes(3);
    // The final check observed cancelled, so it short-circuits before completeRun.
    expect(mocks.completeRun).not.toHaveBeenCalled();
    expect(sentEvents.find((e) => e.id === 'emit-cancelled')?.payload.name).toBe('production.graph.cancelled');
    expect(sentEvents.find((e) => e.id === 'emit-completed')).toBeUndefined();
  });

  it('treats a DB read failure during cancellation check as "not cancelled" (fail-open)', async () => {
    // Load read (read 1) returns a live row; every subsequent checkCancellation
    // read returns ok:false (DB error). checkCancellation treats a failed read
    // as not-cancelled to avoid false positives that would silently kill live
    // runs. The run proceeds to completion.
    let count = 0;
    mocks.getRun.mockImplementation(() => {
      count += 1;
      return Promise.resolve(count === 1
        ? { ok: true, value: liveRun() }
        : { ok: false, error: { code: 'DB_ERROR', message: 'down' } });
    });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: threeNodeValidated() });
    mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    // Run proceeds to completion despite the DB error during checks.
    expect(result).toEqual({ ok: true, totalCostCents: 30, totalTokens: 150 });
    expect(mocks.completeRun).toHaveBeenCalledTimes(1);
    expect(sentEvents.find((e) => e.id === 'emit-completed')?.payload.name).toBe('production.graph.completed');
    expect(sentEvents.find((e) => e.id === 'emit-cancelled')).toBeUndefined();
  });

  it('does not treat terminal non-cancelled statuses (completed/failed) as cancelled', async () => {
    setupLive();
    mocks.getRun.mockResolvedValue({ ok: true, value: liveRun({ status: 'completed' as ProductionGraphRunStatus }) });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: threeNodeValidated() });
    mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent() }, step });

    // completed is not cancelled — the run finishes normally.
    expect(result).toEqual({ ok: true, totalCostCents: 30, totalTokens: 150 });
    expect(sentEvents.find((e) => e.id === 'emit-cancelled')).toBeUndefined();
    expect(sentEvents.find((e) => e.id === 'emit-completed')?.payload.name).toBe('production.graph.completed');
  });
});
