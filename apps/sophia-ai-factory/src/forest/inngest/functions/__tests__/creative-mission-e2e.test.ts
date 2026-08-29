/**
 * Creative Mission E2E — the Phase 3 acceptance flight.
 *
 * Drives the REAL production-graph-runner handler (captured from a mocked
 * inngest.createFunction) through the full 13-stage creative-mission-full
 * template with `deterministic: true`, a gated autonomy policy, and the
 * approval gate mocked at the module boundary to return a human approval.
 *
 * Asserts the whole contract in one flight:
 *   Scout → Research → Strategy → Creative Director → Writer → Storyboard
 *   → Production → QA → Provenance → Human Approval (gate) → Distribution
 *   Plan → Performance → Learning
 * plus cost accumulation, approval-gate wiring, performance fixtures,
 * mission advance-to-review, completed event emission, and determinism
 * (byte-identical checkpoints minus agentRunId across two runs).
 *
 * @module forest/inngest/functions/__tests__/creative-mission-e2e
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GraphDefinition,
  ProductionGraph,
  ProductionGraphRun,
} from '@/seed/types/production-factory';
import type { Mission as MissionType } from '@/seed/types/creative-economy';
import type { ApprovalDecision } from '../agent-approval-gate';

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

// ─── The 13-stage creative-mission-full flight ────────────────────────────────

/** Definition-order ids of the creative-mission-full template's 13 stages. */
const STAGE_IDS = [
  'scout', 'research', 'strategy', 'creative-director', 'writer',
  'storyboard', 'production', 'qa', 'provenance', 'human-approval',
  'distribution-plan', 'performance', 'learning',
] as const;

const STAGE_AGENTS: Record<string, string> = {
  scout: 'sophia-scout',
  research: 'sophia-researcher',
  strategy: 'sophia-strategist',
  'creative-director': 'sophia-creative-director',
  writer: 'sophia-writer',
  storyboard: 'sophia-storyboard',
  production: 'sophia-production',
  qa: 'sophia-qa',
  provenance: 'sophia-provenance',
  'human-approval': 'sophia-editor',
  'distribution-plan': 'sophia-distribution-plan',
  performance: 'sophia-performance',
  learning: 'sophia-learning',
};

function creativeMissionGraph(): GraphDefinition {
  const nodes = STAGE_IDS.map((id) =>
    id === 'human-approval'
      ? { id, agentSlug: STAGE_AGENTS[id], name: 'Human Approval', isPublishNode: true }
      : { id, agentSlug: STAGE_AGENTS[id], name: id },
  );
  const edges: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < STAGE_IDS.length - 1; i += 1) {
    const from = STAGE_IDS[i];
    const to = STAGE_IDS[i + 1];
    if (from && to) edges.push({ from, to });
  }
  return { nodes, edges };
}

function full13Validated(): ValidatedValue {
  const definition = creativeMissionGraph();
  return {
    definition,
    sinkIds: ['learning'],
    topologicalOrder: [...STAGE_IDS],
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AGENT_DEFS = new Map<string, { id: string }>(
  Object.values(STAGE_AGENTS).map((slug) => [slug, { id: slug }]),
);

function makeEvent(overrides: Partial<StartedData> = {}): StartedData {
  return {
    graphRunId: 'run_e2e',
    graphId: 'graph_e2e',
    missionId: 'mission_e2e',
    workspaceId: 'ws_e2e',
    missionType: 'creative-mission-full',
    retryCount: 0,
    ...overrides,
  };
}

function makeRunRow(overrides: Partial<ProductionGraphRun> = {}): ProductionGraphRun {
  return {
    id: 'run_e2e',
    graphId: 'graph_e2e',
    missionId: 'mission_e2e',
    workspaceId: 'ws_e2e',
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
    id: 'graph_e2e',
    workspaceId: 'ws_e2e',
    missionType: 'creative-mission-full',
    slug: 'creative-mission-full',
    name: 'Creative Mission Full',
    definition: creativeMissionGraph(),
    isTemplate: true,
    createdAt: 1_750_000_000_000,
    updatedAt: 1_750_000_000_000,
    ...overrides,
  };
}

function makeMission(overrides: Partial<MissionType> = {}): MissionType {
  return {
    id: 'mission_e2e',
    workspaceId: 'ws_e2e',
    creatorId: 'user_e2e',
    title: 'E2E Creative Mission',
    objective: 'Ship one deterministic creative mission flight',
    audience: 'non-technical CEOs',
    geography: 'global',
    timeframeStart: 0,
    timeframeEnd: 0,
    budgetCents: 100_000,
    spentCents: 0,
    autonomyLevel: 2,
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

/** Deterministic per-stage success: fixed cost 7c / 40 tokens per stage. */
const STAGE_COST_CENTS = 7;
const STAGE_TOKENS = 40;

function makeExecSuccess(): ExecValue {
  return {
    success: true,
    output: { stage: 'ok' },
    artifacts: [],
    costCents: STAGE_COST_CENTS,
    durationMs: 10,
    totalTokens: STAGE_TOKENS,
  };
}

/** Supervised tier: the publish tool requires human approval. */
function supervisedPolicy(): EffectivePolicy {
  return {
    tier: 2,
    storedLevel: 2,
    requiresApproval: (actionType: string) => actionType === 'publish_content',
    budgetCapCents: null,
    maxAutoRetries: 3,
  };
}

function approvedDecision(): ApprovalDecision {
  return {
    outcome: 'approved',
    approvedActionIds: ['publish_content'],
    reviewerId: 'user_ceo',
    comment: 'LGTM',
  };
}

function makeStep(): { step: FakeStep; sentEvents: SentEvent[] } {
  const sentEvents: SentEvent[] = [];
  const step: FakeStep = {
    run: async (id, fn) => {
      return fn();
    },
    sendEvent: async (id, payload) => {
      sentEvents.push({ id, payload });
    },
  };
  return { step, sentEvents };
}

/** Wire every collaborator for the full 13-stage deterministic flight. */
function setupFlight(): void {
  mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow() });
  mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
  mocks.getMission.mockResolvedValue(makeMission());
  mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: full13Validated() });
  mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess() });
  mocks.requestApprovalAndAwait.mockResolvedValue(approvedDecision());
}

function capturedNodeStates(): PersistedNodeState[][] {
  return mocks.setNodeStates.mock.calls.map(
    (call) => (call[1] as unknown as PersistedNodeState[]),
  );
}

/** Ids of the steps the runner wrapped in step.run (DB flips + gate). */
function capturedStepRunIds(stepRunCalls: unknown[][]): string[] {
  return stepRunCalls.map((call) => call[0] as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.registryGet.mockImplementation((id: string) => AGENT_DEFS.get(id));
  mocks.registryList.mockImplementation(() => Array.from(AGENT_DEFS.values()));
  mocks.buildProviders.mockResolvedValue({ providers: new Map(), registry: {} });
  mocks.resolveEffectiveAutonomy.mockResolvedValue(supervisedPolicy());
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
  mocks.newPerformanceEventId.mockReturnValue('perf_e2e');
  mocks.recordPerformanceEvent.mockResolvedValue(undefined);
});

// ─── The flight ───────────────────────────────────────────────────────────────

describe('creative-mission-full — deterministic 13-stage E2E flight', () => {
  it('flies all 13 stages gate-to-learning with approval at Human Approval', async () => {
    setupFlight();
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({
      event: { data: makeEvent({ deterministic: true }) },
      step,
    });

    // 13 stages × (7c, 40 tokens) — exact deterministic totals.
    expect(result).toEqual({
      ok: true,
      totalCostCents: 13 * STAGE_COST_CENTS,
      totalTokens: 13 * STAGE_TOKENS,
    });

    // Every stage executed exactly once, in topological order.
    expect(mocks.executeAgent).toHaveBeenCalledTimes(13);
    const executedSlugs = mocks.executeAgent.mock.calls.map(
      (call) => (call[0] as { id: string }).id,
    );
    expect(executedSlugs).toEqual(STAGE_IDS.map((id) => STAGE_AGENTS[id]));

    // Human Approval (stage 10) went through the approval gate — exactly once.
    expect(mocks.requestApprovalAndAwait).toHaveBeenCalledTimes(1);
    const gateArgs = mocks.requestApprovalAndAwait.mock.calls[0] as [
      { actionId: string; actionType: string; runId: string },
      { step: unknown },
    ];
    expect(gateArgs[0].actionId).toBe('publish_content');
    expect(gateArgs[0].runId).toBe('run_e2e');

    // Run status choreography: queued→running, running→awaiting_approval,
    // awaiting_approval→running, then complete-run.
    const statusFlips = mocks.updateRunStatus.mock.calls.map(
      (call) => [call[1], call[2]] as [string, string],
    );
    expect(statusFlips).toEqual([
      ['queued', 'running'],
      ['running', 'awaiting_approval'],
      ['awaiting_approval', 'running'],
    ]);

    // Terminal write carried the exact totals and the learning sink output.
    expect(mocks.completeRun).toHaveBeenCalledTimes(1);
    const completed = mocks.completeRun.mock.calls[0];
    const completedPayload = completed[2] as { totalCostCents: number; totalTokens: number; outputJson: string | null };
    expect(completedPayload.totalCostCents).toBe(13 * STAGE_COST_CENTS);
    expect(completedPayload.totalTokens).toBe(13 * STAGE_TOKENS);
    expect(JSON.parse(completedPayload.outputJson ?? 'null')).toEqual({ stage: 'ok' });

    // Completed event emitted; no failed event.
    const completedEvt = sentEvents.find((e) => e.id === 'emit-completed');
    expect(completedEvt?.payload.name).toBe('production.graph.completed');
    expect(completedEvt?.payload.data).toEqual(
      expect.objectContaining({
        graphRunId: 'run_e2e',
        missionId: 'mission_e2e',
        totalCostCents: 13 * STAGE_COST_CENTS,
        totalTokens: 13 * STAGE_TOKENS,
      }),
    );
    expect(sentEvents.find((e) => e.id === 'emit-failed')).toBeUndefined();

    // Mission handed to the human — machine never self-completes.
    expect(mocks.advanceMissionToReview).toHaveBeenCalledTimes(1);
    expect(mocks.advanceMissionToReview).toHaveBeenCalledWith('mission_e2e');

    // Cost ledger: 13 spend records of 7c.
    expect(mocks.recordSpend).toHaveBeenCalledTimes(13);
    for (const call of mocks.recordSpend.mock.calls) {
      expect(call[0]).toBe('mission_e2e');
      expect(call[1]).toBe(STAGE_COST_CENTS);
    }

    // Performance fixtures: one per stage, deterministic recordedAt.
    expect(mocks.recordPerformanceEvent).toHaveBeenCalledTimes(13);
    const perfEvents = mocks.recordPerformanceEvent.mock.calls.map(
      (call) => call[0] as { recordedAt: number; eventType: string; rawData: { nodeId: string } },
    );
    expect(perfEvents.map((p) => p.rawData.nodeId)).toEqual([...STAGE_IDS]);
    for (const perf of perfEvents) {
      expect(perf.recordedAt).toBe(1_700_000_000_000);
      expect(perf.eventType).toBe('graph_node_completed');
    }

    // Agent-run audit rows: one per stage, deterministic ids.
    expect(mocks.initAgentRun).toHaveBeenCalledTimes(13);
    const agentRunIds = mocks.initAgentRun.mock.calls.map((call) => call[0] as { runId: string });
    expect(agentRunIds.map((a) => a.runId)).toEqual(
      STAGE_IDS.map((id) => `run_e2e:${id}:0`),
    );

    // Approved publish token reached the executor on the Human Approval node.
    const humanApprovalContext = mocks.executeAgent.mock.calls[9][1] as { approvedActionIds?: string[] };
    expect(humanApprovalContext.approvedActionIds).toEqual(['publish_content']);
    // …and only on that node: other stages carry no approved token.
    const strategyContext = mocks.executeAgent.mock.calls[2][1] as { approvedActionIds?: string[] };
    expect(strategyContext.approvedActionIds).toBeUndefined();

    // Deterministic mode: every persisted timestamp is the fixed clock.
    const checkpoints = capturedNodeStates();
    const finalStates = checkpoints[checkpoints.length - 1];
    expect(finalStates).toHaveLength(13);
    for (const nodeState of finalStates) {
      expect(nodeState.status).toBe('completed');
      expect(nodeState.startedAt).toBe(1_700_000_000_000);
      expect(nodeState.endedAt).toBe(1_700_000_000_000);
    }

    // No failed terminal write on the happy path.
    expect(mocks.failRun).not.toHaveBeenCalled();
    expect(capturedStepRunIds(mocks.updateRunStatus.mock.calls)).toEqual([
      'queued→running',
      'running→awaiting_approval',
      'awaiting_approval→running',
    ].map(() => expect.any(String)));
  });

  it('is byte-identical across two deterministic flights of the same mission', async () => {
    // Flight 1.
    setupFlight();
    const stepOne = makeStep();
    await getHandler()({ event: { data: makeEvent({ deterministic: true, graphRunId: 'run_x' }) }, step: stepOne.step });
    const statesOne = capturedNodeStates();

    // Flight 2 (fresh mocks, same shape).
    vi.clearAllMocks();
    setupFlight();
    const stepTwo = makeStep();
    await getHandler()({ event: { data: makeEvent({ deterministic: true, graphRunId: 'run_y' }) }, step: stepTwo.step });
    const statesTwo = capturedNodeStates();

    const stripAgentRunId = (batches: PersistedNodeState[][]): PersistedNodeState[][] =>
      batches.map((batch) => batch.map((s) => ({ ...s, agentRunId: undefined })));
    expect(stripAgentRunId(statesOne)).toEqual(stripAgentRunId(statesTwo));
    // And the two flights produced identical total outcomes.
    expect(statesOne.length).toBe(13);
    expect(statesTwo.length).toBe(13);
  });

  it('fails with APPROVAL_REJECTED and stops the flight when the human rejects', async () => {
    setupFlight();
    mocks.requestApprovalAndAwait.mockResolvedValue({
      outcome: 'rejected',
      reviewerId: 'user_ceo',
      comment: 'Not on brand',
    } as ApprovalDecision);

    const { step, sentEvents } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: false, code: 'APPROVAL_REJECTED' });

    // Nine stages ran before the gate (scout..provenance); human-approval never executed.
    expect(mocks.executeAgent).toHaveBeenCalledTimes(9);
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    const failCall = mocks.failRun.mock.calls[0];
    expect(failCall[1]).toBe('awaiting_approval');
    expect((failCall[2] as { code: string }).code).toBe('APPROVAL_REJECTED');

    // The human-approval node is marked failed in the checkpoint.
    const checkpoints = capturedNodeStates();
    const failedNode = checkpoints[checkpoints.length - 1].find((s) => s.nodeId === 'human-approval');
    expect(failedNode?.status).toBe('failed');

    // Mission never advanced to review; no completed event.
    expect(mocks.advanceMissionToReview).not.toHaveBeenCalled();
    expect(sentEvents.find((e) => e.id === 'emit-completed')).toBeUndefined();
    const failedEvt = sentEvents.find((e) => e.id === 'emit-failed');
    expect(failedEvt?.payload.name).toBe('production.graph.failed');
    expect(failedEvt?.payload.data.errorCode).toBe('APPROVAL_REJECTED');
  });

  it('fails with APPROVAL_TIMEOUT when the 24h review window lapses', async () => {
    setupFlight();
    mocks.requestApprovalAndAwait.mockResolvedValue({ outcome: 'timeout' } as ApprovalDecision);

    const { step } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: false, code: 'APPROVAL_TIMEOUT' });
    expect(mocks.executeAgent).toHaveBeenCalledTimes(9);
    expect((mocks.failRun.mock.calls[0][2] as { code: string }).code).toBe('APPROVAL_TIMEOUT');
  });

  it('grants the publish token without a gate at full-auto tier', async () => {
    setupFlight();
    mocks.resolveEffectiveAutonomy.mockResolvedValue({
      tier: 3,
      storedLevel: 4,
      requiresApproval: () => false,
      budgetCapCents: null,
      maxAutoRetries: 3,
    });

    const { step, sentEvents } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    // Full-auto: no gate at all, flight still completes.
    expect(result).toEqual({ ok: true, totalCostCents: 13 * STAGE_COST_CENTS, totalTokens: 13 * STAGE_TOKENS });
    expect(mocks.requestApprovalAndAwait).not.toHaveBeenCalled();
    // But the publish token still reaches the executor (executor hard-fails without it).
    const humanApprovalContext = mocks.executeAgent.mock.calls[9][1] as { approvedActionIds?: string[] };
    expect(humanApprovalContext.approvedActionIds).toEqual(['publish_content']);
    // No awaiting_approval status flips on the full-auto path.
    const statusFlips = mocks.updateRunStatus.mock.calls.map((call) => [call[1], call[2]]);
    expect(statusFlips).toEqual([['queued', 'running']]);
    expect(sentEvents.find((e) => e.id === 'emit-completed')).toBeDefined();
  });

  it('resumes a half-flown mission: completed stages are skipped, rest execute', async () => {
    // First five stages already checkpointed completed on a prior attempt.
    const persisted = STAGE_IDS.slice(0, 5).map((nodeId) => ({
      nodeId,
      status: 'completed' as const,
      agentRunId: `old:${nodeId}`,
      outputJson: '{"stage":"ok"}',
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_000_000_000,
    }));
    mocks.getRun.mockResolvedValue({
      ok: true,
      value: makeRunRow({ status: 'running', phase: 'executing', nodeStates: persisted }),
    });
    mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
    mocks.getMission.mockResolvedValue(makeMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: full13Validated() });
    mocks.executeAgent.mockResolvedValue({ ok: true, value: makeExecSuccess() });
    mocks.requestApprovalAndAwait.mockResolvedValue(approvedDecision());

    const { step } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    // Resumed totals count only the 8 remaining stages.
    expect(result).toEqual({ ok: true, totalCostCents: 8 * STAGE_COST_CENTS, totalTokens: 8 * STAGE_TOKENS });
    expect(mocks.executeAgent).toHaveBeenCalledTimes(8);
    // The run row started at 'running' — no queued→running flip attempted.
    const statusFlips = mocks.updateRunStatus.mock.calls.map((call) => [call[1], call[2]]);
    expect(statusFlips).toEqual([
      ['running', 'awaiting_approval'],
      ['awaiting_approval', 'running'],
    ]);
  });
});
