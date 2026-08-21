/**
 * Mission metrics integration tests — DB-backed via D1 shim.
 * Tests: getMissionMetrics aggregation across missions, goals, agent runs,
 *        content projects, performance events.
 *
 * @module tree/mission/__tests__/integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1, SCHEMA, mockGetD1 } from '@/__tests__/integration/shared-d1-shim';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (p: string) => {
    exec(s: string): void;
    prepare(s: string): {
      get(...p: unknown[]): unknown;
      all(...p: unknown[]): unknown[];
      run(...p: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

const { getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({ getD1: vi.fn() }));

beforeEach(() => {
  vi.mocked(getD1).mockReset();
});

function setupDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return makeD1(db);
}

async function insertMission(d1: ReturnType<typeof makeD1>, row: Record<string, unknown>) {
  await d1
    .prepare(
      `INSERT INTO creative_missions
         (id, workspace_id, creator_id, brand_id, title, objective, audience, geography,
          timeframe_start, timeframe_end, budget_cents, spent_cents, autonomy_level,
          channels, monetization_goals, constraints, success_metrics,
          status, current_phase, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id, row.workspace_id, row.creator_id, row.brand_id ?? null,
      row.title, row.objective, row.audience, row.geography,
      row.timeframe_start ?? 0, row.timeframe_end ?? 0,
      row.budget_cents ?? 0, row.spent_cents ?? 0, row.autonomy_level ?? 3,
      JSON.stringify(row.channels ?? []), JSON.stringify(row.monetization_goals ?? []),
      JSON.stringify(row.constraints ?? {}), JSON.stringify(row.success_metrics ?? {}),
      row.status ?? 'draft', row.current_phase ?? 'init',
      row.created_at ?? 100, row.updated_at ?? 100,
    )
    .run();
}

describe('getMissionMetrics — aggregation', () => {
  it('returns zeroed metrics for nonexistent mission', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    const { getMissionMetrics } = await import('@/tree/mission/types');
    const m = await getMissionMetrics('ghost');

    expect(m.missionId).toBe('ghost');
    expect(m.budgetCents).toBe(0);
    expect(m.spentCents).toBe(0);
    expect(m.budgetRemainingCents).toBe(0);
    expect(m.spendPercent).toBe(0);
    expect(m.goalCount).toBe(0);
    expect(m.goals).toEqual([]);
    expect(m.agentRunCount).toBe(0);
    expect(m.contentProjectCount).toBe(0);
    expect(m.performanceEventCount).toBe(0);
    expect(m.revenueCents).toBe(0);
  });

  it('aggregates budget, goals, runs, projects, revenue', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    await insertMission(d1, {
      id: 'msn_met', workspace_id: 'ws', creator_id: 'u', brand_id: null,
      title: 'T', objective: 'O', audience: 'A', geography: 'G',
      budget_cents: 5000, spent_cents: 1250, autonomy_level: 3,
      status: 'running', current_phase: 'execution',
    });

    // goals
    await d1.prepare(`INSERT INTO creative_goals (id, workspace_id, mission_id, type, description, target_metric, target_value, current_value, timeframe_start, timeframe_end, priority, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind('g1', 'ws', 'msn_met', 'reach', 'Reach', 'audience_size', 1000, 250, 0, 0, 1, 'active', 100, 100).run();
    await d1.prepare(`INSERT INTO creative_goals (id, workspace_id, mission_id, type, description, target_metric, target_value, current_value, timeframe_start, timeframe_end, priority, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind('g2', 'ws', 'msn_met', 'revenue', 'Revenue', 'revenue_cents', 1000, 100, 0, 0, 2, 'active', 100, 100).run();

    // agent runs
    await d1.prepare(`INSERT INTO agent_runs (id, agent_id, workspace_id, mission_id, autonomy_level, input_json, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind('ar1', 'ag', 'ws', 'msn_met', 3, '{}', '{}', 100).run();
    await d1.prepare(`INSERT INTO agent_runs (id, agent_id, workspace_id, mission_id, autonomy_level, input_json, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind('ar2', 'ag', 'ws', 'msn_met', 3, '{}', '{}', 100).run();

    // content project
    await d1.prepare(`INSERT INTO content_projects (id, workspace_id, mission_id, concept_id, story_id, creator_id, brand_id, title, description, format, status, budget_cents, actual_cost_cents, metadata, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind('proj1', 'ws', 'msn_met', null, null, 'u', null, 'P', '', 'video', 'draft', 0, 0, '{}', 100, 100).run();

    // performance events linked to project
    await d1.prepare(`INSERT INTO performance_events (id, workspace_id, asset_id, project_id, entity_type, entity_id, channel, event_type, count, value_cents, recorded_at, raw_data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind('pe1', 'ws', '', 'proj1', 'video', 'v1', 'youtube', 'view', 100, 300, 100, null).run();
    await d1.prepare(`INSERT INTO performance_events (id, workspace_id, asset_id, project_id, entity_type, entity_id, channel, event_type, count, value_cents, recorded_at, raw_data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind('pe2', 'ws', '', 'proj1', 'video', 'v2', 'youtube', 'click', 50, 200, 100, null).run();

    const { getMissionMetrics } = await import('@/tree/mission/types');
    const m = await getMissionMetrics('msn_met');

    expect(m.budgetCents).toBe(5000);
    expect(m.spentCents).toBe(1250);
    expect(m.budgetRemainingCents).toBe(3750);
    expect(m.spendPercent).toBe(25); // 1250/5000 * 100 = 25
    expect(m.goalCount).toBe(2);
    expect(m.agentRunCount).toBe(2);
    expect(m.contentProjectCount).toBe(1);
    expect(m.performanceEventCount).toBe(2);
    expect(m.revenueCents).toBe(500); // 300 + 200
    expect(m.goals).toHaveLength(2);
    // goals are ordered by priority DESC (g2 priority=2 first, then g1 priority=1)
    expect(m.goals[0].progressPercent).toBe(10); // 100/1000 * 100
    expect(m.goals[1].progressPercent).toBe(25); // 250/1000 * 100
  });

  it('handles zero budget without division by zero', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    await insertMission(d1, {
      id: 'msn_zerobudget', workspace_id: 'ws', creator_id: 'u', brand_id: null,
      title: 'T', objective: 'O', audience: 'A', geography: 'G',
      budget_cents: 0, spent_cents: 0, autonomy_level: 3,
      status: 'draft', current_phase: 'init',
    });

    const { getMissionMetrics } = await import('@/tree/mission/types');
    const m = await getMissionMetrics('msn_zerobudget');
    expect(m.spendPercent).toBe(0);
    expect(m.budgetRemainingCents).toBe(0);
  });
});