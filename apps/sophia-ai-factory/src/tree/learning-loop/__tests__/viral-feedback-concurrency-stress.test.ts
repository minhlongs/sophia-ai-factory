/**
 * Empirical Concurrency & Stress Harness for Milestone M1
 *
 * @vitest-environment node
 *
 * Adversarial validation of:
 * - Race conditions under concurrent `ingestEngagementFeedback`
 * - Stale write overwrites (Lost Update anomaly) in `updatePatternScoreCAS`
 * - High concurrency contention and retry exhaustion
 * - Lexicographical sorting order for deadlock prevention
 * - State corruption in `avg_metric` and `sample_size`
 *
 * Layer: tree
 */

import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { ingestEngagementFeedback } from '../scoring-cas';
import type { VideoEngagementFeedback } from '@/seed/types/creative-intelligence';

function createRealSqliteD1() {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS playbook_patterns (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      feature_key TEXT NOT NULL,
      feature_value TEXT NOT NULL,
      metric TEXT NOT NULL,
      avg_metric REAL NOT NULL,
      sample_size INTEGER NOT NULL,
      confidence REAL NOT NULL,
      confidence_level TEXT NOT NULL DEFAULT 'medium',
      source TEXT NOT NULL DEFAULT 'experiment',
      detected_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uidx_playbook_patterns_upsert
      ON playbook_patterns(workspace_id, feature_key, feature_value, metric);
  `);

  const d1Wrapper = {
    prepare: (sql: string) => {
      const stmt = db.prepare(sql);
      return {
        bind: (...args: unknown[]) => {
          return {
            first: async <T>() => {
              const res = stmt.get(...args);
              return (res ?? null) as T;
            },
            all: async <T>() => {
              const res = stmt.all(...args);
              return { results: res as T[], success: true };
            },
            run: async () => {
              const info = stmt.run(...args);
              return {
                success: true,
                meta: { changes: Number(info.changes), duration: 1 },
              };
            },
          };
        },
      };
    },
    raw: db,
  };

  return d1Wrapper as unknown as D1Database & { raw: DatabaseSync };
}

describe('Milestone M1 Empirical Stress Harness: Concurrency, Deadlocks & OCC CAS Integrity', () => {
  it('E1: Verifies Zero Lost Updates under 2 concurrent workers (OCC CAS retry re-reads latest row)', async () => {
    const d1 = createRealSqliteD1();
    const workspaceId = 'ws_stress_e1';
    const patternId = 'pat_ws_stress_e1_hook_style_bold_claim';
    const initialDetectedAt = 1000;

    // Seed pattern: sample_size = 5, avg_metric = 50.0
    d1.raw.prepare(`
      INSERT INTO playbook_patterns (
        id, workspace_id, feature_key, feature_value, metric,
        avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      patternId, workspaceId, 'hook_style', 'bold_claim', 'ces',
      50.0, 5, 0.5, 'medium', 'mission', initialDetectedAt, initialDetectedAt
    );

    // Feedback 1: hookStyle only, to isolate the exact pattern
    const feedback1: VideoEngagementFeedback = {
      videoId: 'v1',
      workspaceId,
      platform: 'tiktok',
      hookStyle: 'bold_claim',
      views: 10_000,
      shares: 300,
      likes: 1100,
      completionRate: 0.8,
    };

    // Feedback 2: hookStyle only
    const feedback2: VideoEngagementFeedback = {
      videoId: 'v2',
      workspaceId,
      platform: 'tiktok',
      hookStyle: 'bold_claim',
      views: 10_000,
      shares: 350,
      likes: 1000,
      impressions: 10_000,
      clicks: 500,
      conversions: 50,
      completionRate: 0.9,
    };

    const [res1, res2] = await Promise.all([
      ingestEngagementFeedback(d1, feedback1),
      ingestEngagementFeedback(d1, feedback2),
    ]);

    const finalRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
      sample_size: number;
      avg_metric: number;
      detected_at: number;
    };

    process.stderr.write(`\n=== E1: 2 Concurrent Workers Results ===\n` +
      `res1: casApplied=${res1.casApplied}, newScore=${res1.newScore}, sampleSize=${res1.sampleSize}\n` +
      `res2: casApplied=${res2.casApplied}, newScore=${res2.newScore}, sampleSize=${res2.sampleSize}\n` +
      `Final DB row: sample_size=${finalRow.sample_size}, avg_metric=${finalRow.avg_metric}\n` +
      `Expected sample_size: 7 (5 initial + 2 updates)\n` +
      `Observed sample_size: ${finalRow.sample_size}\n` +
      `Lost update detected: ${finalRow.sample_size < 7}\n` +
      `========================================\n`);

    expect(res1.casApplied).toBe(true);
    expect(res2.casApplied).toBe(true);
    // Invariant: Zero lost updates — 5 initial + 2 concurrent updates must yield exactly 7
    expect(finalRow.sample_size).toBe(7);
  });

  it('E2: Verifies High Parallelism Concurrency (10 concurrent workers on same pattern with zero data loss)', async () => {
    const d1 = createRealSqliteD1();
    const workspaceId = 'ws_stress_e2';
    const patternId = 'pat_ws_stress_e2_hook_style_curiosity_gap';
    const initialDetectedAt = 1000;

    d1.raw.prepare(`
      INSERT INTO playbook_patterns (
        id, workspace_id, feature_key, feature_value, metric,
        avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      patternId, workspaceId, 'hook_style', 'curiosity_gap', 'ces',
      50.0, 1, 0.1, 'low', 'mission', initialDetectedAt, initialDetectedAt
    );

    const feedbacks: VideoEngagementFeedback[] = Array.from({ length: 10 }, (_, i) => ({
      videoId: `v_par_${i}`,
      workspaceId,
      platform: 'tiktok',
      hookStyle: 'curiosity_gap',
      views: 1000,
      shares: 10 + i * 2,
      completionRate: 0.5 + (i * 0.04),
    }));

    const results = await Promise.all(
      feedbacks.map((fb) => ingestEngagementFeedback(d1, fb, 5))
    );

    const finalRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
      sample_size: number;
      avg_metric: number;
    };

    const successfulCas = results.filter((r) => r.casApplied);
    const exhaustedCas = results.filter((r) => !r.casApplied);
    const droppedCount = 11 - finalRow.sample_size;

    process.stderr.write(`\n=== E2: 10 Concurrent Workers Results ===\n` +
      `Total concurrent workers: 10\n` +
      `Successful CAS reported: ${successfulCas.length}\n` +
      `Exhausted CAS reported: ${exhaustedCas.length}\n` +
      `Expected DB sample_size: 11 (1 initial + 10 updates)\n` +
      `Actual DB sample_size: ${finalRow.sample_size}\n` +
      `Total Dropped Updates: ${droppedCount} (${Math.round((droppedCount / 10) * 100)}% data loss)\n` +
      `Final avg_metric: ${finalRow.avg_metric}\n` +
      `=========================================\n`);

    // Invariant: Zero dropped updates under high parallelism
    expect(finalRow.sample_size).toBe(11);
    expect(droppedCount).toBe(0);
    expect(successfulCas.length).toBe(10);
    expect(exhaustedCas.length).toBe(0);
  });

  it('E3: Verifies Mathematical Convergence in moving average under concurrency', async () => {
    const d1 = createRealSqliteD1();
    const workspaceId = 'ws_stress_e3';
    const patternId = 'pat_ws_stress_e3_hook_style_statistic_reveal';
    const initialDetectedAt = 1000;

    // Initial state: N=2, avg=50.0 (sum = 100)
    d1.raw.prepare(`
      INSERT INTO playbook_patterns (
        id, workspace_id, feature_key, feature_value, metric,
        avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      patternId, workspaceId, 'hook_style', 'statistic_reveal', 'ces',
      50.0, 2, 0.2, 'low', 'mission', initialDetectedAt, initialDetectedAt
    );

    // Two feedbacks with known CES scores:
    // Feedback A: CES = 80.0
    // Feedback B: CES = 20.0
    // If both updates are ingested accurately:
    // Oracle CMA: (50.0 * 2 + 80.0 + 20.0) / 4 = 200 / 4 = 50.0, sample_size = 4
    const feedbackA: VideoEngagementFeedback = {
      videoId: 'vA',
      workspaceId,
      platform: 'tiktok',
      hookStyle: 'statistic_reveal',
      views: 1000,
      shares: 24, // S = 0.8 -> 24
      completionRate: 0.8, // R = 0.8 -> 28
      likes: 140, // E = 1.0 -> 20
      impressions: 1000,
      clicks: 80,
      conversions: 8, // C = 0.533 -> 8
      // Total CES ~ 80
    };

    const feedbackB: VideoEngagementFeedback = {
      videoId: 'vB',
      workspaceId,
      platform: 'tiktok',
      hookStyle: 'statistic_reveal',
      views: 1000,
      completionRate: 0.5, // R = 0.5 -> 17.5
      // Total CES ~ 17.5
    };

    await Promise.all([
      ingestEngagementFeedback(d1, feedbackA),
      ingestEngagementFeedback(d1, feedbackB),
    ]);

    const finalRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
      sample_size: number;
      avg_metric: number;
    };

    process.stderr.write(`\n=== E3: Mathematical Divergence Results ===\n` +
      `Oracle sample_size: 4\n` +
      `Actual sample_size: ${finalRow.sample_size}\n` +
      `Actual avg_metric: ${finalRow.avg_metric}\n` +
      `===========================================\n`);

    // Invariant: Both feedback updates ingested accurately
    expect(finalRow.sample_size).toBe(4);
    expect(finalRow.avg_metric).toBeCloseTo(49.92, 1);
  });

  it('E4: Validates Lexicographical Sorting Order across multiple pattern updates', async () => {
    const d1 = createRealSqliteD1();
    const workspaceId = 'ws_sort_verify';

    // Seed 4 patterns with deliberate reverse-alphabetical IDs
    const patterns = [
      { id: 'pat_z_hook', key: 'hook_style', val: 'bold_claim' },
      { id: 'pat_m_voice', key: 'voice_style', val: 'calm_authoritative' },
      { id: 'pat_a_channel', key: 'channel', val: 'tiktok' },
    ];

    for (const p of patterns) {
      d1.raw.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric,
          avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        p.id, workspaceId, p.key, p.val, 'ces',
        60.0, 5, 0.5, 'medium', 'mission', 1000, 1000
      );
    }

    const feedback: VideoEngagementFeedback = {
      videoId: 'v_sort',
      workspaceId,
      hookStyle: 'bold_claim',
      voiceStyle: 'calm_authoritative',
      platform: 'tiktok',
      views: 1000,
      shares: 20,
    };

    const result = await ingestEngagementFeedback(d1, feedback);
    expect(result.casApplied).toBe(true);

    // Verify order of updatedPatterns is strictly sorted by patternId
    const updatedIds = result.updatedPatterns!.map((p) => p.patternId);
    const sortedIds = [...updatedIds].sort((a, b) => a.localeCompare(b));

    process.stderr.write(`\n=== E4: Lexicographical Sorting Results ===\n` +
      `Processed Order: ${JSON.stringify(updatedIds)}\n` +
      `Sorted Expected: ${JSON.stringify(sortedIds)}\n` +
      `Lexicographical sorting verified: ${JSON.stringify(updatedIds) === JSON.stringify(sortedIds)}\n` +
      `===========================================\n`);

    expect(updatedIds).toEqual(sortedIds);
  });

  it('E5: Cold start race condition — verifies INSERT ON CONFLICT DO NOTHING followed by CAS retains all updates', async () => {
    const d1 = createRealSqliteD1();
    const workspaceId = 'ws_cold_test';

    const feedbacks: VideoEngagementFeedback[] = Array.from({ length: 8 }, (_, i) => ({
      videoId: `v_cold_${i}`,
      workspaceId,
      platform: 'tiktok',
      hookStyle: 'story_lead',
      views: 1000,
      shares: 10,
    }));

    // 8 concurrent cold inserts for the exact same pattern
    const results = await Promise.all(
      feedbacks.map((fb) => ingestEngagementFeedback(d1, fb, 5))
    );

    const allRows = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE workspace_id = 'ws_cold_test'`).all();
    const hookRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = 'pat_ws_cold_test_hook_style_story_lead'`).get() as {
      id: string;
      sample_size: number;
    };

    process.stderr.write(`\n=== E5: Cold Start Race Results ===\n` +
      `Total concurrent cold inserts: 8\n` +
      `Rows created in DB: ${allRows.length} (Expected: 2 dimensions)\n` +
      `Final sample_size for hook: ${hookRow?.sample_size} (Expected 8 without lost updates)\n` +
      `Cold start dropped updates: ${8 - (hookRow?.sample_size ?? 0)}\n` +
      `===================================\n`);

    // Proves that ON CONFLICT DO NOTHING correctly preserved unique rows for 3 dimensions (hook, duration, channel)
    expect(allRows).toHaveLength(3);
    // Invariant: Cold start inserts + subsequent CAS updates retain all updates
    expect(hookRow.sample_size).toBe(8);
  });
});
