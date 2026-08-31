/**
 * Unit tests: Reality Loop insights (Phase J).
 *
 * Covers: mission funnel, creative acceptance, human corrections, agent
 * failure taxonomy, mission cost, memory usage, economic snapshot (null
 * when absent), and feedback aggregates. Real in-memory D1 via the shared
 * shim — no fake-pass mocks.
 *
 * @module land/reality-loop/__tests__/insights
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockCreateServerClient, mockGetD1 } = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockGetD1: vi.fn(),
}));
vi.mock('@/seed/db/client', () => ({
  createServerClient: mockCreateServerClient,
  getD1: mockGetD1,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getRealityLoopInsights } from '../insights';

const PERFORMANCE_EVENTS_SCHEMA = `
CREATE TABLE IF NOT EXISTS performance_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  asset_id TEXT NOT NULL DEFAULT '',
  project_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  channel TEXT,
  event_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  value_cents INTEGER NOT NULL DEFAULT 0,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  recorded_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  raw_data TEXT
);`;

// Matches migration 0263 (creative_economic_snapshot).
const ECONOMIC_SNAPSHOT_SCHEMA = `
CREATE TABLE IF NOT EXISTS creative_economic_snapshot (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  creative_cost INTEGER,
  production_cost INTEGER,
  distribution_cost INTEGER,
  leads INTEGER,
  conversions INTEGER,
  revenue INTEGER,
  recorded_at INTEGER NOT NULL DEFAULT 0
);`;

const REALITY_FEEDBACK_SCHEMA = `
CREATE TABLE IF NOT EXISTS reality_feedback (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  checkpoint TEXT NOT NULL,
  useful TEXT NOT NULL,
  reason TEXT,
  free_text TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT 0
);`;

// creative_missions is provided by the shared D1 shim (matches migration
// 0233) — it is the mission funnel source of truth since the MED-3 fix:
// insights reads status from creative_missions, not performance_events
// (mission.completed has no production writer).

function setupDb(): ReturnType<typeof freshDb> {
  const raw = freshDb();
  raw.exec(PERFORMANCE_EVENTS_SCHEMA);
  raw.exec(ECONOMIC_SNAPSHOT_SCHEMA);
  raw.exec(REALITY_FEEDBACK_SCHEMA);
  mockCreateServerClient.mockReturnValue(makeD1(raw));
  // feedback-store uses getD1() — point it at the same raw DB.
  mockGetD1.mockResolvedValue(makeD1(raw));
  return raw;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function insertEvent(
  raw: ReturnType<typeof freshDb>,
  event: {
    id: string;
    workspaceId: string;
    eventType: string;
    count?: number;
    valueCents?: number;
    metricsJson?: string;
  },
): void {
  raw.exec(
    `INSERT INTO performance_events
       (id, workspace_id, entity_type, entity_id, event_type, count, value_cents, metrics_json, recorded_at)
     VALUES (
       '${event.id}', '${event.workspaceId}', 'mission', 'm-${event.id}',
       '${event.eventType}', ${event.count ?? 1}, ${event.valueCents ?? 0},
       '${event.metricsJson ?? '{}'}', ${Date.now()})`,
  );
}

describe('getRealityLoopInsights', () => {
  it('computes mission funnel from creative_missions status, creative acceptance from events, and derived rates', async () => {
    const raw = setupDb();
    // MED-3 fix: funnel reads creative_missions.status (source of truth), not
    // performance_events — mission.completed has no production writer.
    raw.exec(
      `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status) VALUES
         ('m1', 'ws-1', 'u-1', 'Mission 1', 'draft'),
         ('m2', 'ws-1', 'u-1', 'Mission 2', 'running'),
         ('m3', 'ws-1', 'u-1', 'Mission 3', 'completed'),
         ('m4', 'ws-1', 'u-1', 'Mission 4', 'review'),
         ('m5', 'ws-2', 'u-2', 'Mission 5', 'completed')`,
    );
    insertEvent(raw, { id: 'a1', workspaceId: 'ws-1', eventType: 'creative.accepted' });
    insertEvent(raw, { id: 'a2', workspaceId: 'ws-1', eventType: 'creative.accepted' });
    insertEvent(raw, { id: 'r1', workspaceId: 'ws-1', eventType: 'creative.rejected' });
    insertEvent(raw, { id: 'e1', workspaceId: 'ws-1', eventType: 'creative.edited' });

    const insights = await getRealityLoopInsights('ws-1');
    // 4 missions in ws-1 (m5 belongs to ws-2 — workspace-scoped).
    expect(insights.missionsCreated).toBe(4);
    // 'completed' (m3) + 'review' (m4) — review is the terminal success state
    // set by advanceMissionToReview; it never auto-completes.
    expect(insights.missionsCompleted).toBe(2);
    expect(insights.completionRate).toBeCloseTo(0.5);
    expect(insights.creativeAccepted).toBe(2);
    expect(insights.creativeRejected).toBe(1);
    expect(insights.acceptanceRate).toBeCloseTo(2 / 3);
    expect(insights.humanCorrections).toBe(1);
    expect(insights.correctionRate).toBeCloseTo(0.5); // 1 correction / 2 completions
  });

  it('aggregates agent.failed taxonomy from metrics_json', async () => {
    const raw = setupDb();
    insertEvent(raw, {
      id: 'f1',
      workspaceId: 'ws-1',
      eventType: 'agent.failed',
      count: 3,
      metricsJson: '{"failure_class":"TIMEOUT"}',
    });
    insertEvent(raw, {
      id: 'f2',
      workspaceId: 'ws-1',
      eventType: 'agent.failed',
      count: 2,
      metricsJson: '{"failure_class":"PROVIDER_ERROR"}',
    });
    insertEvent(raw, {
      id: 'f3',
      workspaceId: 'ws-1',
      eventType: 'agent.failed',
      count: 1,
      metricsJson: '{"failure_class":"TIMEOUT"}',
    });

    const insights = await getRealityLoopInsights('ws-1');
    expect(insights.agentFailureTotal).toBe(6);
    const timeout = insights.agentFailures.find((f) => f.failureClass === 'TIMEOUT');
    const provider = insights.agentFailures.find((f) => f.failureClass === 'PROVIDER_ERROR');
    expect(timeout?.count).toBe(4);
    expect(provider?.count).toBe(2);
  });

  it('sums mission cost and memory usage', async () => {
    const raw = setupDb();
    insertEvent(raw, { id: 'mc1', workspaceId: 'ws-1', eventType: 'mission.cost_recorded', valueCents: 1500 });
    insertEvent(raw, { id: 'mc2', workspaceId: 'ws-1', eventType: 'mission.cost_recorded', valueCents: 500 });
    insertEvent(raw, { id: 'mu1', workspaceId: 'ws-1', eventType: 'memory.used', count: 10 });
    insertEvent(raw, { id: 'mcu1', workspaceId: 'ws-1', eventType: 'memory.corrected', count: 3 });

    const insights = await getRealityLoopInsights('ws-1');
    expect(insights.missionCostCents).toBe(2000);
    expect(insights.memory.used).toBe(10);
    expect(insights.memory.corrected).toBe(3);
    expect(insights.memory.correctionRate).toBeCloseTo(0.3);
  });

  it('returns null economic outcomes when snapshot table is empty', async () => {
    setupDb();
    const insights = await getRealityLoopInsights('ws-1');
    expect(insights.economic.revenueCents).toBeNull();
    expect(insights.economic.costCents).toBeNull();
    expect(insights.economic.netCents).toBeNull();
    expect(insights.economic.roiPct).toBeNull();
  });

  it('reads the latest economic snapshot when present', async () => {
    const raw = setupDb();
    // Earlier snapshot (recorded_at = 1000).
    raw.exec(
      `INSERT INTO creative_economic_snapshot
         (id, workspace_id, mission_id, creative_cost, production_cost, distribution_cost, revenue, recorded_at)
       VALUES ('e1', 'ws-1', 'm1', 2000, 1500, 500, 10000, 1000)`,
    );
    // Latest snapshot (recorded_at = 2000) — this one is read.
    raw.exec(
      `INSERT INTO creative_economic_snapshot
         (id, workspace_id, mission_id, creative_cost, production_cost, distribution_cost, revenue, recorded_at)
       VALUES ('e2', 'ws-1', 'm2', 3000, 1500, 500, 20000, 2000)`,
    );

    const insights = await getRealityLoopInsights('ws-1');
    // costCents = 3000 + 1500 + 500 = 5000.
    expect(insights.economic.revenueCents).toBe(20000);
    expect(insights.economic.costCents).toBe(5000);
    // netCents = 20000 - 5000 = 15000.
    expect(insights.economic.netCents).toBe(15000);
    // roiPct = (20000 - 5000) / 5000 * 100 = 300.0.
    expect(insights.economic.roiPct).toBe(300.0);
  });

  it('returns null rates when denominators are zero (no signal)', async () => {
    setupDb();
    const insights = await getRealityLoopInsights('ws-1');
    expect(insights.completionRate).toBeNull();
    expect(insights.acceptanceRate).toBeNull();
    expect(insights.correctionRate).toBeNull();
    expect(insights.memory.correctionRate).toBeNull();
  });

  it('includes feedback aggregates from Phase E', async () => {
    const raw = setupDb();
    raw.exec(
      `INSERT INTO reality_feedback (id, workspace_id, mission_id, checkpoint, useful, reason, idempotency_key, created_at)
       VALUES ('fb1', 'ws-1', 'm1', 'mission_complete', 'YES', NULL, 'loop_m1_mission_complete_2026-08-30', ${Date.now()})`,
    );
    raw.exec(
      `INSERT INTO reality_feedback (id, workspace_id, mission_id, checkpoint, useful, reason, idempotency_key, created_at)
       VALUES ('fb2', 'ws-1', 'm2', 'creative_rejected', 'NO', 'LOW_QUALITY', 'loop_m2_creative_rejected_2026-08-30', ${Date.now()})`,
    );

    const insights = await getRealityLoopInsights('ws-1');
    expect(insights.feedback).not.toBeNull();
    expect(insights.feedback?.total).toBe(2);
    expect(insights.feedback?.usefulYes).toBe(1);
    expect(insights.feedback?.usefulNo).toBe(1);
    expect(insights.feedback?.topReasons[0]?.reason).toBe('LOW_QUALITY');
  });
});
