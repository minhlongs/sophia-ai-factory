/**
 * E2E Creative Mission Test — Phase 3.1
 *
 * Full flywheel coverage: create workspace → define CreativeIdentity →
 * create Mission → plan → approve → run agents → track artifacts →
 * record provenance → distribution plan → record performance →
 * run experiment → update CreativeMemory → next recommendations.
 *
 * Uses deterministic in-memory SQLite via node:sqlite (real SQL engine,
 * no hand-rolled mocks). All AI calls are stubbed — no real provider calls.
 *
 * @module __tests__/integration/creative-mission-e2e
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── SQLite shim (bypass Vite bundler) ────────────────────────────────────────

import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

type StatementSync = ReturnType<InstanceType<typeof DatabaseSync>['prepare']>;

function makeD1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      const stmt: StatementSync = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map(p => p === undefined ? null : p);
          return {
            first: async <T = Record<string, unknown>>() =>
              stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() =>
          stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: (sql: string) => db.exec(sql),
    batch: (stmts: unknown[]) => Promise.all(stmts),
  };
}

// ─── Schema bootstrap ─────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS creative_identities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  brand_id TEXT,
  voice_description TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'casual',
  formality REAL NOT NULL DEFAULT 0.5,
  energy REAL NOT NULL DEFAULT 0.5,
  beliefs TEXT NOT NULL DEFAULT '[]',
  positioning TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  forbidden_patterns TEXT NOT NULL DEFAULT '[]',
  required_disclosures TEXT NOT NULL DEFAULT '[]',
  preferred_formats TEXT NOT NULL DEFAULT '[]',
  reference_works TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS creative_missions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  geography TEXT NOT NULL DEFAULT 'global',
  timeframe_start INTEGER NOT NULL DEFAULT 0,
  timeframe_end INTEGER NOT NULL DEFAULT 0,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  autonomy_level INTEGER NOT NULL DEFAULT 0,
  channels TEXT NOT NULL DEFAULT '[]',
  monetization_goals TEXT NOT NULL DEFAULT '[]',
  constraints TEXT NOT NULL DEFAULT '{}',
  success_metrics TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  current_phase TEXT NOT NULL DEFAULT 'ideation',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS creative_goals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_metric TEXT NOT NULL DEFAULT '',
  target_value REAL NOT NULL DEFAULT 0,
  current_value REAL NOT NULL DEFAULT 0,
  timeframe_start INTEGER NOT NULL DEFAULT 0,
  timeframe_end INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS creative_memory (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '[]',
  scope TEXT NOT NULL DEFAULT 'global',
  scope_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS provenance_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  agent_run_id TEXT,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  model TEXT,
  model_version TEXT,
  prompt TEXT,
  source_asset_id TEXT,
  human_edits TEXT,
  approval_id TEXT,
  derivative_of TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  concept_id TEXT,
  story_id TEXT,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'mixed',
  status TEXT NOT NULL DEFAULT 'draft',
  budget_cents INTEGER NOT NULL DEFAULT 0,
  actual_cost_cents INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS derivative_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  source_asset_id TEXT NOT NULL,
  parent_asset_id TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_key TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ip_entities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS distribution_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  channels TEXT NOT NULL DEFAULT '[]',
  schedule_at INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS distribution_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at INTEGER NOT NULL DEFAULT 0,
  posted_at INTEGER,
  analytics TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  autonomy_level INTEGER NOT NULL DEFAULT 0,
  input_json TEXT DEFAULT '{}',
  metadata TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_approvals (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_summary TEXT NOT NULL DEFAULT '',
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_id TEXT,
  comment TEXT,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT 0,
  timeout_at INTEGER
);

CREATE TABLE IF NOT EXISTS agent_run_logs (
  id TEXT PRIMARY KEY,
  agent_run_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS autonomy_configs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_type TEXT NOT NULL DEFAULT 'global',
  level INTEGER NOT NULL DEFAULT 0,
  overrides_json TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS performance_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  value_cents INTEGER NOT NULL DEFAULT 0,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  recorded_at INTEGER NOT NULL DEFAULT 0,
  raw_data TEXT
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  hypothesis TEXT NOT NULL DEFAULT '',
  metric TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  started_at INTEGER,
  ended_at INTEGER,
  winner_variant_id TEXT,
  confidence REAL,
  result TEXT,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  asset_id TEXT,
  traffic_percent REAL NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS experiment_results (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  conversion_rate REAL NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  recorded_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS autonomy_configs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  overrides_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
`;

// ─── Mock getD1 ───────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockGetD1: vi.fn<() => Promise<ReturnType<typeof makeD1> | null>>(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ─── Domain imports (after mocks) ─────────────────────────────────────────────

import { createIdentity } from '@/tree/creative-identity';
import {
  upsertMemory,
  getMemoryByCategory,
  recordLearning,
} from '@/tree/creative-memory';
import { recordProvenance, getProvenanceChain } from '@/tree/provenance';
import {
  createProject,
  createAsset,
  getContentLineage,
} from '@/tree/content-graph';
import { createIP, getIPDerivatives } from '@/tree/ip-graph';
import {
  createDistributionPlan,
  createDistributionAsset,
} from '@/tree/distribution';
import {
  recordPerformanceEvent,
  getPerformanceEvents,
} from '@/tree/performance/events';
import {
  createExperiment,
  startExperiment,
  completeExperiment,
  recordExperimentResult,
  getExperimentResults,
} from '@/tree/performance/experiment';
import { runLearningLoop, getLatestInsights } from '@/tree/learning';
import { executeAgent } from '@/tree/agent-protocol';
import { ProviderRegistry } from '@/seed/ai/provider-registry';
import type { Provider } from '@/seed/ai/provider-interface';
import {
  createMission,
  getMissionWithGoals,
  updateMissionStatus,
  getMissionMetrics,
  createGoal,
  getGoalsByMission,
  createAgentRun,
  createApproval,
  resolveApproval,
  listPendingApprovals,
} from '@/tree/mission';
import { setAutonomyLevel } from '@/tree/autonomy';
import type {
  Mission,
  CreativeGoal,
  CreativeIdentity,
  CreativeMemory,
  ProvenanceRecord,
  ContentProject,
  ContentAsset,
  DistributionPlan,
  PerformanceEvent,
  Experiment,
  AgentDefinition,
  AgentContext,
} from '@/seed/types/creative-domain';
import type { ExperimentResult } from '@/tree/performance/experiment';
import type { ProviderId, ChatResponse, StreamChunk } from '@/seed/ai/provider-interface';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WS = 'ws_e2e_001';
const CREATOR = 'user_e2e_001';
const BRAND = 'brand_e2e_001';
const NOW = Math.floor(Date.now() / 1000);

const mission: Mission = {
  id: 'mission_e2e_001',
  workspaceId: WS,
  creatorId: CREATOR,
  brandId: BRAND,
  title: 'E2E Test Campaign',
  objective: 'Validate full creative economy flywheel',
  audience: 'Tech entrepreneurs aged 25-40',
  geography: 'Vietnam',
  timeframeStart: NOW,
  timeframeEnd: NOW + 90 * 86400,
  budgetCents: 100_000,
  spentCents: 0,
  autonomyLevel: 3,
  channels: ['youtube', 'tiktok'],
  monetizationGoals: ['affiliate_revenue'],
  constraints: { maxDailySpendCents: 5000 },
  successMetrics: { targetViews: 100_000, targetRevenueCents: 50_000 },
  status: 'draft',
  currentPhase: 'ideation',
  createdAt: NOW,
  updatedAt: NOW,
};

const goal: CreativeGoal = {
  id: 'goal_e2e_001',
  workspaceId: WS,
  missionId: 'mission_e2e_001',
  type: 'audience_growth',
  description: 'Grow YouTube subscriber base',
  targetMetric: 'subscribers',
  targetValue: 10_000,
  currentValue: 2_500,
  timeframeStart: NOW,
  timeframeEnd: NOW + 30 * 86400,
  priority: 1,
  status: 'active',
  createdAt: NOW,
  updatedAt: NOW,
};

const identity: CreativeIdentity = {
  id: 'identity_e2e_001',
  workspaceId: WS,
  brandId: BRAND,
  voiceDescription: 'Authoritative yet approachable tech advisor',
  tone: 'warm',
  formality: 0.6,
  energy: 0.7,
  beliefs: ['Innovation through simplicity', 'Data-driven decisions'],
  positioning: 'AI-first creative economy enabler',
  targetAudience: 'Southeast Asian tech entrepreneurs',
  forbiddenPatterns: ['aggressive sales language', 'unsubstantiated claims'],
  requiredDisclosures: ['AI-generated content'],
  preferredFormats: [
    { type: 'video_short', platform: 'youtube', constraints: ['<60s'] },
    { type: 'video_short', platform: 'tiktok', constraints: ['<30s'] },
  ],
  referenceWorks: [],
  version: 1,
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  updatedBy: CREATOR,
};

const contentProject: ContentProject = {
  id: 'project_e2e_001',
  workspaceId: WS,
  missionId: 'mission_e2e_001',
  creatorId: CREATOR,
  brandId: BRAND,
  title: 'AI Video Explainer Series',
  description: '5-part explainer series on creative AI tools',
  format: 'video_short',
  status: 'draft',
  budgetCents: 20_000,
  actualCostCents: 0,
  metadata: {},
  createdAt: NOW,
  updatedAt: NOW,
};

const contentAsset: ContentAsset = {
  id: 'asset_e2e_001',
  projectId: 'project_e2e_001',
  workspaceId: WS,
  type: 'video',
  status: 'draft',
  metadata: {},
  createdAt: NOW,
  updatedAt: NOW,
};

const mockProvider: Provider = {
  id: 'openrouter' as ProviderId,
  label: 'Mock Provider',
  async chat(_messages, _opts) {
    return {
      content: 'Agent analysis complete: the creative direction looks strong.',
      model: 'mock-model-v1',
      provider: 'openrouter',
      usage: { inputTokens: 150, outputTokens: 200 },
      stopReason: 'end_turn',
      latencyMs: 120,
    } as ChatResponse;
  },
  async *stream(_messages, _opts): AsyncGenerator<StreamChunk, void, unknown> {
    yield { delta: 'chunk', done: false } as StreamChunk;
    yield { delta: '', done: true } as StreamChunk;
  },
  countTokens(_messages, _model) { return 100; },
  estimateCost(_messages, _model, _opts?) { return 0; },
  getCapabilities(_model) { return { streaming: false, systemRole: false, maxOutputTokens: 0, maxInputTokens: 0, functionCalling: false, vision: false }; },
};

const agentDef: AgentDefinition = {
  id: 'agent_e2e_001',
  name: 'Creative Analyst',
  role: 'Analyze creative performance and suggest improvements',
  capabilities: ['analysis', 'recommendation'],
  permissions: [
    { tool: 'execute_agent', scopes: ['mission'], requiresApproval: false, maxCostCents: 100 },
    { tool: 'view_mission', scopes: ['mission'], requiresApproval: false },
  ],
  defaultAutonomy: 3,
  maxRetries: 2,
  timeoutMs: 30_000,
  modelPolicy: {
    capability: 'text',
    costPolicy: 'balanced',
    requiredQuality: 0.7,
  },
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Creative Mission E2E — Full Flywheel', () => {
  let db: InstanceType<typeof DatabaseSync>;
  let d1: ReturnType<typeof makeD1>;

  beforeEach(async () => {
    db = new DatabaseSync(':memory:');
    db.exec(SCHEMA);
    d1 = makeD1(db);
    mocks.mockGetD1.mockResolvedValue(d1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Full Flywheel
  // ─────────────────────────────────────────────────────────────────────────

  it('completes full creative economy flywheel end-to-end', async () => {
    // 1. Creative Identity
    const createdIdentity = await createIdentity(identity);
    expect(createdIdentity.id).toBe(identity.id);
    expect(createdIdentity.tone).toBe('warm');
    expect(createdIdentity.beliefs).toContain('Innovation through simplicity');

    // 2. Mission
    const createdMission = await createMission(mission);
    expect(createdMission.id).toBe(mission.id);
    expect(createdMission.status).toBe('draft');
    expect(createdMission.budgetCents).toBe(100_000);

    // 3. Goal
    const createdGoal = await createGoal(goal);
    expect(createdGoal.id).toBe(goal.id);
    expect(createdGoal.status).toBe('active');

    // 4. Mission + Goals joined
    const missionWithGoals = await getMissionWithGoals(mission.id);
    expect(missionWithGoals).not.toBeNull();
    expect(missionWithGoals!.goals).toHaveLength(1);
    expect(missionWithGoals!.goals[0].targetMetric).toBe('subscribers');

    // 5. Mission metrics
    const metrics = await getMissionMetrics(mission.id);
    expect(metrics.missionId).toBe(mission.id);
    expect(metrics.budgetCents).toBe(100_000);
    expect(metrics.spentCents).toBe(0);
    expect(metrics.goalCount).toBe(1);

    // 6. Status transition: draft → planned → approval_required → running
    await updateMissionStatus(mission.id, 'planned', 'planning');
    const planned = await getMissionWithGoals(mission.id);
    expect(planned!.status).toBe('planned');

    await updateMissionStatus(mission.id, 'approval_required', 'planning');
    const approvalRequired = await getMissionWithGoals(mission.id);
    expect(approvalRequired!.status).toBe('approval_required');

    await updateMissionStatus(mission.id, 'running', 'executing');
    const running = await getMissionWithGoals(mission.id);
    expect(running!.status).toBe('running');

    // 7. Autonomy gate — set level 4 (allow all)
    const autonomyResult = await setAutonomyLevel(WS, 4, 'global');
    expect(autonomyResult.ok).toBe(true);

    // 8. Agent Run + Approval
    const agentRunResult = await createAgentRun({
      id: 'run_e2e_001',
      agentId: 'agent_e2e_001',
      workspaceId: WS,
      missionId: mission.id,
      autonomyLevel: 4,
      inputJson: { task: 'Analyze creative performance' },
    });
    expect(agentRunResult.ok).toBe(true);

    const approvalResult = await createApproval({
      id: 'approval_e2e_001',
      agentRunId: 'run_e2e_001',
      actionId: 'action_e2e_001',
      actionType: 'execute_agent',
      actionSummary: 'Run creative analysis on mission',
      estimatedCostCents: 50,
    });
    expect(approvalResult.ok).toBe(true);

    const pendingApprovals = await listPendingApprovals(WS);
    expect(pendingApprovals.ok && pendingApprovals.value.approvals.length).toBeGreaterThanOrEqual(1);

    const resolved = await resolveApproval('approval_e2e_001', 'approved', CREATOR);
    expect(resolved.ok).toBe(true);

    // 9. Execute Agent through autonomy gate
    const registry = new ProviderRegistry(['openrouter']);
    registry.register(mockProvider);

    const agentContext: AgentContext = {
      workspaceId: WS,
      missionId: mission.id,
      projectId: contentProject.id,
      memory: [],
      autonomyLevel: 4,
      budgetRemainingCents: 50_000,
      correlationId: 'corr_e2e_001',
      approvedActionIds: ['execute_agent', 'view_mission'],
    };

    const agentResult = await executeAgent(agentDef, agentContext, registry);
    if (!agentResult.ok) throw new Error(agentResult.error.message);
    expect(agentResult.value.success).toBe(true);
    expect(agentResult.value.costCents).toBeGreaterThanOrEqual(0);

    // 10. Content Project + Asset
    const proj = await createProject(contentProject);
    expect(proj.id).toBe('project_e2e_001');

    const asset = await createAsset(contentAsset);
    expect(asset.id).toBe('asset_e2e_001');

    // 11. Content Lineage
    const lineage = await getContentLineage(contentProject.id);
    expect(lineage).not.toBeNull();
    expect(lineage!.project.id).toBe(contentProject.id);

    // 12. Provenance
    const provRecord: ProvenanceRecord = {
      id: 'prov_e2e_001',
      workspaceId: WS,
      assetId: 'asset_e2e_001',
      agentRunId: 'run_e2e_001',
      action: 'generated',
      actorType: 'agent',
      actorId: 'agent_e2e_001',
      model: 'mock-model-v1',
      metadata: { source: 'e2e-test' },
      createdAt: NOW,
    };
    const prov = await recordProvenance(provRecord);
    expect(prov.id).toBe('prov_e2e_001');

    const chain = await getProvenanceChain('asset_e2e_001');
    expect(chain).toHaveLength(1);
    expect(chain[0].action).toBe('generated');

    // 13. Distribution Plan + Asset
    const distPlan: DistributionPlan = {
      id: 'distplan_e2e_001',
      projectId: contentProject.id,
      workspaceId: WS,
      channels: [
        {
          channel: 'youtube',
          assetId: 'asset_e2e_001',
          title: 'AI Video Explainer',
          settings: { privacy: 'public' },
        },
      ],
      status: 'draft',
      createdAt: NOW,
      updatedAt: NOW,
    };
    const plan = await createDistributionPlan(distPlan);
    expect(plan.id).toBeDefined();

    const distAsset = await createDistributionAsset({
      workspaceId: WS,
      planId: plan.id,
      assetId: 'asset_e2e_001',
      channel: 'youtube',
      status: 'scheduled',
      scheduledAt: NOW + 3600,
      analytics: {},
    });
    expect(distAsset.id).toBeDefined();

    // 14. Performance Events
    const perfEvent: PerformanceEvent = {
      id: 'perf_e2e_001',
      workspaceId: WS,
      assetId: 'asset_e2e_001',
      projectId: contentProject.id,
      entityType: 'asset',
      entityId: 'asset_e2e_001',
      channel: 'youtube',
      eventType: 'view',
      count: 15_000,
      valueCents: 300,
      recordedAt: NOW,
    };
    await recordPerformanceEvent(perfEvent);
    expect(perfEvent.id).toBe('perf_e2e_001');

    const events = await getPerformanceEvents(WS);
    expect(events).toHaveLength(1);
    expect(events[0].count).toBe(15_000);

    // 15. Experiment
    const exp: Experiment = {
      id: 'exp_e2e_001',
      workspaceId: WS,
      projectId: contentProject.id,
      hypothesis: 'Shorter videos get higher retention',
      metric: 'retention_30s',
      variants: [
        {
          id: 'var_a_001',
          experimentId: 'exp_e2e_001',
          name: 'Control',
          description: 'Standard 60s video',
          trafficPercent: 50,
        },
        {
          id: 'var_b_001',
          experimentId: 'exp_e2e_001',
          name: 'Variant B',
          description: 'Shorter 30s video',
          trafficPercent: 50,
        },
      ],
      audience: 'Tech entrepreneurs',
      channel: 'youtube',
      status: 'draft',
      createdAt: NOW,
      updatedAt: NOW,
    };
    await createExperiment(exp);

    const startedExp = await startExperiment('exp_e2e_001');
    expect(startedExp.status).toBe('running');

    await recordExperimentResult('exp_e2e_001', 'var_a_001', {
      sampleSize: 500,
      conversions: 25,
      conversionRate: 5.0,
      revenueCents: 1200,
      metadata: {},
    });
    await recordExperimentResult('exp_e2e_001', 'var_b_001', {
      sampleSize: 500,
      conversions: 40,
      conversionRate: 8.0,
      revenueCents: 2000,
      metadata: {},
    });

    const completedExp = await completeExperiment('exp_e2e_001', { winnerVariantId: 'var_b_001', confidence: 0.95 });
    expect(completedExp.status).toBe('completed');
    expect(completedExp.winnerVariantId).toBe('var_b_001');

    const expResults = await getExperimentResults('exp_e2e_001');
    expect(expResults).toHaveLength(2);

    // 16. Creative Memory
    const memoryEntry: CreativeMemory = {
      id: 'mem_e2e_001',
      workspaceId: WS,
      category: 'performance',
      key: 'best_format_youtube',
      value: { format: 'video_short', avgRetention: 0.72 },
      confidence: 'high',
      source: 'experiment',
      evidence: JSON.stringify(['exp_e2e_001']),
      scope: 'global',
      version: 1,
      isDeleted: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const mem = await upsertMemory(memoryEntry);
    expect(mem.id).toBe('mem_e2e_001');

    const perfMemories = await getMemoryByCategory(WS, 'performance');
    expect(perfMemories.length).toBeGreaterThanOrEqual(1);

    // 17. Learning Loop — closes the flywheel
    const loopResult = await runLearningLoop(WS, mission.id, ['exp_e2e_001']);
    if (!loopResult.ok) throw new Error(loopResult.error.message);
    expect(loopResult.value.insights.length).toBeGreaterThanOrEqual(1);
    expect(loopResult.value.memoriesWritten).toBeGreaterThanOrEqual(1);

    // 18. Verify learning loop wrote to creative memory (mission-scoped)
    const postLoopMemories = await getMemoryByCategory(WS, 'performance', 'mission', mission.id);
    expect(postLoopMemories.length).toBeGreaterThanOrEqual(1);

    // 19. Final mission state
    await updateMissionStatus(mission.id, 'completed', 'completed');
    const finalMission = await getMissionWithGoals(mission.id);
    expect(finalMission!.status).toBe('completed');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Autonomy Deny
  // ─────────────────────────────────────────────────────────────────────────

  it('blocks agent execution when autonomy level is insufficient', async () => {
    await createMission(mission);

    // Level 0 = deny all (default)
    const registry = new ProviderRegistry(['openrouter']);
    registry.register(mockProvider);

    const context: AgentContext = {
      workspaceId: WS,
      missionId: mission.id,
      memory: [],
      autonomyLevel: 0,
      budgetRemainingCents: 50_000,
      correlationId: 'corr_deny_001',
    };

    const result = await executeAgent(agentDef, context, registry);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('AUTONOMY_DENIED');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Provenance Chain
  // ─────────────────────────────────────────────────────────────────────────

  it('tracks multi-step provenance chain for an asset', async () => {
    await createProject(contentProject);
    await createAsset(contentAsset);

    const steps = [
      { action: 'created' as const, actorType: 'human' as const },
      { action: 'generated' as const, actorType: 'agent' as const },
      { action: 'edited' as const, actorType: 'human' as const },
      { action: 'approved' as const, actorType: 'human' as const },
      { action: 'published' as const, actorType: 'system' as const },
    ];

    for (let i = 0; i < steps.length; i++) {
      await recordProvenance({
        id: `prov_chain_${i}`,
        workspaceId: WS,
        assetId: 'asset_e2e_001',
        action: steps[i].action,
        actorType: steps[i].actorType,
        actorId: steps[i].actorType === 'human' ? CREATOR : 'system',
        metadata: { step: i },
        createdAt: NOW + i * 60,
      });
    }

    const chain = await getProvenanceChain('asset_e2e_001');
    expect(chain).toHaveLength(5);
    expect(chain.map((r) => r.action)).toEqual([
      'created',
      'generated',
      'edited',
      'approved',
      'published',
    ]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Budget Enforcement
  // ─────────────────────────────────────────────────────────────────────────

  it('rejects agent when estimated cost exceeds budget', async () => {
    await createMission(mission);
    await setAutonomyLevel(WS, 4, 'global');

    const registry = new ProviderRegistry(['openrouter']);
    registry.register(mockProvider);

    const expensiveAgent: AgentDefinition = {
      ...agentDef,
      id: 'agent_expensive',
      permissions: [
        { tool: 'execute_agent', scopes: ['mission'], requiresApproval: false, maxCostCents: 100_000 },
      ],
    };

    const context: AgentContext = {
      workspaceId: WS,
      missionId: mission.id,
      memory: [],
      autonomyLevel: 4,
      budgetRemainingCents: 500,
      correlationId: 'corr_budget_001',
    };

    const result = await executeAgent(expensiveAgent, context, registry);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('BUDGET_EXCEEDED');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Learning Loop with Experiment Insights
  // ─────────────────────────────────────────────────────────────────────────

  it('learning loop incorporates experiment results into memory and recommendations', async () => {
    await createMission(mission);
    await createGoal(goal);

    // Seed performance data
    await recordPerformanceEvent({
      id: 'perf_loop_001',
      workspaceId: WS,
      assetId: 'asset_001',
      projectId: 'project_001',
      entityType: 'asset',
      entityId: 'asset_001',
      channel: 'youtube',
      eventType: 'view',
      count: 5000,
      valueCents: 150,
      recordedAt: NOW,
    });
    await recordPerformanceEvent({
      id: 'perf_loop_002',
      workspaceId: WS,
      assetId: 'asset_002',
      projectId: 'project_001',
      entityType: 'asset',
      entityId: 'asset_002',
      channel: 'tiktok',
      eventType: 'view',
      count: 12000,
      valueCents: 80,
      recordedAt: NOW,
    });

    // Seed experiment
    const exp: Experiment = {
      id: 'exp_loop_001',
      workspaceId: WS,
      projectId: 'project_001',
      hypothesis: 'TikTok drives more views',
      metric: 'views',
      variants: [
        { id: 'var_loop_a', experimentId: 'exp_loop_001', name: 'A', description: 'YouTube', trafficPercent: 50 },
        { id: 'var_loop_b', experimentId: 'exp_loop_001', name: 'B', description: 'TikTok', trafficPercent: 50 },
      ],
      audience: 'Gen Z',
      channel: 'multi',
      status: 'draft',
      createdAt: NOW,
      updatedAt: NOW,
    };
    await createExperiment(exp);
    await startExperiment('exp_loop_001');
    await recordExperimentResult('exp_loop_001', 'var_loop_a', {
      sampleSize: 200,
      conversions: 10,
      conversionRate: 5.0,
      revenueCents: 500,
      metadata: {},
    });
    await recordExperimentResult('exp_loop_001', 'var_loop_b', {
      sampleSize: 200,
      conversions: 24,
      conversionRate: 12.0,
      revenueCents: 960,
      metadata: {},
    });
    await completeExperiment('exp_loop_001', { winnerVariantId: 'var_loop_b', confidence: 0.98 });

    // Run learning loop
    const result = await runLearningLoop(WS, mission.id, ['exp_loop_001']);
    if (!result.ok) throw new Error(result.error.message);

    const { insights, recommendations, memoriesWritten } = result.value as {
      insights: Array<{ key: string; value: unknown }>;
      recommendations: Array<{ type: string; action: string }>;
      memoriesWritten: number;
    };
    expect(insights.length).toBeGreaterThanOrEqual(1);
    expect(memoriesWritten).toBeGreaterThanOrEqual(1);

    // Insight should identify youtube as best revenue channel
    const channelInsight = insights.find((i) => i.key.startsWith('best_channel_'));
    expect(channelInsight).toBeDefined();
    expect(channelInsight!.value).toHaveProperty('channel', 'youtube');

    // Experiment insight should exist
    const expInsight = insights.find((i) => i.key.startsWith('experiment_winner_'));
    expect(expInsight).toBeDefined();

    // Recommendations should include channel prioritization
    const channelRec = recommendations.find((r) => r.type === 'channel');
    expect(channelRec).toBeDefined();
    expect(channelRec!.action).toContain('youtube');

    // Budget is healthy (< 90%) so no budget recommendation
    const budgetRec = recommendations.find((r) => r.type === 'budget');
    expect(budgetRec).toBeUndefined();

    // Verify insights persisted to creative memory
    const insightsFromMemory = await getMemoryByCategory(WS, 'performance', 'mission', mission.id);
    expect(insightsFromMemory.length).toBeGreaterThanOrEqual(2);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Mission Status Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  it('enforces valid mission status transitions and rejects invalid ones', async () => {
    await createMission(mission);

    const validTransitions: Array<[Mission['status'], Mission['status'], string]> = [
      ['draft', 'planned', 'planning'],
      ['planned', 'approval_required', 'planning'],
      ['approval_required', 'running', 'executing'],
      ['running', 'review', 'reviewing'],
      ['review', 'completed', 'completed'],
    ];

    let current: Mission['status'] = 'draft';
    for (const [from, to, phase] of validTransitions) {
      expect(current).toBe(from);
      const updated = await updateMissionStatus(mission.id, to, phase);
      expect(updated.status).toBe(to);
      current = to;
    }

    // completed → anything else is invalid
    await expect(
      updateMissionStatus(mission.id, 'running', 'retry'),
    ).rejects.toThrow();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Content Lineage
  // ─────────────────────────────────────────────────────────────────────────

  it('traces content lineage through project and assets', async () => {
    await createProject(contentProject);

    const assets: ContentAsset[] = [
      { id: 'asset_lineage_001', projectId: 'project_e2e_001', workspaceId: WS, type: 'script', status: 'draft', metadata: {}, createdAt: NOW, updatedAt: NOW },
      { id: 'asset_lineage_002', projectId: 'project_e2e_001', workspaceId: WS, type: 'storyboard', status: 'draft', metadata: {}, createdAt: NOW, updatedAt: NOW },
      { id: 'asset_lineage_003', projectId: 'project_e2e_001', workspaceId: WS, type: 'video', status: 'draft', metadata: {}, createdAt: NOW, updatedAt: NOW },
    ];

    for (const a of assets) {
      await createAsset(a);
    }

    const lineage = await getContentLineage('project_e2e_001');
    expect(lineage).not.toBeNull();
    expect(lineage!.project.id).toBe('project_e2e_001');
    expect(lineage!.assets.length).toBe(3);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Performance Analytics
  // ─────────────────────────────────────────────────────────────────────────

  it('aggregates performance events by channel', async () => {
    await createProject(contentProject);

    const eventsData: PerformanceEvent[] = [
      { id: 'pe_001', workspaceId: WS, assetId: 'a1', projectId: 'project_e2e_001', entityType: 'asset', entityId: 'a1', channel: 'youtube', eventType: 'view', count: 1000, valueCents: 100, recordedAt: NOW },
      { id: 'pe_002', workspaceId: WS, assetId: 'a2', projectId: 'project_e2e_001', entityType: 'asset', entityId: 'a2', channel: 'youtube', eventType: 'click', count: 200, valueCents: 50, recordedAt: NOW },
      { id: 'pe_003', workspaceId: WS, assetId: 'a3', projectId: 'project_e2e_001', entityType: 'asset', entityId: 'a3', channel: 'tiktok', eventType: 'view', count: 3000, valueCents: 60, recordedAt: NOW },
    ];

    for (const e of eventsData) {
      await recordPerformanceEvent(e);
    }

    const allEvents = await getPerformanceEvents(WS);
    expect(allEvents).toHaveLength(3);

    const ytEvents = allEvents.filter((e) => e.channel === 'youtube');
    const ttEvents = allEvents.filter((e) => e.channel === 'tiktok');
    expect(ytEvents).toHaveLength(2);
    expect(ttEvents).toHaveLength(1);

    const ytRevenue = ytEvents.reduce((s, e) => s + (e.valueCents ?? 0), 0);
    expect(ytRevenue).toBe(150);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9. IP + Derivatives
  // ─────────────────────────────────────────────────────────────────────────

  it('creates IP entities and tracks derivatives', async () => {
    const { createIP } = await import('@/tree/ip-graph');
    const { createDerivative } = await import('@/tree/content-graph');

    const ipEntity = {
      id: 'ip_e2e_001',
      workspaceId: WS,
      type: 'character' as const,
      name: 'Sophia Bot',
      description: 'AI assistant character',
      metadata: { firstAppearance: '2027-01-01' },
      status: 'published' as const,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const createdIP = await createIP(ipEntity);
    expect(createdIP.id).toBe('ip_e2e_001');

    await createProject(contentProject);
    await createAsset(contentAsset);

    const derivative = {
      id: 'deriv_e2e_001',
      workspaceId: WS,
      sourceAssetId: 'asset_e2e_001',
      parentAssetId: 'asset_e2e_001',
      type: 'clip' as const,
      metadata: { sourceProject: 'project_e2e_001' },
      createdAt: NOW,
    };
    await createDerivative(derivative);

    const derivatives = await getIPDerivatives('ip_e2e_001');
    expect(derivatives).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Approvals Flow
  // ─────────────────────────────────────────────────────────────────────────

  it('manages approval lifecycle: create → list pending → resolve', async () => {
    await createMission(mission);

    await createAgentRun({
      id: 'run_approval_001',
      agentId: 'agent_e2e_001',
      workspaceId: WS,
      missionId: mission.id,
      autonomyLevel: 3,
      inputJson: { task: 'Generate content' },
    });

    const r1 = await createApproval({
      id: 'appr_001',
      agentRunId: 'run_approval_001',
      actionId: 'action_001',
      actionType: 'generate_content',
      actionSummary: 'Generate video script for mission',
      estimatedCostCents: 200,
    });
    expect(r1.ok).toBe(true);

    const r2 = await createApproval({
      id: 'appr_002',
      agentRunId: 'run_approval_001',
      actionId: 'action_002',
      actionType: 'publish_content',
      actionSummary: 'Publish video to YouTube',
      estimatedCostCents: 0,
    });
    expect(r2.ok).toBe(true);

    const pending = await listPendingApprovals(WS);
    expect(pending.ok && pending.value.approvals.length).toBe(2);

    const resolved1 = await resolveApproval('appr_001', 'approved', CREATOR);
    expect(resolved1.ok).toBe(true);

    const resolved2 = await resolveApproval('appr_002', 'rejected', CREATOR);
    expect(resolved2.ok).toBe(true);

    const pendingAfter = await listPendingApprovals(WS);
    expect(pendingAfter.ok && pendingAfter.value.approvals.length).toBe(0);
  });
});
