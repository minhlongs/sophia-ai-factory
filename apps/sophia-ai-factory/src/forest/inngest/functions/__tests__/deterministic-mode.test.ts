/**
 * Deterministic Mode — production-graph-runner tests.
 *
 * Verifies the runner honors `deterministic: true` in the started event:
 * node timestamps and performance-event `recordedAt` derive from the fixed
 * injected time source (not wall-clock Date.now()), so two runs over the
 * same graph produce byte-identical checkpoints and performance payloads.
 * Also verifies non-deterministic mode keeps using the real clock.
 *
 * Same harness as production-graph-runner.test.ts: the handler is captured
 * from a mocked inngest.createFunction and driven with mocked collaborators.
 *
 * @module forest/inngest/functions/__tests__/deterministic-mode
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
  persistAgentLearning: vi.fn(),
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
  persistAgentLearning: (...args: unknown[]) => mocks.persistAgentLearning(...args),
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
  deterministic?: boolean;
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

/** Shape of one serialized node state written via setNodeStates. */
interface PersistedNodeState {
  nodeId: string;
  status: string;
  agentRunId?: string;
  startedAt?: number;
  endedAt?: number;
  outputJson?: string;
  errorMessage?: string;
}

function getHandler(): RunnerHandler {
  return (productionGraphRunner as unknown as { _handler: RunnerHandler })._handler;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NODE_A: GraphNodeDefinition = { id: 'a', agentSlug: 'sophia-researcher' };
const NODE_B: GraphNodeDefinition = { id: 'b', agentSlug: 'sophia-editor' };

const AGENT_DEFS = new Map<string, { id: string }>([
  ['sophia-researcher', { id: 'sophia-researcher' }],
  ['sophia-editor', { id: 'sophia-editor' }],
]);

function makeEvent(overrides: Partial<StartedData> = {}): StartedData {
  return {
    graphRunId: 'run_det',
    graphId: 'graph_det',
    missionId: 'mission_det',
    workspaceId: 'ws_det',
    missionType: 'article-factory',
    retryCount: 0,
    ...overrides,
  };
}

function makeRunRow(overrides: Partial<ProductionGraphRun> = {}): ProductionGraphRun {
  return {
    id: 'run_det',
    graphId: 'graph_det',
    missionId: 'mission_det',
    workspaceId: 'ws_det',
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
    id: 'graph_det',
    workspaceId: 'ws_det',
    missionType: 'article-factory',
    slug: 'article-factory',
    name: 'Article Factory',
    definition: { nodes: [NODE_A, NODE_B], edges: [{ from: 'a', to: 'b' }] },
    isTemplate: true,
    createdAt: 1_750_000_000_000,
    updatedAt: 1_750_000_000_000,
    ...overrides,
  };
}

function makeMission(overrides: Partial<MissionType> = {}): MissionType {
  return {
    id: 'mission_det',
    workspaceId: 'ws_det',
    creatorId: 'user_det',
    title: 'Deterministic Mission',
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

function twoNodeValidated(): ValidatedValue {
  return {
    definition: { nodes: [NODE_A, NODE_B], edges: [{ from: 'a', to: 'b' }] },
    sinkIds: ['b'],
    topologicalOrder: ['a', 'b'],
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

/** Wire all collaborators for a successful two-node deterministic run. */
function setupSuccess(): void {
  mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow() });
  mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
  mocks.getMission.mockResolvedValue(makeMission());
  mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: twoNodeValidated() });
  mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess(10, 50) });
}

/** Extract the persisted node-state checkpoints captured by setNodeStates. */
function capturedNodeStates(): PersistedNodeState[][] {
  return mocks.setNodeStates.mock.calls.map(
    (call) => (call[1] as unknown as PersistedNodeState[]),
  );
}

/** Extract recordedAt values from recordPerformanceEvent calls. */
function capturedRecordedAt(): number[] {
  return mocks.recordPerformanceEvent.mock.calls.map(
    (call) => (call[0] as { recordedAt: number }).recordedAt,
  );
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
  mocks.persistAgentLearning.mockResolvedValue(undefined);
  mocks.recordSpend.mockResolvedValue(undefined);
  mocks.newPerformanceEventId.mockReturnValue('perf_det');
  mocks.recordPerformanceEvent.mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('productionGraphRunner — deterministic mode', () => {
  it('stamps node timestamps from the fixed clock when deterministic=true', async () => {
    setupSuccess();
    const { step } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: true, totalCostCents: 20, totalTokens: 100 });

    // Every checkpoint's startedAt/endedAt must equal the fixed timestamp
    // (1_700_000_000_000) — the injectable time source, not Date.now().
    const checkpoints = capturedNodeStates();
    expect(checkpoints).toHaveLength(2); // one per completed node
    const finalStates = checkpoints[1];
    for (const nodeState of finalStates) {
      expect(nodeState.startedAt).toBe(1_700_000_000_000);
      expect(nodeState.endedAt).toBe(1_700_000_000_000);
    }
  });

  it('records performance events with the fixed recordedAt when deterministic=true', async () => {
    setupSuccess();
    const { step } = makeStep();

    await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    const recordedAtValues = capturedRecordedAt();
    expect(recordedAtValues).toHaveLength(2);
    for (const recordedAt of recordedAtValues) {
      expect(recordedAt).toBe(1_700_000_000_000);
    }
  });

  it('produces identical checkpoints across two runs of the same graph when deterministic=true', async () => {
    // Run 1.
    setupSuccess();
    const stepOne = makeStep();
    await getHandler()({ event: { data: makeEvent({ deterministic: true, graphRunId: 'run_a' }) }, step: stepOne.step });
    const runOneStates = capturedNodeStates();

    // Run 2 (fresh mocks, same graph).
    vi.clearAllMocks();
    setupSuccess();
    const stepTwo = makeStep();
    await getHandler()({ event: { data: makeEvent({ deterministic: true, graphRunId: 'run_b' }) }, step: stepTwo.step });
    const runTwoStates = capturedNodeStates();

    // The serialized node states must be identical EXCEPT for agentRunId,
    // which is derived from the run-scoped graphRunId (run_a vs run_b).
    // Strip agentRunId from every persisted state before comparing.
    const stripAgentRunId = (states: PersistedNodeState[][]): PersistedNodeState[][] =>
      states.map((batch) => batch.map((s) => ({ ...s, agentRunId: undefined })));
    expect(stripAgentRunId(runOneStates)).toEqual(stripAgentRunId(runTwoStates));
  });

  it('uses the real clock (changing timestamps) when deterministic is absent', async () => {
    setupSuccess();
    const { step } = makeStep();
    const before = Date.now();

    await getHandler()({ event: { data: makeEvent() }, step });

    const recordedAtValues = capturedRecordedAt();
    expect(recordedAtValues).toHaveLength(2);
    for (const recordedAt of recordedAtValues) {
      expect(recordedAt).toBeGreaterThanOrEqual(before);
      expect(recordedAt).toBeLessThanOrEqual(Date.now());
    }
  });

  it('still completes the run and emits completed in deterministic mode', async () => {
    setupSuccess();
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: true, totalCostCents: 20, totalTokens: 100 });
    expect(mocks.completeRun).toHaveBeenCalledTimes(1);
    const completed = sentEvents.find((e) => e.id === 'emit-completed');
    expect(completed?.payload.name).toBe('production.graph.completed');
    expect(sentEvents.find((e) => e.id === 'emit-failed')).toBeUndefined();
  });
});
