/**
 * Experiment store integration tests — DB-backed via D1 shim.
 *
 * Proves the migration-0254 tables (experiments / experiment_variants /
 * experiment_results) work end-to-end through tree/performance/experiment.ts:
 *   1. Store round-trip: create → get → list → start → complete
 *   2. getExperimentResults returns real rows for the learning loop
 *   3. runLearningLoop consumes those rows and produces a winner insight
 *   4. Concurrency KPI: 12 concurrent experiment creations all succeed
 *      (row-per-experiment schema, no global locks)
 *
 * @module tree/performance/__tests__/experiment-integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1, SCHEMA, mockGetD1 } from '@/__tests__/integration/shared-d1-shim';
import type { Experiment } from '@/seed/types/creative-domain';

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

function makeExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: 'exp_int_001',
    workspaceId: 'ws',
    projectId: 'proj1',
    hypothesis: 'Variant B thumbnail beats A on CTR',
    metric: 'click_through_rate',
    audience: 'auto',
    channel: 'thumbnail',
    status: 'draft',
    variants: [
      {
        id: 'exp_int_001_a',
        experimentId: 'exp_int_001',
        name: 'A',
        description: 'Control thumbnail',
        trafficPercent: 50,
      },
      {
        id: 'exp_int_001_b',
        experimentId: 'exp_int_001',
        name: 'B',
        description: 'Challenger thumbnail',
        assetId: 'https://example.com/b.jpg',
        trafficPercent: 50,
      },
    ],
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

describe('Experiment store — D1 round trip', () => {
  it('creates and reads back an experiment with variants', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    const { createExperiment, getExperiment } = await import(
      '@/tree/performance/experiment'
    );

    await createExperiment(makeExperiment());
    const loaded = await getExperiment('exp_int_001');

    expect(loaded.id).toBe('exp_int_001');
    expect(loaded.workspaceId).toBe('ws');
    expect(loaded.status).toBe('draft');
    expect(loaded.variants).toHaveLength(2);
    expect(loaded.variants.map((v) => v.name).sort()).toEqual(['A', 'B']);
    expect(loaded.variants[1].assetId).toBe('https://example.com/b.jpg');
  });

  it('lists experiments filtered by workspace and status', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    const { createExperiment, listExperiments } = await import(
      '@/tree/performance/experiment'
    );

    const minimal = (id: string, workspaceId: string): Partial<Experiment> => ({
      id,
      workspaceId,
      projectId: '',
      hypothesis: '',
      metric: '',
      audience: '',
      channel: '',
      variants: [
        { id: `${id}_a`, experimentId: id, name: 'A', description: '', trafficPercent: 50 },
        { id: `${id}_b`, experimentId: id, name: 'B', description: '', trafficPercent: 50 },
      ],
    });

    await createExperiment(makeExperiment(minimal('exp_l1', 'ws')));
    await createExperiment(
      makeExperiment({ ...minimal('exp_l2', 'ws'), status: 'running', startedAt: 100 }),
    );
    await createExperiment(makeExperiment(minimal('exp_other', 'ws2')));

    const all = await listExperiments('ws');
    expect(all.map((e) => e.id).sort()).toEqual(['exp_l1', 'exp_l2']);

    const running = await listExperiments('ws', { status: 'running' });
    expect(running.map((e) => e.id)).toEqual(['exp_l2']);
  });

  it('enforces valid status transitions draft → running → completed', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    const { createExperiment, getExperiment, startExperiment, completeExperiment } =
      await import('@/tree/performance/experiment');

    await createExperiment(makeExperiment());

    // Invalid first: draft → completed must be rejected
    await expect(completeExperiment('exp_int_001')).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });

    await startExperiment('exp_int_001');
    expect((await getExperiment('exp_int_001')).status).toBe('running');

    const done = await completeExperiment('exp_int_001', {
      winnerVariantId: 'exp_int_001_b',
      confidence: 0.95,
      result: 'B won by 20% CTR',
    });
    expect(done.status).toBe('completed');
    expect(done.winnerVariantId).toBe('exp_int_001_b');
    expect(done.confidence).toBe(0.95);

    // Terminal state: further transitions rejected
    await expect(startExperiment('exp_int_001')).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });

  it('records and retrieves results including corrupt-metadata fallback', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    const { createExperiment, recordExperimentResult, getExperimentResults } =
      await import('@/tree/performance/experiment');

    await createExperiment(makeExperiment({ status: 'running', startedAt: 100 }));
    await recordExperimentResult('exp_int_001', 'exp_int_001_a', {
      sampleSize: 200,
      conversions: 20,
      conversionRate: 10,
      revenueCents: 500,
      metadata: { source: 'cron' },
    });
    await recordExperimentResult('exp_int_001', 'exp_int_001_b', {
      sampleSize: 200,
      conversions: 40,
      conversionRate: 20,
      revenueCents: 900,
      metadata: {},
    });

    const results = await getExperimentResults('exp_int_001');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.experimentId === 'exp_int_001')).toBe(true);

    const best = results.reduce((a, b) => (a.conversionRate > b.conversionRate ? a : b));
    expect(best.variantId).toBe('exp_int_001_b');
    expect(best.conversionRate).toBe(20);
    expect(best.metadata).toEqual({});

    // Corrupt metadata row survives with a debug marker instead of crashing
    await d1
      .prepare(`INSERT INTO experiment_results
        (id, experiment_id, variant_id, sample_size, conversions, conversion_rate, revenue_cents, metadata, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind('er_bad', 'exp_int_001', 'exp_int_001_a', 10, 1, 10, 0, '{not-json', 200)
      .run();
    const after = await getExperimentResults('exp_int_001');
    const corrupt = after.find((r) => r.id === 'er_bad');
    expect(corrupt?.metadata).toMatchObject({ _corrupt: true });
  });
});

describe('Learning loop integration — 0254 end-to-end', () => {
  it('produces a winner insight from seeded experiment results', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    await insertRow(d1, 'creative_missions', {
      id: 'msn_e2e', workspace_id: 'ws', creator_id: 'u', brand_id: null,
      title: 'T', objective: 'O', audience: 'A', geography: 'G',
      timeframe_start: 0, timeframe_end: 0, budget_cents: 10000, spent_cents: 0,
      autonomy_level: 3, channels: '[]', monetization_goals: '[]',
      constraints: '{}', success_metrics: '{}', status: 'running',
      current_phase: 'execution', created_at: 100, updated_at: 100,
    });

    const { createExperiment } = await import('@/tree/performance/experiment');
    await createExperiment(
      makeExperiment({ status: 'completed', startedAt: 100, endedAt: 200, updatedAt: 200 }),
    );
    await insertRow(d1, 'experiment_results', {
      id: 'er_a', experiment_id: 'exp_int_001', variant_id: 'exp_int_001_a',
      sample_size: 300, conversions: 15, conversion_rate: 5.0,
      revenue_cents: 150, metadata: '{}', recorded_at: 200,
    });
    await insertRow(d1, 'experiment_results', {
      id: 'er_b', experiment_id: 'exp_int_001', variant_id: 'exp_int_001_b',
      sample_size: 300, conversions: 45, conversion_rate: 15.0,
      revenue_cents: 600, metadata: '{}', recorded_at: 200,
    });

    const { runLearningLoop } = await import('@/tree/learning/learning-loop');
    const result = await runLearningLoop('ws', 'msn_e2e', ['exp_int_001']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const insight = result.value.insights.find(
      (i) => i.key === 'experiment_winner_exp_int_001',
    );
    expect(insight).toBeDefined();
    expect(insight!.value).toMatchObject({
      experimentId: 'exp_int_001',
      variantId: 'exp_int_001_b',
      conversionRate: 15.0,
      sampleSize: 300,
    });
    expect(insight!.confidence).toBe('high'); // sampleSize >= 100
    // Memory persisted for future missions
    expect(result.value.memoriesWritten).toBeGreaterThanOrEqual(1);
  });

  it('skips experiments with no results without failing the loop', async () => {
    const d1 = setupDb();
    mockGetD1(d1);

    await insertRow(d1, 'creative_missions', {
      id: 'msn_skip', workspace_id: 'ws', creator_id: 'u', brand_id: null,
      title: 'T', objective: 'O', audience: 'A', geography: 'G',
      timeframe_start: 0, timeframe_end: 0, budget_cents: 10000, spent_cents: 0,
      autonomy_level: 3, channels: '[]', monetization_goals: '[]',
      constraints: '{}', success_metrics: '{}', status: 'running',
      current_phase: 'execution', created_at: 100, updated_at: 100,
    });

    const { createExperiment } = await import('@/tree/performance/experiment');
    await createExperiment(
      makeExperiment({ id: 'exp_no_results', status: 'running', startedAt: 100 }),
    );

    const { runLearningLoop } = await import('@/tree/learning/learning-loop');
    const result = await runLearningLoop('ws', 'msn_skip', ['exp_no_results']);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.insights.some((i) => i.key.startsWith('experiment_winner_'))).toBe(false);
  });
});

async function insertRow(
  d1: ReturnType<typeof makeD1>,
  table: string,
  row: Record<string, unknown>,
) {
  const cols = Object.keys(row);
  const placeholders = cols.map((_, i) => `?${i + 1}`).join(', ');
  await d1
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
    .bind(...cols.map((c) => row[c]))
    .run();
}

describe('Concurrency KPI — 12 concurrent experiments', () => {
  it('creates 12 experiments concurrently without loss or corruption', async () => {
    const d1 = setupDb();
    mockGetD1(d1);
    const { createExperiment, getExperiment, newExperimentId } = await import(
      '@/tree/performance/experiment'
    );

    const ids = Array.from({ length: 12 }, () => newExperimentId());
    const experiments = ids.map((id, i) =>
      makeExperiment({
        id,
        workspaceId: 'ws_kpi',
        projectId: `proj_${i}`,
        hypothesis: '',
        metric: '',
        audience: '',
        channel: '',
        variants: [
          { id: `${id}_a`, experimentId: id, name: 'A', description: '', trafficPercent: 50 },
          { id: `${id}_b`, experimentId: id, name: 'B', description: '', trafficPercent: 50 },
        ],
      }),
    );

    // All 12 creations in flight simultaneously — row-per-experiment schema
    // means no global lock contention; every write must succeed.
    const results = await Promise.allSettled(experiments.map((e) => createExperiment(e)));
    const failures = results.filter((r) => r.status === 'rejected');
    expect(failures).toHaveLength(0);

    // Every experiment readable back with exactly its own 2 variants
    const loaded = await Promise.all(ids.map((id) => getExperiment(id)));
    expect(loaded).toHaveLength(12);
    for (const exp of loaded) {
      expect(exp.workspaceId).toBe('ws_kpi');
      expect(exp.variants).toHaveLength(2);
      expect(exp.variants.every((v) => v.experimentId === exp.id)).toBe(true);
    }

    // No cross-contamination: 24 variant rows total, unique ids
    const varRows = await d1
      .prepare(`SELECT COUNT(*) AS n FROM experiment_variants WHERE experiment_id LIKE '%'`)
      .first<{ n: number }>();
    expect(varRows?.n).toBe(24);
  }, 30_000);
});
