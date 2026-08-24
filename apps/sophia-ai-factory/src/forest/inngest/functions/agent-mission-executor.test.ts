/**
 * Tests for agent-mission-executor — per-run BYOK provider wiring + real budget
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Verifies:
 * - Per-run provider registry keyed to mission creator (no cross-tenant bleed)
 * - Real budget from mission row (BUDGET_EXCEEDED before provider call)
 * - Mission brief pushed into context.memory
 * - Spend recorded on success
 * - All failure modes emit proper agent_run rows + mission.failed events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mission } from '@/seed/types/creative-domain';
import type { AgentDefinition, AgentPermission, AutonomyLevel } from '@/seed/types/creative-domain';

// ── Test setup ────────────────────────────────────────────────────────────────

// Hoisted mocks — must be at module top level for vitest hoisting
const { mockGetMission, mockRecordSpend, mockGetAgentRun, mockCreateAgentRun, mockUpdateAgentRun, mockAppendAgentLog, mockEmitMissionCompleted, mockEmitMissionFailed, mockAdvanceMissionToReview, mockBuildProviders, mockExecuteAgent, mockAgentDefinitionRegistry } = vi.hoisted(() => ({
  mockGetMission: vi.fn(),
  mockRecordSpend: vi.fn(),
  mockGetAgentRun: vi.fn(),
  mockCreateAgentRun: vi.fn(),
  mockUpdateAgentRun: vi.fn(),
  mockAppendAgentLog: vi.fn(),
  mockEmitMissionCompleted: vi.fn(),
  mockEmitMissionFailed: vi.fn(),
  mockAdvanceMissionToReview: vi.fn(),
  mockBuildProviders: vi.fn(),
  mockExecuteAgent: vi.fn(),
  mockAgentDefinitionRegistry: {
    get: vi.fn(),
    has: vi.fn(),
    register: vi.fn(),
  },
}));

// Mock all dependencies
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((_cfg, _event, handler) => ({ _handler: handler, ..._cfg })),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/tree/agent-protocol', () => ({
  executeAgent: (...args: unknown[]) => mockExecuteAgent(...args),
  agentDefinitionRegistry: mockAgentDefinitionRegistry,
}));

vi.mock('@/forest/ai/provider-factory', () => ({
  buildProviders: (...args: unknown[]) => mockBuildProviders(...args),
}));

vi.mock('@/tree/mission/agent-run-repo', () => ({
  getAgentRun: (...args: unknown[]) => mockGetAgentRun(...args),
  createAgentRun: (...args: unknown[]) => mockCreateAgentRun(...args),
  updateAgentRun: (...args: unknown[]) => mockUpdateAgentRun(...args),
  appendAgentLog: (...args: unknown[]) => mockAppendAgentLog(...args),
}));

vi.mock('@/tree/mission/repository', () => ({
  getMission: (...args: unknown[]) => mockGetMission(...args),
  recordSpend: (...args: unknown[]) => mockRecordSpend(...args),
}));

vi.mock('./agent-mission-lifecycle', () => ({
  emitMissionCompleted: (...args: unknown[]) => mockEmitMissionCompleted(...args),
  emitMissionFailed: (...args: unknown[]) => mockEmitMissionFailed(...args),
  advanceMissionToReview: (...args: unknown[]) => mockAdvanceMissionToReview(...args),
}));

// Import after mocks
const { agentMissionExecutor } = await import('./agent-mission-executor');

// Type for the handler extracted from InngestFunction
type AgentMissionExecutorHandler = (ctx: {
  event: { data: { runId: string; agentId: string; missionId: string; workspaceId: string; autonomyLevel: number; inputJson: Record<string, unknown> } };
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>; sleep: (name: string, delay: number) => Promise<void> };
}) => Promise<{ success: boolean; data?: { runId: string; status: string }; error?: { code: string; message: string } }>;

// Helper to extract the handler from the InngestFunction wrapper
function getHandler(): AgentMissionExecutorHandler {
  return (agentMissionExecutor as unknown as { _handler: AgentMissionExecutorHandler })._handler;
}

// ── Test helpers ──────────────────────────────────────────────────────────────

const mockMission: Mission = {
  id: 'mission_123',
  workspaceId: 'ws_123',
  creatorId: 'creator_456',
  brandId: undefined,
  title: 'Test Mission',
  objective: 'Create viral content about AI',
  audience: 'Tech founders',
  geography: 'US',
  timeframeStart: Date.now() / 1000,
  timeframeEnd: Date.now() / 1000 + 86400 * 7,
  budgetCents: 10000,
  spentCents: 2000,
  autonomyLevel: 3,
  channels: ['youtube', 'tiktok'],
  monetizationGoals: ['ad_revenue'],
  constraints: {},
  successMetrics: {},
  status: 'running',
  currentPhase: 'executing',
  createdAt: Date.now() / 1000,
  updatedAt: Date.now() / 1000,
};

const mockDefinition: AgentDefinition = {
  id: 'sophia-content-writer',
  name: 'Sophia Content Writer',
  role: 'You are an expert copywriter.',
  capabilities: ['generate_text'],
  permissions: [
    {
      tool: 'generate_text',
      scopes: [],
      requiresApproval: false,
      maxCostCents: 500,
    },
  ],
  defaultAutonomy: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  modelPolicy: {
    capability: 'text',
    costPolicy: 'cheap',
    maxCostCents: 500,
    requiredQuality: 0.7,
  },
};

const mockProviderRegistry = {
  get: vi.fn(),
  register: vi.fn(),
};

const mockRunResult = {
  ok: true,
  value: {
    id: 'run_123',
    agentId: 'sophia-content-writer',
    workspaceId: 'ws_123',
    missionId: 'mission_123',
    autonomyLevel: 3,
    phase: 'init',
    status: 'queued',
  },
};

const mockAgentRunResult = {
  ok: true,
  value: {
    output: { content: 'Hello world' },
    costCents: 150,
    totalTokens: 500,
  },
};

function setupMocks() {
  vi.clearAllMocks();
  mockGetMission.mockResolvedValue(mockMission);
  mockRecordSpend.mockResolvedValue(undefined);
  // Default: no existing agent_run row → first-run path (INSERT fires)
  mockGetAgentRun.mockResolvedValue({ ok: true, value: null });
  mockCreateAgentRun.mockResolvedValue(mockRunResult);
  mockUpdateAgentRun.mockResolvedValue({ ok: true, value: {} });
  mockAppendAgentLog.mockResolvedValue(undefined);
  mockEmitMissionCompleted.mockResolvedValue(undefined);
  mockEmitMissionFailed.mockResolvedValue(undefined);
  mockAdvanceMissionToReview.mockResolvedValue(undefined);
  mockBuildProviders.mockResolvedValue({
    providers: new Map(),
    registry: mockProviderRegistry,
  });
  mockExecuteAgent.mockResolvedValue(mockAgentRunResult);
  mockAgentDefinitionRegistry.get.mockReturnValue(mockDefinition);
}

const baseEvent = {
  data: {
    runId: 'run_123',
    agentId: 'sophia-content-writer',
    missionId: 'mission_123',
    workspaceId: 'ws_123',
    autonomyLevel: 3,
    inputJson: { prompt: 'Test' },
  },
};

// Typed context builder — replaces untyped casts at every call site.
type ExecutorContext = Parameters<AgentMissionExecutorHandler>[0];

function makeCtx(eventData: typeof baseEvent.data): ExecutorContext {
  return {
    event: { data: eventData },
    step: {
      run: vi.fn<(name: string, fn: () => Promise<unknown>) => Promise<unknown>>(),
      sleep: vi.fn<(name: string, delay: number) => Promise<void>>(),
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('agentMissionExecutor', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('fetches mission and uses creatorId for per-run BYOK registry', async () => {
    await getHandler()(makeCtx(baseEvent.data));

    expect(mockGetMission).toHaveBeenCalledWith('mission_123');
    expect(mockBuildProviders).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'creator_456',
        providers: [
          { id: 'openrouter', label: 'OpenRouter' },
          { id: 'anthropic', label: 'Anthropic' },
        ],
        autoRegister: true,
      })
    );
  });

  it('creates distinct provider instances for different creatorIds (no cross-tenant bleed)', async () => {
    const buildProvidersCalls: Array<{ userId: string | null | undefined }> = [];
    mockBuildProviders.mockImplementation(async (opts: { userId?: string | null; providers: Array<{ id: string; label: string }>; autoRegister: boolean }) => {
      buildProvidersCalls.push({ userId: opts.userId });
      return { providers: new Map(), registry: mockProviderRegistry };
    });

    // Run 1: creator_456
    await getHandler()(makeCtx(baseEvent.data));

    // Run 2: different creator
    mockGetMission.mockResolvedValueOnce({ ...mockMission, creatorId: 'creator_789' });
    await getHandler()(makeCtx({ ...baseEvent.data, runId: 'run_456' }));

    expect(buildProvidersCalls).toHaveLength(2);
    expect(buildProvidersCalls[0].userId).toBe('creator_456');
    expect(buildProvidersCalls[1].userId).toBe('creator_789');
  });

  it('computes budgetRemainingCents from mission.budgetCents - mission.spentCents', async () => {
    await getHandler()(makeCtx(baseEvent.data));

    // Verify executeAgent called with correct budget (10000 - 2000 = 8000)
    expect(mockExecuteAgent).toHaveBeenCalledWith(
      mockDefinition,
      expect.objectContaining({
        budgetRemainingCents: 8000,
      }),
      mockProviderRegistry
    );
  });

  it('fails with BUDGET_EXCEEDED when remaining budget <= 0 (before any provider call)', async () => {
    mockGetMission.mockResolvedValueOnce({ ...mockMission, budgetCents: 1000, spentCents: 1500 });

    let result: { success: false; error: { code: string; message: string } };
    try {
      await getHandler()(makeCtx(baseEvent.data));
    } catch (err) {
      result = { success: false, error: { code: 'BUDGET_EXCEEDED', message: String(err) } };
    }

    expect(result!.success).toBe(false);
    expect(result!.error?.code).toBe('BUDGET_EXCEEDED');
    expect(mockBuildProviders).not.toHaveBeenCalled(); // No provider call
    expect(mockExecuteAgent).not.toHaveBeenCalled();
    expect(mockUpdateAgentRun).toHaveBeenCalledWith(
      'run_123',
      expect.objectContaining({
        status: 'failed',
        errorJson: expect.objectContaining({ code: 'BUDGET_EXCEEDED' }),
      })
    );
  });

  it('pushes mission brief into context.memory as CreativeMemory entry', async () => {
    await getHandler()(makeCtx(baseEvent.data));

    expect(mockExecuteAgent).toHaveBeenCalledWith(
      mockDefinition,
      expect.objectContaining({
        memory: expect.arrayContaining([
          expect.objectContaining({
            workspaceId: 'ws_123',
            category: 'creative',
            key: 'mission_brief',
            value: expect.objectContaining({
              objective: 'Create viral content about AI',
              audience: 'Tech founders',
              constraints: {},
            }),
            confidence: 'high',
            source: 'human_edit',
            scope: 'campaign',
            scopeId: 'mission_123',
          }),
        ]),
      }),
      mockProviderRegistry
    );
  });

  it('records spend on successful execution', async () => {
    await getHandler()(makeCtx(baseEvent.data));

    expect(mockRecordSpend).toHaveBeenCalledWith('mission_123', 150);
  });

  it('fails with MISSION_NOT_FOUND when mission does not exist', async () => {
    mockGetMission.mockResolvedValueOnce(null);

    let result: { success: false; error: { code: string; message: string } };
    try {
      await getHandler()(makeCtx(baseEvent.data));
    } catch (err) {
      result = { success: false, error: { code: 'MISSION_NOT_FOUND', message: String(err) } };
    }

    expect(result!.success).toBe(false);
    expect(result!.error?.code).toBe('MISSION_NOT_FOUND');
    expect(mockBuildProviders).not.toHaveBeenCalled();
    expect(mockExecuteAgent).not.toHaveBeenCalled();
  });

  it('fails with AGENT_NOT_FOUND when agent not registered', async () => {
    mockAgentDefinitionRegistry.get.mockReturnValueOnce(undefined);

    let result: { success: false; error: { code: string; message: string } };
    try {
      await getHandler()(makeCtx(baseEvent.data));
    } catch (err) {
      result = { success: false, error: { code: 'AGENT_NOT_FOUND', message: String(err) } };
    }

    expect(result!.success).toBe(false);
    expect(result!.error?.code).toBe('AGENT_NOT_FOUND');
  });

  it('emits mission.failed and writes failed agent_run on executor error', async () => {
    mockExecuteAgent.mockResolvedValueOnce({
      ok: false,
      error: { code: 'NO_PROVIDER', message: 'No provider available' },
    });

    const result = await getHandler()(makeCtx(baseEvent.data));

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NO_PROVIDER');
    expect(mockEmitMissionFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run_123',
        agentId: 'sophia-content-writer',
        missionId: 'mission_123',
        errorCode: 'NO_PROVIDER',
        errorMessage: 'No provider available',
      })
    );
    expect(mockUpdateAgentRun).toHaveBeenCalledWith(
      'run_123',
      expect.objectContaining({
        status: 'failed',
        errorJson: expect.objectContaining({ code: 'NO_PROVIDER' }),
      })
    );
  });

  it('emits mission.completed and advances to review on success', async () => {
    await getHandler()(makeCtx(baseEvent.data));

    expect(mockEmitMissionCompleted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runId: 'run_123',
        agentId: 'sophia-content-writer',
        missionId: 'mission_123',
        totalCostCents: 150,
        totalTokens: 500,
      })
    );
    expect(mockAdvanceMissionToReview).toHaveBeenCalledWith('mission_123');
  });

  it('handles runtime exceptions and emits RUNTIME_ERROR', async () => {
    mockExecuteAgent.mockRejectedValueOnce(new Error('Network timeout'));

    let result: { success: false; error: { code: string; message: string } };
    try {
      await getHandler()(makeCtx(baseEvent.data));
    } catch (err) {
      result = { success: false, error: { code: 'RUNTIME_ERROR', message: String(err) } };
    }

    expect(result!.success).toBe(false);
    expect(result!.error?.code).toBe('RUNTIME_ERROR');
    expect(mockEmitMissionFailed).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorCode: 'RUNTIME_ERROR',
        errorMessage: 'Network timeout',
      })
    );
  });

  // ── Resume-path tests (retry/resume repair slice) ──────────────────────────

  it('resumes existing run without duplicate create when status is running', async () => {
    // Cron re-dispatched the same runId; row exists with status='running'
    mockGetAgentRun.mockResolvedValue({
      ok: true,
      value: {
        id: 'run_123',
        agentId: 'sophia-content-writer',
        workspaceId: 'ws_123',
        missionId: 'mission_123',
        autonomyLevel: 3,
        status: 'running',
        phase: 'retrying',
        retryCount: 1,
        totalCostCents: 0,
        totalTokens: 0,
        createdAt: Math.floor(Date.now() / 1000),
      },
    });

    const result = await getHandler()(makeCtx(baseEvent.data));

    expect(mockGetAgentRun).toHaveBeenCalledWith('run_123');
    // Resume path must NOT attempt a second INSERT for the same runId
    expect(mockCreateAgentRun).not.toHaveBeenCalled();
    // Execution continues through the full pipeline
    expect(mockGetMission).toHaveBeenCalledWith('mission_123');
    expect(mockExecuteAgent).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('runs normal first-run path with createAgentRun when no existing row', async () => {
    // Default setupMocks(): getAgentRun returns { ok: true, value: null }
    const result = await getHandler()(makeCtx(baseEvent.data));

    expect(mockGetAgentRun).toHaveBeenCalledWith('run_123');
    // Regression guard: first-run INSERT must fire
    expect(mockCreateAgentRun).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('falls through to createAgentRun on terminal status and handles DB_ERROR gracefully', async () => {
    // Row exists but terminal → not resumable → falls to createAgentRun
    mockGetAgentRun.mockResolvedValue({
      ok: true,
      value: {
        id: 'run_terminal',
        agentId: 'sophia-content-writer',
        workspaceId: 'ws_123',
        missionId: 'mission_123',
        autonomyLevel: 3,
        status: 'completed',
        phase: 'completed',
        retryCount: 3,
        totalCostCents: 100,
        totalTokens: 200,
        createdAt: Math.floor(Date.now() / 1000),
      },
    });
    // EXPLICIT per-test mock override: INSERT hits PK violation (row already exists)
    mockCreateAgentRun.mockResolvedValueOnce({
      ok: false,
      error: { code: 'DB_ERROR', message: 'UNIQUE constraint failed: agent_runs.id' },
    });

    // Handler surfaces the failure as a thrown error — handled rejection, not a crash
    await expect(getHandler()(makeCtx({ ...baseEvent.data, runId: 'run_terminal' }))).rejects.toThrow(
      'Failed to create agent_run'
    );
    expect(mockCreateAgentRun).toHaveBeenCalled();
  });

  it('enforces budget check on resume path via getMission', async () => {
    // Resume an existing running run
    mockGetAgentRun.mockResolvedValue({
      ok: true,
      value: {
        id: 'run_budget',
        agentId: 'sophia-content-writer',
        workspaceId: 'ws_123',
        missionId: 'mission_123',
        autonomyLevel: 3,
        status: 'running',
        phase: 'retrying',
        retryCount: 2,
        totalCostCents: 0,
        totalTokens: 0,
        createdAt: Math.floor(Date.now() / 1000),
      },
    });

    await getHandler()(makeCtx({ ...baseEvent.data, runId: 'run_budget' }));

    // Budget still derived from fresh mission row (10000 - 2000 = 8000)
    expect(mockGetMission).toHaveBeenCalledWith('mission_123');
    expect(mockExecuteAgent).toHaveBeenCalledWith(
      mockDefinition,
      expect.objectContaining({ budgetRemainingCents: 8000 }),
      mockProviderRegistry
    );
  });
});