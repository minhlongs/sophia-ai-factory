/**
 * Learning Loop integration tests — DB-backed via D1 shim.
 * Tests: runLearningLoop, getLatestInsights, analyzePerformance,
 *        extractExperimentInsights, generateRecommendations
 *
 * @module tree/learning/__tests__/integration
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

async function insertRow(d1: ReturnType<typeof makeD1>, table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const placeholders = cols.map((_, i) => `?${i + 1}`).join(', ');
  await d1
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
    .bind(...cols.map((c) => row[c]))
    .run();
}

describe('Learning Loop — runLearningLoop', () => {
  it('writes memories and recommendations from performance events', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    // mission + goals for metrics
    await insertRow(d1, 'creative_missions', {
      id: 'msn_learn', workspace_id: 'ws', creator_id: 'u', brand_id: null,
      title: 'T', objective: 'O', audience: 'A', geography: 'G',
      timeframe_start: 0, timeframe_end: 0, budget_cents: 10000, spent_cents: 0,
      autonomy_level: 3, channels: '[]', monetization_goals: '[]',
      constraints: '{}', success_metrics: '{}', status: 'running',
      current_phase: 'execution', created_at: 100, updated_at: 100,
    });

    // performance events — youtube is the best channel
    await insertRow(d1, 'performance_events', {
      id: 'pe1', workspace_id: 'ws', asset_id: '', project_id: 'proj1',
      entity_type: 'video', entity_id: 'v1', channel: 'youtube',
      event_type: 'view', count: 100, value_cents: 500, recorded_at: 100,
    });
    await insertRow(d1, 'performance_events', {
      id: 'pe2', workspace_id: 'ws', asset_id: '', project_id: 'proj1',
      entity_type: 'video', entity_id: 'v2', channel: 'tiktok',
      event_type: 'view', count: 50, value_cents: 100, recorded_at: 100,
    });
    // content project so perf events count toward mission
    await insertRow(d1, 'content_projects', {
      id: 'proj1', workspace_id: 'ws', mission_id: 'msn_learn', concept_id: null,
      story_id: null, creator_id: 'u', brand_id: null, title: 'P',
      description: '', format: 'video', status: 'draft',
      budget_cents: 0, actual_cost_cents: 0, metadata: '{}',
      created_at: 100, updated_at: 100,
    });

    const { runLearningLoop } = await import('@/tree/learning/learning-loop');
    const result = await runLearningLoop('ws', 'msn_learn');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.memoriesWritten).toBeGreaterThanOrEqual(1);
    expect(result.value.insights.some((i) => i.key.startsWith('best_channel_'))).toBe(true);
    expect(result.value.recommendations.some((r) => r.type === 'channel')).toBe(true);
  });

  it('returns DB_UNAVAILABLE error when D1 is null', async () => {
    vi.mocked(getD1).mockResolvedValue(null as never);

    const { runLearningLoop } = await import('@/tree/learning/learning-loop');
    // LearningLoopError is a type alias, not a class — check result shape
    const result = await runLearningLoop('ws', 'msn_none');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DB_UNAVAILABLE');
  });

  it('handles empty workspace with no events', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    await insertRow(d1, 'creative_missions', {
      id: 'msn_empty', workspace_id: 'ws', creator_id: 'u', brand_id: null,
      title: 'T', objective: 'O', audience: 'A', geography: 'G',
      timeframe_start: 0, timeframe_end: 0, budget_cents: 0, spent_cents: 0,
      autonomy_level: 3, channels: '[]', monetization_goals: '[]',
      constraints: '{}', success_metrics: '{}', status: 'draft',
      current_phase: 'init', created_at: 100, updated_at: 100,
    });

    const { runLearningLoop } = await import('@/tree/learning/learning-loop');
    const result = await runLearningLoop('ws', 'msn_empty');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.memoriesWritten).toBe(0);
    expect(result.value.insights).toEqual([]);
  });

  it('extracts experiment winner insights', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    await insertRow(d1, 'creative_missions', {
      id: 'msn_exp', workspace_id: 'ws', creator_id: 'u', brand_id: null,
      title: 'T', objective: 'O', audience: 'A', geography: 'G',
      timeframe_start: 0, timeframe_end: 0, budget_cents: 0, spent_cents: 0,
      autonomy_level: 3, channels: '[]', monetization_goals: '[]',
      constraints: '{}', success_metrics: '{}', status: 'running',
      current_phase: 'execution', created_at: 100, updated_at: 100,
    });

    // experiment + variants + results
    await insertRow(d1, 'experiments', {
      id: 'exp1', workspace_id: 'ws', project_id: 'proj1',
      hypothesis: 'H', metric: 'M', audience: '', channel: '',
      status: 'completed', started_at: 100, ended_at: 200,
      winner_variant_id: 'var_a', confidence: 0.9, result: 'win',
      created_at: 100, updated_at: 200,
    });
    await insertRow(d1, 'experiment_variants', {
      id: 'var_a', experiment_id: 'exp1', name: 'A', description: '',
      asset_id: null, traffic_percent: 50,
    });
    await insertRow(d1, 'experiment_variants', {
      id: 'var_b', experiment_id: 'exp1', name: 'B', description: '',
      asset_id: null, traffic_percent: 50,
    });
    await insertRow(d1, 'experiment_results', {
      id: 'er1', experiment_id: 'exp1', variant_id: 'var_a',
      sample_size: 200, conversions: 20, conversion_rate: 10.0,
      revenue_cents: 500, metadata: '{}', recorded_at: 200,
    });
    await insertRow(d1, 'experiment_results', {
      id: 'er2', experiment_id: 'exp1', variant_id: 'var_b',
      sample_size: 200, conversions: 10, conversion_rate: 5.0,
      revenue_cents: 200, metadata: '{}', recorded_at: 200,
    });

    const { runLearningLoop } = await import('@/tree/learning/learning-loop');
    const result = await runLearningLoop('ws', 'msn_exp', ['exp1']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expInsight = result.value.insights.find((i) => i.key === 'experiment_winner_exp1');
    expect(expInsight).toBeDefined();
    expect(expInsight!.value).toHaveProperty('variantId', 'var_a');
    expect(expInsight!.confidence).toBe('high'); // sampleSize >= 100
  });

  it('generates budget recommendation when spend exceeds 90%', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    await insertRow(d1, 'creative_missions', {
      id: 'msn_burn', workspace_id: 'ws', creator_id: 'u', brand_id: null,
      title: 'T', objective: 'O', audience: 'A', geography: 'G',
      timeframe_start: 0, timeframe_end: 0, budget_cents: 1000, spent_cents: 950,
      autonomy_level: 3, channels: '[]', monetization_goals: '[]',
      constraints: '{}', success_metrics: '{}', status: 'running',
      current_phase: 'execution', created_at: 100, updated_at: 100,
    });

    const { runLearningLoop } = await import('@/tree/learning/learning-loop');
    const result = await runLearningLoop('ws', 'msn_burn');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.recommendations.some((r) => r.type === 'budget')).toBe(true);
  });
});

describe('Learning Loop — getLatestInsights', () => {
  it('returns memories by category', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    await insertRow(d1, 'creative_memory', {
      id: 'mem1', workspace_id: 'ws', category: 'performance',
      key: 'best_channel_youtube', value: JSON.stringify({ channel: 'youtube' }),
      confidence: 'high', source: 'learning-loop',
      evidence: 'youtube generated 500c', scope: 'global', scope_id: null,
      version: 1, is_deleted: 0, created_at: 100, updated_at: 100,
      expires_at: null,
    });

    const { getLatestInsights } = await import('@/tree/learning/learning-loop');
    const insights = await getLatestInsights('ws', 'performance');

    expect(insights).toHaveLength(1);
    expect(insights[0].key).toBe('best_channel_youtube');
  });

  it('returns empty array when no memories exist', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    const { getLatestInsights } = await import('@/tree/learning/learning-loop');
    const insights = await getLatestInsights('ws_empty', 'performance');
    expect(insights).toEqual([]);
  });
});

describe('Learning Loop — barrel export', () => {
  it('exports all expected functions', async () => {
    const mod = await import('@/tree/learning/index');
    expect(typeof mod.runLearningLoop).toBe('function');
    expect(typeof mod.getLatestInsights).toBe('function');
    // recordLearning/upsertMemory/getMemoryByCategory are re-exported via the
    // creative-memory barrel — verify from source
    const mem = await import('@/tree/creative-memory/index');
    expect(typeof mem.recordLearning).toBe('function');
    expect(typeof mem.upsertMemory).toBe('function');
    expect(typeof mem.getMemoryByCategory).toBe('function');
  });
});