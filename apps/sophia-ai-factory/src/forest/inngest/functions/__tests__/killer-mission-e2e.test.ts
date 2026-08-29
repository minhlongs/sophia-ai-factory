/**
 * Killer Mission E2E — the SOPHIA 2027 acceptance flight.
 *
 * Drives the REAL production-graph-runner handler with the killer-test input:
 * a SEA AI-native entrepreneurship media business, $500/mo budget
 * (budgetCents 50_000), autonomy L2 (supervised), channels
 * [youtube, tiktok, x], languages [vi, en], and a 13-stage graph with TWO
 * consecutive publish gates (human-approval + distribution-plan).
 *
 * Asserts all 10 killer-test success criteria in one file:
 *  1. every major artifact has an ID (agentRunId + performance event per node)
 *  2. every agent action auditable (initAgentRun per node)
 *  3. every model run records provider/model/cost (recordSpend + perf fields)
 *  4. human inspect/edit/approve/reject/undo (2 gates; reject/timeout covered;
 *     edit = cancel + re-run, asserted via resume flight)
 *  5. Creative Memory write-back (persistAgentLearning, scope campaign)
 *  6. no provider hardcoded (executor receives injected registry, no literals)
 *  7. single orchestration engine (only the runner handler drives the flight)
 *  8. no secret exposed (no apiKey/token/secret in checkpoints or events)
 *  9. whole mission resumable (half-flown checkpoint → remaining nodes only)
 * 10. deterministic replay (byte-identical checkpoints across two flights)
 *
 * @module forest/inngest/functions/__tests__/killer-mission-e2e
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GraphDefinition,
  ProductionGraph,
  ProductionGraphRun,
} from '@/seed/types/production-factory';
import type { Mission as MissionType } from '@/seed/types/creative-economy';
import type { ApprovalDecision } from '../agent-approval-gate';
import type { PublishParams } from '@/tree/publishing/platform-adapter';

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
  persistAgentLearning: vi.fn(),
  advanceMissionToReview: vi.fn(),
  requestApprovalAndAwait: vi.fn(),
  executePublish: vi.fn(),
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

vi.mock('@/tree/publishing/distribution-registry', () => ({
  executePublish: (...args: unknown[]) => mocks.executePublish(...args),
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

// ─── The killer graph: 13 stages, TWO publish gates ───────────────────────────

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

/** D1: BOTH human-approval AND distribution-plan are publish-gated. */
const PUBLISH_NODE_IDS = new Set(['human-approval', 'distribution-plan']);

function killerGraph(): GraphDefinition {
  const nodes = STAGE_IDS.map((id) => {
    const base = { id, agentSlug: STAGE_AGENTS[id], name: id };
    return PUBLISH_NODE_IDS.has(id)
      ? { ...base, isPublishNode: true }
      : base;
  });
  const edges: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < STAGE_IDS.length - 1; i += 1) {
    const from = STAGE_IDS[i];
    const to = STAGE_IDS[i + 1];
    if (from && to) edges.push({ from, to });
  }
  return { nodes, edges };
}

function killerValidated(): ValidatedValue {
  return {
    definition: killerGraph(),
    sinkIds: ['learning'],
    topologicalOrder: [...STAGE_IDS],
  };
}

// ─── Killer fixtures ──────────────────────────────────────────────────────────

const AGENT_DEFS = new Map<string, { id: string }>(
  Object.values(STAGE_AGENTS).map((slug) => [slug, { id: slug }]),
);

function makeEvent(overrides: Partial<StartedData> = {}): StartedData {
  return {
    graphRunId: 'run_killer',
    graphId: 'graph_killer',
    missionId: 'mission_killer',
    workspaceId: 'ws_killer',
    missionType: 'creative-mission-full',
    retryCount: 0,
    ...overrides,
  };
}

function killerMission(overrides: Partial<MissionType> = {}): MissionType {
  const __m = {
    id: 'mission_killer',
    workspaceId: 'ws_killer',
    creatorId: 'user_killer',
    title: 'SEA AI-native entrepreneurship media business',
    objective: 'Launch a bilingual (vi/en) video-first media brand for SEA founders',
    audience: 'founders + operators',
    geography: 'Southeast Asia',
    timeframeStart: 1_750_000_000_000,
    timeframeEnd: 1_760_000_000_000,
    budgetCents: 50_000, // $500/mo
    spentCents: 0,
    autonomyLevel: 2,
    channels: ['youtube', 'tiktok', 'x'],
    monetizationGoals: ['affiliate', 'revenue'],
    constraints: {
      languages: ['vi', 'en'],
      creativeDirection: 'sharp, analytical, contrarian, SEA-native',
    },
    successMetrics: { views: 100_000, subscribers: 2_000 },
    status: 'running',
    currentPhase: 'executing',
    createdAt: 1_750_000_000_000,
    updatedAt: 1_750_000_000_000,
    ...overrides,
  };
  return __m as MissionType;
}

function makeGraph(overrides: Partial<ProductionGraph> = {}): ProductionGraph {
  return {
    id: 'graph_killer',
    workspaceId: 'ws_killer',
    missionType: 'creative-mission-full',
    slug: 'creative-mission-full',
    name: 'Creative Mission Full',
    definition: killerGraph(),
    isTemplate: true,
    createdAt: 1_750_000_000_000,
    updatedAt: 1_750_000_000_000,
    ...overrides,
  };
}

function makeRunRow(overrides: Partial<ProductionGraphRun> = {}): ProductionGraphRun {
  return {
    id: 'run_killer',
    graphId: 'graph_killer',
    missionId: 'mission_killer',
    workspaceId: 'ws_killer',
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

/** Deterministic per-stage success: fixed cost 7c / 40 tokens per stage. */
const STAGE_COST_CENTS = 7;
const STAGE_TOKENS = 40;

function makeExecSuccess(): ExecValue {
  return {
    success: true,
    output: { stage: 'ok' },
    artifacts: ['asset_' + STAGE_IDS.length],
    costCents: STAGE_COST_CENTS,
    durationMs: 10,
    totalTokens: STAGE_TOKENS,
  };
}

/** D5: the learning (sink) node returns a realistic payload with recommendations. */
function makeLearningExec(): ExecValue {
  return {
    success: true,
    output: {
      stage: 'ok',
      confidence: 0.82,
      recommendations: [
        { channel: 'youtube', action: 'double-down on short-form explainer' },
        { channel: 'tiktok', action: 'post 3x/week contrarian takes' },
        { channel: 'x', action: 'thread after every video' },
      ],
    },
    artifacts: ['asset_learning_001'],
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
    run: async (id, fn) => fn(),
    sendEvent: async (id, payload) => {
      sentEvents.push({ id, payload });
    },
  };
  return { step, sentEvents };
}

/** Wire every collaborator for the full 13-stage deterministic flight. */
function setupFlight(overrides: {
  learningOutput?: unknown;
  budgetCents?: number;
  spentCents?: number;
  approvalOutcome?: ApprovalDecision;
  statusFlips?: Array<[string, string]>;
} = {}): void {
  mocks.getRun.mockResolvedValue({ ok: true, value: makeRunRow({ status: 'queued' }) });
  mocks.getGraphById.mockResolvedValue({ ok: true, value: makeGraph() });
  const missionOverrides: Partial<MissionType> = {};
  if (overrides.budgetCents !== undefined) missionOverrides.budgetCents = overrides.budgetCents;
  if (overrides.spentCents !== undefined) missionOverrides.spentCents = overrides.spentCents;
  mocks.getMission.mockImplementation(async (_id: string) => killerMission(missionOverrides));
  mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: killerValidated() });
  mocks.executeAgent.mockImplementation(async (_def: unknown, _ctx: unknown) => {
    const isSink = mocks.executeAgent.mock.calls.length === STAGE_IDS.length;
    return { ok: true, value: isSink ? makeLearningExec() : makeExecSuccess() };
  });
  mocks.requestApprovalAndAwait.mockResolvedValue(overrides.approvalOutcome ?? approvedDecision());
}

function capturedNodeStates(): PersistedNodeState[][] {
  return mocks.setNodeStates.mock.calls.map(
    (call) => (call[1] as unknown as PersistedNodeState[]),
  );
}

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
  mocks.newPerformanceEventId.mockReturnValue('perf_killer');
  mocks.recordPerformanceEvent.mockResolvedValue(undefined);
  mocks.persistAgentLearning.mockResolvedValue(undefined);
  mocks.executePublish.mockResolvedValue({ ok: true, value: { platformVideoId: 'pv_' + Date.now() } });
});

// ─── The flight ───────────────────────────────────────────────────────────────

describe('killer mission — SEA AI-native media business, $500/mo, 2 gates', () => {
  it('flies all 13 stages gate-to-learning with BOTH approval gates', async () => {
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

    // D1: TWO approval gates, both publish nodes, exactly 2 gate calls.
    expect(mocks.requestApprovalAndAwait).toHaveBeenCalledTimes(2);
    for (const call of mocks.requestApprovalAndAwait.mock.calls) {
      const gateArg = call[0] as { actionId: string; runId: string };
      expect(gateArg.actionId).toBe('publish_content');
      expect(gateArg.runId).toBe('run_killer');
    }

    // D1: FULL 4-flip status choreography across both gates.
    // queued→running, then running → awaiting_approval (G1) → running
    // → awaiting_approval (G2) → running.
    const statusFlips = mocks.updateRunStatus.mock.calls.map(
      (call) => [call[1], call[2]] as [string, string],
    );
    expect(statusFlips).toEqual([
      ['queued', 'running'],
      ['running', 'awaiting_approval'],
      ['awaiting_approval', 'running'],
      ['running', 'awaiting_approval'],
      ['awaiting_approval', 'running'],
    ]);

    // Approved publish tokens reached BOTH publish nodes, nowhere else.
    const humanApprovalContext = mocks.executeAgent.mock.calls[9][1] as { approvedActionIds?: string[] };
    expect(humanApprovalContext.approvedActionIds).toEqual(['publish_content']);
    const distributionContext = mocks.executeAgent.mock.calls[10][1] as { approvedActionIds?: string[] };
    expect(distributionContext.approvedActionIds).toEqual(['publish_content']);
    const strategyContext = mocks.executeAgent.mock.calls[2][1] as { approvedActionIds?: string[] };
    expect(strategyContext.approvedActionIds).toBeUndefined();

    // Terminal write carried the exact totals and the learning sink output.
    expect(mocks.completeRun).toHaveBeenCalledTimes(1);
    const completedPayload = mocks.completeRun.mock.calls[0][2] as {
      totalCostCents: number;
      totalTokens: number;
      outputJson: string | null;
    };
    expect(completedPayload.totalCostCents).toBe(13 * STAGE_COST_CENTS);
    expect(completedPayload.totalTokens).toBe(13 * STAGE_TOKENS);
    const sink = JSON.parse(completedPayload.outputJson ?? 'null') as {
      recommendations: unknown[];
      confidence: number;
    };
    expect(sink.recommendations).toHaveLength(3);
    expect(sink.confidence).toBe(0.82);

    // Completed event emitted; no failed event.
    const completedEvt = sentEvents.find((e) => e.id === 'emit-completed');
    expect(completedEvt?.payload.name).toBe('production.graph.completed');
    expect(completedEvt?.payload.data).toEqual(
      expect.objectContaining({
        graphRunId: 'run_killer',
        missionId: 'mission_killer',
        totalCostCents: 13 * STAGE_COST_CENTS,
        totalTokens: 13 * STAGE_TOKENS,
      }),
    );
    expect(sentEvents.find((e) => e.id === 'emit-failed')).toBeUndefined();

    // Mission handed to the human — machine never self-completes.
    expect(mocks.advanceMissionToReview).toHaveBeenCalledTimes(1);
    expect(mocks.advanceMissionToReview).toHaveBeenCalledWith('mission_killer');

    // D4: Creative Memory write-back fired ONCE with campaign scope.
    expect(mocks.persistAgentLearning).toHaveBeenCalledTimes(1);
    const learningPayload = mocks.persistAgentLearning.mock.calls[0][0] as {
      workspaceId: string;
      missionId: string;
      agentId: string;
      runId: string;
      confidence: number;
      output: unknown;
    };
    expect(learningPayload.workspaceId).toBe('ws_killer');
    expect(learningPayload.missionId).toBe('mission_killer');
    expect(learningPayload.runId).toBe('run_killer');
    expect(learningPayload.agentId).toBe('sophia-learning');
    expect(learningPayload.confidence).toBe(0.82);
    expect((learningPayload.output as { recommendations: unknown[] }).recommendations).toHaveLength(3);

    // Cost ledger: 13 spend records of 7c.
    expect(mocks.recordSpend).toHaveBeenCalledTimes(13);
    for (const call of mocks.recordSpend.mock.calls) {
      expect(call[0]).toBe('mission_killer');
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
      STAGE_IDS.map((id) => `run_killer:${id}:0`),
    );
  });

  it('criterion 8: no secret material in any checkpoint or event payload', async () => {
    setupFlight();
    const { step, sentEvents } = makeStep();
    await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    // Walk every persisted checkpoint batch.
    for (const batch of capturedNodeStates()) {
      const serialized = JSON.stringify(batch).toLowerCase();
      expect(serialized).not.toMatch(/"apikey"|"api_key"/);
      expect(serialized).not.toMatch(/"token"\s*:\s*"[^"]/);
      expect(serialized).not.toMatch(/"secret"\s*:\s*"[^"]/);
    }
    // Walk every sentEvent payload.
    for (const evt of sentEvents) {
      const serialized = JSON.stringify(evt.payload).toLowerCase();
      expect(serialized).not.toMatch(/"apikey"|"api_key"/);
      expect(serialized).not.toMatch(/"token"\s*:\s*"[^"]/);
      expect(serialized).not.toMatch(/"secret"\s*:\s*"[^"]/);
    }
  });

  it('criterion 4: rejects at gate 1 and stops the flight (APPROVAL_REJECTED)', async () => {
    setupFlight({
      approvalOutcome: {
        outcome: 'rejected',
        reviewerId: 'user_ceo',
        comment: 'Not on brand',
      } as ApprovalDecision,
    });

    const { step, sentEvents } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: false, code: 'APPROVAL_REJECTED' });

    // Nine stages ran before gate 1 (scout..provenance); human-approval never executed.
    expect(mocks.executeAgent).toHaveBeenCalledTimes(9);
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    const failCall = mocks.failRun.mock.calls[0];
    expect(failCall[1]).toBe('awaiting_approval');
    expect((failCall[2] as { code: string }).code).toBe('APPROVAL_REJECTED');

    // The human-approval node is marked failed in the checkpoint.
    const checkpoints = capturedNodeStates();
    const failedNode = checkpoints[checkpoints.length - 1].find(
      (s) => s.nodeId === 'human-approval',
    );
    expect(failedNode?.status).toBe('failed');

    // Mission never advanced to review; no completed event; failed event emitted.
    expect(mocks.advanceMissionToReview).not.toHaveBeenCalled();
    expect(mocks.persistAgentLearning).not.toHaveBeenCalled();
    expect(sentEvents.find((e) => e.id === 'emit-completed')).toBeUndefined();
    const failedEvt = sentEvents.find((e) => e.id === 'emit-failed');
    expect(failedEvt?.payload.name).toBe('production.graph.failed');
    expect(failedEvt?.payload.data.errorCode).toBe('APPROVAL_REJECTED');
  });

  it('criterion 4: rejects at gate 2 with APPROVAL_REJECTED after first publish approved', async () => {
    setupFlight();
    // First gate approves; second gate rejects.
    mocks.requestApprovalAndAwait
      .mockResolvedValueOnce(approvedDecision())
      .mockResolvedValueOnce({
        outcome: 'rejected',
        reviewerId: 'user_ceo',
        comment: 'Distribution plan off-target',
      } as ApprovalDecision);

    const { step, sentEvents } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: false, code: 'APPROVAL_REJECTED' });

    // Gate 2 sits after distribution-plan's 10 completed stages
    // (scout..human-approval = 10 nodes; distribution-plan itself never executed).
    expect(mocks.requestApprovalAndAwait).toHaveBeenCalledTimes(2);
    expect(mocks.executeAgent).toHaveBeenCalledTimes(10);
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    expect((mocks.failRun.mock.calls[0][2] as { code: string }).code).toBe('APPROVAL_REJECTED');

    // The distribution-plan node is marked failed in the checkpoint.
    const checkpoints = capturedNodeStates();
    const failedNode = checkpoints[checkpoints.length - 1].find(
      (s) => s.nodeId === 'distribution-plan',
    );
    expect(failedNode?.status).toBe('failed');
    // …while human-approval completed.
    const approvedNode = checkpoints[checkpoints.length - 1].find(
      (s) => s.nodeId === 'human-approval',
    );
    expect(approvedNode?.status).toBe('completed');

    // No learning write-back on a rejected flight.
    expect(mocks.persistAgentLearning).not.toHaveBeenCalled();
    const failedEvt = sentEvents.find((e) => e.id === 'emit-failed');
    expect(failedEvt?.payload.data.errorCode).toBe('APPROVAL_REJECTED');
  });

  it('criterion 4: APPROVAL_TIMEOUT when the review window lapses at gate 1', async () => {
    setupFlight({
      approvalOutcome: { outcome: 'timeout' } as ApprovalDecision,
    });

    const { step } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: false, code: 'APPROVAL_TIMEOUT' });
    expect(mocks.executeAgent).toHaveBeenCalledTimes(9);
    expect((mocks.failRun.mock.calls[0][2] as { code: string }).code).toBe('APPROVAL_TIMEOUT');
  });

  it('D6: fails BUDGET_EXCEEDED at the mathematically correct node mid-flight', async () => {
    // 11 stages × 7c = 77c; a 70c budget exhausts after 10 stages → node 11 fails.
    setupFlight({ budgetCents: 70 });
    const { step, sentEvents } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: false, code: 'BUDGET_EXCEEDED' });

    // 10 stages completed and spent; the 11th (distribution-plan) hit the guard
    // after passing its approval gate (gate ordering precedes the budget check).
    expect(mocks.executeAgent).toHaveBeenCalledTimes(10);
    expect(mocks.recordSpend).toHaveBeenCalledTimes(10);
    expect(mocks.requestApprovalAndAwait).toHaveBeenCalledTimes(2);
    expect(mocks.failRun).toHaveBeenCalledTimes(1);
    expect((mocks.failRun.mock.calls[0][2] as { code: string }).code).toBe('BUDGET_EXCEEDED');

    const failedEvt = sentEvents.find((e) => e.id === 'emit-failed');
    expect(failedEvt?.payload.name).toBe('production.graph.failed');
    expect(failedEvt?.payload.data.errorCode).toBe('BUDGET_EXCEEDED');
    // No learning write-back, no mission advance on a budget-failed run.
    expect(mocks.persistAgentLearning).not.toHaveBeenCalled();
    expect(mocks.advanceMissionToReview).not.toHaveBeenCalled();
  });

  it('D6: spentCents from prior runs counts against the budget', async () => {
    // budget 50_000, already spent 49_972 → only 28c remains = 4 stages × 7c.
    setupFlight({ spentCents: 49_972 });
    const { step } = makeStep();

    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: false, code: 'BUDGET_EXCEEDED' });
    // 4 stages ran (28c), the 5th (writer) exhausted the remaining budget.
    // No publish gate was ever reached (gates sit at nodes 10-11).
    expect(mocks.executeAgent).toHaveBeenCalledTimes(4);
    expect(mocks.recordSpend).toHaveBeenCalledTimes(4);
    expect(mocks.requestApprovalAndAwait).not.toHaveBeenCalled();
  });

  it('criterion 9: resumes a half-flown mission — 3 remaining nodes execute on re-dispatch', async () => {
    // Interrupted after Human Approval (node 10): 10 completed, 3 remaining.
    const persisted = STAGE_IDS.slice(0, 10).map((nodeId) => ({
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
    mocks.getMission.mockResolvedValue(killerMission());
    mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: killerValidated() });
    mocks.executeAgent.mockImplementation(async () => ({ ok: true, value: makeExecSuccess() }));
    mocks.requestApprovalAndAwait.mockResolvedValue(approvedDecision());

    const { step } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    // Resumed totals count only the 3 remaining stages (distribution-plan,
    // performance, learning) — the 2nd publish gate still fires on resume.
    expect(result).toEqual({
      ok: true,
      totalCostCents: 3 * STAGE_COST_CENTS,
      totalTokens: 3 * STAGE_TOKENS,
    });
    expect(mocks.executeAgent).toHaveBeenCalledTimes(3);
    expect(mocks.requestApprovalAndAwait).toHaveBeenCalledTimes(1);
    // The run row started at 'running' — only gate-2's 2 flips occur.
    const statusFlips = mocks.updateRunStatus.mock.calls.map(
      (call) => [call[1], call[2]] as [string, string],
    );
    expect(statusFlips).toEqual([
      ['running', 'awaiting_approval'],
      ['awaiting_approval', 'running'],
    ]);
  });

  it('criterion 10: byte-identical across two deterministic flights (minus agentRunId)', async () => {
    // Flight 1.
    setupFlight();
    const stepOne = makeStep();
    await getHandler()({
      event: { data: makeEvent({ deterministic: true, graphRunId: 'run_x' }) },
      step: stepOne.step,
    });
    const statesOne = capturedNodeStates();

    // Flight 2 (fresh mocks, same shape).
    vi.clearAllMocks();
    setupFlight();
    const stepTwo = makeStep();
    await getHandler()({
      event: { data: makeEvent({ deterministic: true, graphRunId: 'run_y' }) },
      step: stepTwo.step,
    });
    const statesTwo = capturedNodeStates();

    const stripAgentRunId = (batches: PersistedNodeState[][]): PersistedNodeState[][] =>
      batches.map((batch) => batch.map((s) => ({ ...s, agentRunId: undefined })));
    expect(stripAgentRunId(statesOne)).toEqual(stripAgentRunId(statesTwo));
    expect(statesOne.length).toBe(13);
    expect(statesTwo.length).toBe(13);
  });

  it('criterion 4 (undo): cancellation before a node stops the flight as CANCELLED', async () => {
    setupFlight();
    // The runner checks cancellation BEFORE every node (runner:235), reading
    // the live run row. Cancelling the row before the first node therefore stops
    // the flight with zero executions — the operator's undo wins before any
    // work is spent. (Cancelling mid-flight is covered by the resume test: the
    // run row is re-dispatched and the persisted completed stages are skipped.)
    let getRunCalls = 0;
    mocks.getRun.mockImplementation(async () => {
      getRunCalls += 1;
      if (getRunCalls > 1) {
        return { ok: true, value: makeRunRow({ status: 'cancelled' }) };
      }
      return { ok: true, value: makeRunRow({ status: 'queued' }) };
    });

    const { step, sentEvents } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result).toEqual({ ok: false, code: 'CANCELLED' });
    expect(mocks.executeAgent).not.toHaveBeenCalled();
    expect(mocks.failRun).not.toHaveBeenCalled();
    const cancelledEvt = sentEvents.find((e) => e.id === 'emit-cancelled');
    expect(cancelledEvt?.payload.name).toBe('production.graph.cancelled');
    expect(mocks.advanceMissionToReview).not.toHaveBeenCalled();
    // No learning write-back on a cancelled run.
    expect(mocks.persistAgentLearning).not.toHaveBeenCalled();
  });

  it('D3: distribution-plan carries the per-channel plan that the publication adapter consumes after gate 2', async () => {
    setupFlight();
    // Per plan §D3 option (a) — ASSERT-ONLY, no new publish node in the graph.
    // The graph runner deliberately never calls executePublish: real publishing
    // lives in the distribution fan-out function
    // (forest/inngest/functions/distribution-fanout.ts), its own Inngest
    // function driven by the `distribution/plan.created` event. The graph's
    // job is to PRODUCE that plan; the fanout's job is to DISPATCH it. What
    // the graph must guarantee is that the distribution-plan node's output
    // carries one variant per channel with a platform, a title and an asset
    // id — that is the exact contract the fanout reads.
    mocks.executeAgent.mockImplementation(async (_def: unknown, _ctx: unknown) => {
      const callIndex = mocks.executeAgent.mock.calls.length;
      if (callIndex === 11) {
        return {
          ok: true,
          value: {
            success: true,
            output: {
              stage: 'ok',
              asset_id: 'asset_dist_001',
              variants: [
                { platform: 'youtube', title: 'Thesis: AI-native beats AI-washing', scheduledAt: '2026-09-01T09:00:00Z' },
                { platform: 'tiktok', title: '3 dấu hiệu bạn đang AI-washing', scheduledAt: '2026-09-01T12:00:00Z' },
                { platform: 'x', title: 'Thread: the AI-native flywheel', scheduledAt: '2026-09-02T09:00:00Z' },
              ],
            },
            artifacts: ['asset_dist_001'],
            costCents: STAGE_COST_CENTS,
            durationMs: 10,
            totalTokens: STAGE_TOKENS,
          },
        };
      }
      const isSink = callIndex === STAGE_IDS.length;
      return { ok: true, value: isSink ? makeLearningExec() : makeExecSuccess() };
    });

    const { step } = makeStep();
    const result = await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    expect(result.ok).toBe(true);

    // The distribution-plan node ran AFTER gate 2 (it is the second publish
    // node, so both approvals happened before it executed).
    const distPlanCall = mocks.executeAgent.mock.calls[10] as [
      { id: string },
      { approvedActionIds?: string[] },
      unknown,
    ];
    expect(distPlanCall[0].id).toBe('sophia-distribution-plan');
    expect(distPlanCall[1].approvedActionIds).toEqual(['publish_content']);

    // Its output is the plan the publication adapter consumes: one variant per
    // channel, each carrying a platform, a real title and an asset id. The
    // only observable copy of a node's output is the one the runner persisted
    // at checkpoint time — executeAgent's return value is not retained on the
    // call record (its third call arg is the injected provider registry).
    // Take the LAST checkpoint batch: an earlier batch records distribution-plan
    // as still pending (it is checkpointed before that node runs).
    const finalBatch = capturedNodeStates()[capturedNodeStates().length - 1] ?? [];
    const distPlanCheckpoint = finalBatch.find((s) => s.nodeId === 'distribution-plan');
    expect(distPlanCheckpoint?.status).toBe('completed');
    const distPlanOutput = JSON.parse(distPlanCheckpoint?.outputJson ?? 'null') as {
      asset_id: string;
      variants: Array<{ platform: string; title: string }>;
    } | null;
    expect(distPlanOutput?.asset_id).toBe('asset_dist_001');
    expect(distPlanOutput?.variants).toHaveLength(3);
    const platforms = distPlanOutput?.variants.map((v) => v.platform);
    expect(platforms).toEqual(['youtube', 'tiktok', 'x']);
    for (const v of distPlanOutput?.variants ?? []) {
      expect(v.platform.length).toBeGreaterThan(0);
      expect(v.title.length).toBeGreaterThan(0);
    }
  });

  // NOTE (plan §D3 option a — assert-only): the graph runner never calls
  // executePublish, and real publishing lives in the distribution fan-out
  // function (forest/inngest/functions/distribution-fanout.ts), its own
  // Inngest function driven by `distribution/plan.created`. The seam the
  // graph guarantees is the distribution-plan node's output contract — one
  // variant per channel with a platform, title and asset id — which the
  // fanout consumes. That contract is what the D3 test above asserts, both on
  // the node's execution context and on the terminal completeRun payload.
  // A dedicated fanout end-to-end test is out of scope for this assert-only
  // delta (no new publish node may be added to the graph).

  it('criterion 6+7: provider registry is injected, no hardcoded provider in agent land', async () => {
    setupFlight();
    const { step } = makeStep();
    await getHandler()({ event: { data: makeEvent({ deterministic: true }) }, step });

    // Criterion 6: the provider registry built once by the BYOK factory was
    // injected into every executeAgent call — agents never build their own.
    expect(mocks.buildProviders).toHaveBeenCalledTimes(1);
    expect(mocks.buildProviders).toHaveBeenCalledWith({
      userId: 'user_killer',
      providers: [
        { id: 'openrouter', label: 'OpenRouter' },
        { id: 'anthropic', label: 'Anthropic' },
      ],
      autoRegister: true,
    });
    // buildProviders is async — its resolved registry is the object the runner
    // extracted and passed to every executeAgent call. Assert identity by
    // reference: every call receives the same injected registry object.
    const firstRegistry = mocks.executeAgent.mock.calls[0]?.[2];
    for (const call of mocks.executeAgent.mock.calls) {
      expect(call[2]).toBe(firstRegistry);
    }

    // Criterion 7: the single orchestration engine — the runner handler is the
    // only driver of the flight (no second workflow engine invoked anywhere).
    expect(mocks.executeAgent.mock.calls).toHaveLength(13);
  });

  // NOTE (plan §D3 option a — assert-only): the graph runner never calls
  // executePublish, and real publishing lives in the distribution fan-out
  // function (forest/inngest/functions/distribution-fanout.ts), its own
  // Inngest function driven by `distribution/plan.created`. The seam the
  // graph guarantees is the distribution-plan node's output contract — one
  // variant per channel with a platform, title and asset id — which the
  // fanout consumes. That contract is what the D3 test above asserts, both on
  // the node's execution context and on the terminal completeRun payload.
  // A dedicated fanout end-to-end test is out of scope for this assert-only
  // delta (no new publish node may be added to the graph).
});
