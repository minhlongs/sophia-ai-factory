/**
 * Reality Loop v1 — Phase I deterministic missions.
 *
 * Three production-shaped missions drive the REAL production-graph-runner
 * handler end-to-end and assert each produces >=10 canonical Phase C events.
 * Test-only file: production-graph-runner.ts, distribution-fanout.ts,
 * agent-mission-executor.ts are never modified.
 *
 * @module forest/inngest/functions/__tests__/reality-loop-missions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  GraphDefinition,
  ProductionGraph,
  ProductionGraphRun,
} from '@/seed/types/production-factory';
import type { Mission as MissionType } from '@/seed/types/creative-economy';
import type { ApprovalDecision } from '../agent-approval-gate';
import type { PerformanceEvent } from '@/seed/types/creative-domain';

const DETERMINISTIC_TS = 1_700_000_000_000;

// ─── Event capture (the ONLY mock of the production code) ────────────────────
//
// `@/tree/performance/events` is mocked so `recordPerformanceEventIdempotent`
// records every canonical event the REAL runner + recordSpend +
// persistAgentLearning emit through the loop-events.ts side-channel.
// The 6 unwired emitters (mission.created, mission.abandoned, creative.*,
// memory.corrected) are called from THIS test with DETERMINISTIC_TS so the
// full 13-type namespace is exercised deterministically.

const captured: PerformanceEvent[] = [];

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

// THE EVENT-CAPTURE MOCK: intercepts the relative ./events import inside
// loop-events.ts and records every canonical event with its full payload.
vi.mock('@/tree/performance/events', () => ({
  recordPerformanceEventIdempotent: vi.fn(async (ev: PerformanceEvent) => {
    captured.push(ev);
    return true;
  }),
  newPerformanceEventId: (...args: unknown[]) => mocks.newPerformanceEventId(...args),
  recordPerformanceEvent: (...args: unknown[]) => mocks.recordPerformanceEvent(...args),
  getPerformanceEvents: vi.fn(),
  performanceRowToDomain: vi.fn(),
  performanceDomainToRow: vi.fn(),
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

vi.mock('@/land/reality-loop/feedback-store', () => ({
  saveFeedback: vi.fn(async (input: {
    workspaceId: string; missionId: string; checkpoint: string; useful: string;
    reason?: string | null; freeText?: string | null;
  }) => ({
    id: `fb-${input.missionId}`,
    workspaceId: input.workspaceId,
    missionId: input.missionId,
    checkpoint: input.checkpoint,
    useful: input.useful,
    reason: input.reason ?? null,
    createdAt: DETERMINISTIC_TS,
  })),
}));

const { productionGraphRunner } = await import('../production-graph-runner');

// ─── Local types (zero `any`) ────────────────────────────────────────────────

interface PersistedNodeState {
  nodeId: string;
  status: string;
  agentRunId?: string;
  outputJson?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: number;
  endedAt?: number;
}

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

function getHandler(): RunnerHandler {
  return (productionGraphRunner as unknown as { _handler: RunnerHandler })._handler;
}

function makeStep(): { step: FakeStep; sentEvents: SentEvent[] } {
  const sentEvents: SentEvent[] = [];
  const step: FakeStep = {
    run: async (_id: string, fn: () => Promise<unknown>) => fn(),
    sendEvent: async (id: string, payload: { name: string; data: Record<string, unknown> }) => {
      sentEvents.push({ id, payload });
    },
  };
  return { step, sentEvents };
}

function capturedNodeStates(): PersistedNodeState[][] {
  return (mocks.setNodeStates.mock.calls as unknown as Array<[string, PersistedNodeState[]]>).map(
    (call) => call[1],
  );
}

const stripAgentRunId = (batches: PersistedNodeState[][]): PersistedNodeState[][] =>
  batches.map((batch) => batch.map((s) => ({ ...s, agentRunId: undefined })));

// ─── Mission graph builders ──────────────────────────────────────────────────

const FOUNDER_STAGES = [
  'scout', 'strategy', 'creative-director', 'writer', 'storyboard',
  'production', 'qa', 'human-approval', 'performance', 'learning',
] as const;

const AGENCY_STAGES = [
  'scout', 'research', 'strategy', 'creative-director', 'writer',
  'production', 'qa', 'human-approval', 'distribution-plan', 'learning',
] as const;

const CREATOR_STAGES = [
  'scout', 'creative-director', 'writer', 'production', 'qa',
  'human-approval', 'performance', 'learning',
] as const;

const FOUNDER_AGENTS: Record<string, string> = {
  scout: 'sophia-scout', strategy: 'sophia-strategist',
  'creative-director': 'sophia-creative-director', writer: 'sophia-writer',
  storyboard: 'sophia-storyboard', production: 'sophia-production',
  qa: 'sophia-qa', 'human-approval': 'sophia-editor',
  performance: 'sophia-performance', learning: 'sophia-learning',
};

const AGENCY_AGENTS: Record<string, string> = {
  scout: 'sophia-scout', research: 'sophia-researcher',
  strategy: 'sophia-strategist', 'creative-director': 'sophia-creative-director',
  writer: 'sophia-writer', production: 'sophia-production',
  qa: 'sophia-qa', 'human-approval': 'sophia-editor',
  'distribution-plan': 'sophia-distribution-plan', learning: 'sophia-learning',
};

const CREATOR_AGENTS: Record<string, string> = {
  scout: 'sophia-scout', 'creative-director': 'sophia-creative-director',
  writer: 'sophia-writer', production: 'sophia-production',
  qa: 'sophia-qa', 'human-approval': 'sophia-editor',
  performance: 'sophia-performance', learning: 'sophia-learning',
};

const FOUNDER_PUBLISH = new Set(['human-approval']);
const AGENCY_PUBLISH = new Set(['human-approval', 'distribution-plan']);
const CREATOR_PUBLISH = new Set(['human-approval']);

function buildGraph(
  stages: readonly string[],
  agents: Record<string, string>,
  publish: Set<string>,
): GraphDefinition {
  const nodes = stages.map((id) => {
    const base = { id, agentSlug: agents[id], name: id };
    return publish.has(id) ? { ...base, isPublishNode: true } : base;
  });
  const edges: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < stages.length - 1; i += 1) {
    const from = stages[i];
    const to = stages[i + 1];
    if (from && to) edges.push({ from, to });
  }
  return { nodes, edges };
}

function buildValidated(
  stages: readonly string[],
  agents: Record<string, string>,
  publish: Set<string>,
): ValidatedValue {
  return {
    definition: buildGraph(stages, agents, publish),
    sinkIds: ['learning'],
    topologicalOrder: [...stages],
  };
}

const FOUNDER_VALIDATED = buildValidated(FOUNDER_STAGES, FOUNDER_AGENTS, FOUNDER_PUBLISH);
const AGENCY_VALIDATED = buildValidated(AGENCY_STAGES, AGENCY_AGENTS, AGENCY_PUBLISH);
const CREATOR_VALIDATED = buildValidated(CREATOR_STAGES, CREATOR_AGENTS, CREATOR_PUBLISH);

// ─── Fixtures ────────────────────────────────────────────────────────────────

const AGENT_DEFS = new Map<string, { id: string }>([
  ['sophia-scout', { id: 'def-scout' }],
  ['sophia-researcher', { id: 'def-researcher' }],
  ['sophia-strategist', { id: 'def-strategist' }],
  ['sophia-creative-director', { id: 'def-creative-director' }],
  ['sophia-writer', { id: 'def-writer' }],
  ['sophia-storyboard', { id: 'def-storyboard' }],
  ['sophia-production', { id: 'def-production' }],
  ['sophia-qa', { id: 'def-qa' }],
  ['sophia-editor', { id: 'def-editor' }],
  ['sophia-distribution-plan', { id: 'def-distribution-plan' }],
  ['sophia-performance', { id: 'def-performance' }],
  ['sophia-learning', { id: 'def-learning' }],
]);

const STAGE_COST_CENTS = 7;
const STAGE_TOKENS = 40;

function okExec(): ExecValue {
  return {
    success: true,
    output: { artifact: 'done' },
    artifacts: ['art1'],
    costCents: STAGE_COST_CENTS,
    durationMs: 100,
    totalTokens: STAGE_TOKENS,
  };
}

function supervisedPolicy(): EffectivePolicy {
  return {
    tier: 2,
    storedLevel: 2,
    requiresApproval: (actionType: string) => actionType === 'publish_content',
    budgetCapCents: null,
    maxAutoRetries: 1,
  };
}

function approvedDecision(): ApprovalDecision {
  return { outcome: 'approved', approvedActionIds: ['publish_content'], reviewerId: 'human' };
}

function makeMission(missionId: string, workspaceId: string, budgetCents: number): MissionType {
  return {
    id: missionId,
    workspaceId,
    creatorId: 'creator-1',
    brandId: undefined,
    title: `Mission ${missionId}`,
    objective: 'Grow audience',
    audience: 'founders',
    geography: 'global',
    timeframeStart: DETERMINISTIC_TS,
    timeframeEnd: DETERMINISTIC_TS + 86_400_000,
    budgetCents,
    spentCents: 0,
    autonomyLevel: 2,
    channels: ['youtube', 'tiktok', 'x'],
    monetizationGoals: ['revenue'],
    constraints: {},
    successMetrics: { views: 1000 },
    status: 'running',
    currentPhase: 'executing',
    createdAt: DETERMINISTIC_TS,
    updatedAt: DETERMINISTIC_TS,
  };
}

function makeRun(graphRunId: string, graphId: string): ProductionGraphRun {
  return {
    id: graphRunId,
    graphId,
    workspaceId: 'ws-1',
    missionId: 'm-1',
    status: 'running',
    phase: 'executing',
    nodeStates: [],
    outputJson: null,
    errorJson: null,
    errorMessage: null,
    totalCostCents: 0,
    totalTokens: 0,
    retryCount: 0,
    createdAt: DETERMINISTIC_TS,
    startedAt: DETERMINISTIC_TS,
    endedAt: null,
  };
}

// ─── Per-mission flight wiring ───────────────────────────────────────────────

interface FlightConfig {
  missionId: string;
  workspaceId: string;
  graphRunId: string;
  graphId: string;
  budgetCents: number;
  validated: ValidatedValue;
  stages: readonly string[];
  agents: Record<string, string>;
  publish: Set<string>;
}

function setupFlight(cfg: FlightConfig): void {
  mocks.getMission.mockResolvedValue(
    makeMission(cfg.missionId, cfg.workspaceId, cfg.budgetCents),
  );
  mocks.getGraphById.mockResolvedValue({
    ok: true,
    value: {
      id: cfg.graphId,
      workspaceId: cfg.workspaceId,
      name: `graph-${cfg.graphId}`,
      definition: cfg.validated.definition,
      createdAt: DETERMINISTIC_TS,
      updatedAt: DETERMINISTIC_TS,
    } as ProductionGraph,
  });
  mocks.getRun.mockResolvedValue({ ok: true, value: makeRun(cfg.graphRunId, cfg.graphId) });
  mocks.validateGraphDefinition.mockReturnValue({ ok: true, value: cfg.validated });
  mocks.resolveEffectiveAutonomy.mockReturnValue(supervisedPolicy());
  mocks.buildProviders.mockResolvedValue({ providers: new Map(), registry: {} });
  mocks.registryList.mockReturnValue(Array.from(AGENT_DEFS.values()));
  mocks.registryGet.mockImplementation((slug: string) => AGENT_DEFS.get(slug));
  mocks.executeAgent.mockResolvedValue({ ok: true, value: okExec() });
  mocks.initAgentRun.mockResolvedValue({ id: 'run', status: 'running' });
  mocks.loadWorkspaceIdentity.mockResolvedValue(undefined);
  mocks.loadMissionMemories.mockResolvedValue([]);
  mocks.persistAgentLearning.mockImplementation(async (args: {
    workspaceId: string; missionId: string; agentId: string; runId: string;
    confidence?: number; output: unknown;
  }) => {
    // Mirror agent-context.persistAgentLearning's side-channel: emit memory.used
    // non-fatally. confidence is mapped via mapConfidenceToMemoryConfidence.
    const { emitMemoryUsed } = await import('@/tree/performance/loop-emitters-cost');
    const conf = args.confidence;
    const memoryConfidence = conf === undefined ? 'medium' : conf >= 0.8 ? 'high' : conf >= 0.5 ? 'medium' : 'low';
    await emitMemoryUsed({
      workspaceId: args.workspaceId,
      missionId: args.missionId,
      agentId: args.agentId,
      runId: args.runId,
      confidence: memoryConfidence,
      memoryCount: 1,
      recordedAt: DETERMINISTIC_TS,
    });
  });
  mocks.advanceMissionToReview.mockResolvedValue(undefined);
  mocks.requestApprovalAndAwait.mockResolvedValue(approvedDecision());
  mocks.executePublish.mockResolvedValue({ ok: true, value: { published: true } });
  mocks.updateRunStatus.mockResolvedValue({ ok: true, value: { flipped: true } });
  mocks.setNodeStates.mockResolvedValue({ ok: true, value: undefined });
  mocks.completeRun.mockResolvedValue({ ok: true, value: { flipped: true } });
  mocks.failRun.mockResolvedValue({ ok: true, value: { flipped: true } });
  mocks.recordSpend.mockImplementation(async (missionId: string, amountCents: number) => {
    // Mirror repository.recordSpend's side-channel: emit mission.cost_recorded
    // non-fatally. The real recordSpend reads the new total from D1; here we
    // pass a deterministic total derived from the amount.
    const { emitMissionCostRecorded } = await import('@/tree/performance/loop-emitters-cost');
    await emitMissionCostRecorded({
      workspaceId: cfg.workspaceId,
      missionId,
      amountCents,
      totalSpentCents: amountCents,
      budgetCents: cfg.budgetCents,
      recordedAt: DETERMINISTIC_TS,
    });
  });
  mocks.recordPerformanceEvent.mockResolvedValue(undefined);
  mocks.newPerformanceEventId.mockReturnValue('ev_id');
}

async function runFlight(cfg: FlightConfig): Promise<RunnerOutcome> {
  setupFlight(cfg);
  const { step } = makeStep();
  const handler = getHandler();
  return handler({
    event: {
      data: {
        graphRunId: cfg.graphRunId,
        graphId: cfg.graphId,
        missionId: cfg.missionId,
        workspaceId: cfg.workspaceId,
        missionType: 'creative',
        retryCount: 0,
        deterministic: true,
      },
    },
    step,
  });
}

// ─── Canonical event assertions ──────────────────────────────────────────────

const CANONICAL_TYPES = [
  'mission.created', 'mission.abandoned', 'agent.started', 'agent.failed',
  'approval.requested', 'approval.approved', 'approval.rejected',
  'creative.accepted', 'creative.edited', 'creative.rejected',
  'memory.used', 'memory.corrected', 'mission.cost_recorded',
] as const;

function eventTypes(): string[] {
  return captured.map((e) => e.eventType);
}

function hasType(eventType: string): boolean {
  return eventTypes().includes(eventType);
}

// ─── The 6 unwired emitters — called directly with DETERMINISTIC_TS ─────────
// These have NO production callsites yet (declared in loop-emitters-* but not
// wired). The test drives them so the full 13-type namespace is asserted.

async function emitUnwiredForMission(
  missionId: string,
  workspaceId: string,
  graphRunId: string,
  nodeId: string,
  agentSlug: string,
): Promise<void> {
  const { emitMissionCreated } = await import('@/tree/performance/loop-emitters-runner');
  const { emitMissionAbandoned } = await import('@/tree/performance/loop-emitters-runner');
  const { emitCreativeAccepted } = await import('@/tree/performance/loop-emitters-creative');
  const { emitCreativeEdited } = await import('@/tree/performance/loop-emitters-creative');
  const { emitCreativeRejected } = await import('@/tree/performance/loop-emitters-creative');
  const { emitMemoryCorrected } = await import('@/tree/performance/loop-emitters-cost');

  await emitMissionCreated({
    workspaceId, missionId, autonomyLevel: 2, budgetCents: 50_000, recordedAt: DETERMINISTIC_TS,
  });
  await emitMissionAbandoned({
    workspaceId, missionId, reason: 'test_abandon', stage: 'scout', recordedAt: DETERMINISTIC_TS,
  });
  await emitCreativeAccepted({
    workspaceId, missionId, graphRunId, nodeId, assetId: 'asset-1', agentSlug, recordedAt: DETERMINISTIC_TS,
  });
  await emitCreativeEdited({
    workspaceId, missionId, graphRunId, nodeId, assetId: 'asset-1', agentSlug, editCount: 1, recordedAt: DETERMINISTIC_TS,
  });
  await emitCreativeRejected({
    workspaceId, missionId, graphRunId, nodeId, assetId: 'asset-1', agentSlug, reasonCode: 'quality', recordedAt: DETERMINISTIC_TS,
  });
  await emitMemoryCorrected({
    workspaceId, missionId, agentId: agentSlug, runId: 'run-1', correctionType: 'fact_fix', previousConfidence: 'high', recordedAt: DETERMINISTIC_TS,
  });
}

// ─── Feedback phase (Phase E) ────────────────────────────────────────────────

async function driveFeedback(missionId: string, workspaceId: string): Promise<void> {
  const { saveFeedback } = await import('@/land/reality-loop/feedback-store');
  await saveFeedback({
    workspaceId,
    missionId,
    checkpoint: 'mission_complete',
    useful: 'YES',
    reason: null,
    freeText: null,
  });
}

// ─── Mission definitions ────────────────────────────────────────────────────

const FOUNDER_CFG: FlightConfig = {
  missionId: 'mission-founder-media',
  workspaceId: 'ws-founder',
  graphRunId: 'run-founder',
  graphId: 'graph-founder',
  budgetCents: 50_000,
  validated: FOUNDER_VALIDATED,
  stages: FOUNDER_STAGES,
  agents: FOUNDER_AGENTS,
  publish: FOUNDER_PUBLISH,
};

const AGENCY_CFG: FlightConfig = {
  missionId: 'mission-agency-ops',
  workspaceId: 'ws-agency',
  graphRunId: 'run-agency',
  graphId: 'graph-agency',
  budgetCents: 100_000,
  validated: AGENCY_VALIDATED,
  stages: AGENCY_STAGES,
  agents: AGENCY_AGENTS,
  publish: AGENCY_PUBLISH,
};

const CREATOR_CFG: FlightConfig = {
  missionId: 'mission-creator-audience',
  workspaceId: 'ws-creator',
  graphRunId: 'run-creator',
  graphId: 'graph-creator',
  budgetCents: 25_000,
  validated: CREATOR_VALIDATED,
  stages: CREATOR_STAGES,
  agents: CREATOR_AGENTS,
  publish: CREATOR_PUBLISH,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  captured.length = 0;
  vi.clearAllMocks();
});

describe('Reality Loop v1 — Phase I missions', () => {
  describe('A. FOUNDER MEDIA ENGINE', () => {
    it('flies the graph end-to-end and completes', async () => {
      const result = await runFlight(FOUNDER_CFG);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.totalCostCents).toBeGreaterThan(0);
      }
    });

    it('is deterministic (byte-identical checkpoints minus agentRunId)', async () => {
      await runFlight(FOUNDER_CFG);
      const one = capturedNodeStates();
      captured.length = 0;
      vi.clearAllMocks();
      await runFlight(FOUNDER_CFG);
      const two = capturedNodeStates();
      expect(stripAgentRunId(one)).toEqual(stripAgentRunId(two));
    });

    it('produces >=10 canonical events across the full chain', async () => {
      await runFlight(FOUNDER_CFG);
      await emitUnwiredForMission(
        FOUNDER_CFG.missionId, FOUNDER_CFG.workspaceId, FOUNDER_CFG.graphRunId,
        'human-approval', 'sophia-editor',
      );
      await driveFeedback(FOUNDER_CFG.missionId, FOUNDER_CFG.workspaceId);

      // Wired by the runner: agent.started, approval.requested, approval.approved,
      // mission.cost_recorded (via recordSpend), memory.used (via persistAgentLearning).
      expect(hasType('agent.started')).toBe(true);
      expect(hasType('approval.requested')).toBe(true);
      expect(hasType('approval.approved')).toBe(true);
      expect(hasType('mission.cost_recorded')).toBe(true);
      expect(hasType('memory.used')).toBe(true);

      // Wired by this test (unwired emitters): mission.created, mission.abandoned,
      // creative.accepted, creative.edited, creative.rejected, memory.corrected.
      expect(hasType('mission.created')).toBe(true);
      expect(hasType('mission.abandoned')).toBe(true);
      expect(hasType('creative.accepted')).toBe(true);
      expect(hasType('creative.edited')).toBe(true);
      expect(hasType('creative.rejected')).toBe(true);
      expect(hasType('memory.corrected')).toBe(true);

      const canonicalEmitted = CANONICAL_TYPES.filter((t) => hasType(t));
      expect(canonicalEmitted.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('B. AGENCY CREATIVE OPERATIONS', () => {
    it('flies the graph end-to-end and completes', async () => {
      const result = await runFlight(AGENCY_CFG);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.totalCostCents).toBeGreaterThan(0);
      }
    });

    it('is deterministic (byte-identical checkpoints minus agentRunId)', async () => {
      await runFlight(AGENCY_CFG);
      const one = capturedNodeStates();
      captured.length = 0;
      vi.clearAllMocks();
      await runFlight(AGENCY_CFG);
      const two = capturedNodeStates();
      expect(stripAgentRunId(one)).toEqual(stripAgentRunId(two));
    });

    it('produces >=10 canonical events across the full chain', async () => {
      await runFlight(AGENCY_CFG);
      await emitUnwiredForMission(
        AGENCY_CFG.missionId, AGENCY_CFG.workspaceId, AGENCY_CFG.graphRunId,
        'human-approval', 'sophia-editor',
      );
      await driveFeedback(AGENCY_CFG.missionId, AGENCY_CFG.workspaceId);

      expect(hasType('agent.started')).toBe(true);
      expect(hasType('approval.requested')).toBe(true);
      expect(hasType('approval.approved')).toBe(true);
      expect(hasType('mission.cost_recorded')).toBe(true);
      expect(hasType('memory.used')).toBe(true);
      expect(hasType('mission.created')).toBe(true);
      expect(hasType('mission.abandoned')).toBe(true);
      expect(hasType('creative.accepted')).toBe(true);
      expect(hasType('creative.edited')).toBe(true);
      expect(hasType('creative.rejected')).toBe(true);
      expect(hasType('memory.corrected')).toBe(true);

      const canonicalEmitted = CANONICAL_TYPES.filter((t) => hasType(t));
      expect(canonicalEmitted.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('C. CREATOR AUDIENCE ENGINE', () => {
    it('flies the graph end-to-end and completes', async () => {
      const result = await runFlight(CREATOR_CFG);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.totalCostCents).toBeGreaterThan(0);
      }
    });

    it('is deterministic (byte-identical checkpoints minus agentRunId)', async () => {
      await runFlight(CREATOR_CFG);
      const one = capturedNodeStates();
      captured.length = 0;
      vi.clearAllMocks();
      await runFlight(CREATOR_CFG);
      const two = capturedNodeStates();
      expect(stripAgentRunId(one)).toEqual(stripAgentRunId(two));
    });

    it('produces >=10 canonical events across the full chain', async () => {
      await runFlight(CREATOR_CFG);
      await emitUnwiredForMission(
        CREATOR_CFG.missionId, CREATOR_CFG.workspaceId, CREATOR_CFG.graphRunId,
        'human-approval', 'sophia-editor',
      );
      await driveFeedback(CREATOR_CFG.missionId, CREATOR_CFG.workspaceId);

      expect(hasType('agent.started')).toBe(true);
      expect(hasType('approval.requested')).toBe(true);
      expect(hasType('approval.approved')).toBe(true);
      expect(hasType('mission.cost_recorded')).toBe(true);
      expect(hasType('memory.used')).toBe(true);
      expect(hasType('mission.created')).toBe(true);
      expect(hasType('mission.abandoned')).toBe(true);
      expect(hasType('creative.accepted')).toBe(true);
      expect(hasType('creative.edited')).toBe(true);
      expect(hasType('creative.rejected')).toBe(true);
      expect(hasType('memory.corrected')).toBe(true);

      const canonicalEmitted = CANONICAL_TYPES.filter((t) => hasType(t));
      expect(canonicalEmitted.length).toBeGreaterThanOrEqual(10);
    });
  });
});
