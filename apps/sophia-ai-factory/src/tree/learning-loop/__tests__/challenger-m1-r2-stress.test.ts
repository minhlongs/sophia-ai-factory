/**
 * Empirical Challenger Stress Harness — Milestone M1 Round 2
 *
 * @vitest-environment node
 *
 * Adversarial validation of:
 * - 10 concurrent workers (E2) zero dropped updates and exact oracle bounds across 50 iterations
 * - Cold start race condition (E5) across ALL generated dimensions (hook, duration, channel)
 * - Concurrency scaling (15-20 workers) and retry exhaustion behavior
 * - Cross-dimensional overlapping updates & deadlock prevention
 * - Clock stagnation / same-millisecond rapid CAS updates
 * - Poison values (NaN, Infinity, zero views) under high concurrency
 *
 * Layer: tree
 */

import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  ingestEngagementFeedback,
  calculateViralCES,
  updatePatternScoreCAS,
} from '../scoring-cas';
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

describe('Challenger M1 R2: Empirical Stress & Concurrency Verification', () => {
  // ── CHALLENGE 1: E2 Oracle & Flakiness across 50 repeated concurrency runs ──
  it('C1: 10 concurrent workers (E2) achieves 0 dropped updates and conforms to Oracle envelope across 50 runs', async () => {
    // Calculate individual CES scores for the 10 feedbacks
    const sampleFeedbacks: VideoEngagementFeedback[] = Array.from({ length: 10 }, (_, i) => ({
      videoId: `v_par_${i}`,
      workspaceId: 'ws_stress_e2',
      platform: 'tiktok',
      hookStyle: 'curiosity_gap',
      views: 1000,
      shares: 10 + i * 2,
      completionRate: 0.5 + i * 0.04,
    }));

    const individualCES = sampleFeedbacks.map((fb) => calculateViralCES(fb));
    // Verify each CES is non-negative and finite
    expect(individualCES.every((c) => Number.isFinite(c) && c > 0)).toBe(true);

    // Oracle envelope calculation:
    // Initial: N=1, avg=50.0.
    // In any order, the first 9 updates will use CMA:
    // A_10 = (50.0 * 1 + sum(9 CES values)) / 10
    // Then 10th update uses SES: A_11 = 0.4 * CES_last + 0.6 * A_10.
    // The exact value of A_11 depends only on which feedback is processed last (CES_last).
    const possibleA11Values: number[] = [];
    for (let lastIdx = 0; lastIdx < 10; lastIdx++) {
      const lastCes = individualCES[lastIdx]!;
      const otherCesSum = individualCES.reduce((sum, c, idx) => (idx === lastIdx ? sum : sum + c), 0);
      const a10 = (50.0 * 1 + otherCesSum) / 10;
      const a11 = Math.round((0.4 * lastCes + 0.6 * a10) * 100) / 100;
      possibleA11Values.push(a11);
    }
    const minOracle = Math.min(...possibleA11Values);
    const maxOracle = Math.max(...possibleA11Values);

    const totalRuns = 50;
    let perfectRuns = 0;
    let droppedUpdatesTotal = 0;

    for (let run = 0; run < totalRuns; run++) {
      const d1 = createRealSqliteD1();
      const workspaceId = `ws_c1_run_${run}`;
      const patternId = `pat_${workspaceId}_hook_style_curiosity_gap`;
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
        videoId: `v_par_${run}_${i}`,
        workspaceId,
        platform: 'tiktok',
        hookStyle: 'curiosity_gap',
        views: 1000,
        shares: 10 + i * 2,
        completionRate: 0.5 + i * 0.04,
      }));

      const results = await Promise.all(
        feedbacks.map((fb) => ingestEngagementFeedback(d1, fb, 5))
      );

      const finalRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
        sample_size: number;
        avg_metric: number;
      };

      const successfulCas = results.filter((r) => r.casApplied);
      const dropped = 11 - finalRow.sample_size;
      droppedUpdatesTotal += dropped;

      expect(successfulCas).toHaveLength(10);
      expect(finalRow.sample_size).toBe(11);
      expect(dropped).toBe(0);

      // Verify Oracle expectation: avg_metric MUST match one of the 10 valid permutation endpoints
      // allowing ±0.05 for floating point rounding in CMA/SES intermediate steps
      const matchesOracle = possibleA11Values.some((expected) => Math.abs(finalRow.avg_metric - expected) <= 0.05);
      expect(matchesOracle).toBe(true);
      expect(finalRow.avg_metric).toBeGreaterThanOrEqual(minOracle - 0.05);
      expect(finalRow.avg_metric).toBeLessThanOrEqual(maxOracle + 0.05);

      perfectRuns++;
    }

    expect(perfectRuns).toBe(totalRuns);
    expect(droppedUpdatesTotal).toBe(0);
  }, 30000);

  // ── CHALLENGE 2: Cold start race condition (E5) across ALL dimensions ──
  it('C2: Cold start race condition (E5) verifies 0 dropped updates across ALL generated dimensions', async () => {
    const coldStartRuns = 20;

    for (let run = 0; run < coldStartRuns; run++) {
      const d1 = createRealSqliteD1();
      const workspaceId = `ws_c2_cold_${run}`;

      const feedbacks: VideoEngagementFeedback[] = Array.from({ length: 8 }, (_, i) => ({
        videoId: `v_cold_${run}_${i}`,
        workspaceId,
        platform: 'tiktok',
        hookStyle: 'story_lead',
        views: 1000,
        shares: 10,
        completionRate: 0.6,
      }));

      const results = await Promise.all(
        feedbacks.map((fb) => ingestEngagementFeedback(d1, fb, 5))
      );

      // Verify all workers reported casApplied = true
      expect(results.every((r) => r.casApplied)).toBe(true);

      const allRows = d1.raw.prepare(
        `SELECT id, feature_key, feature_value, sample_size, avg_metric, confidence FROM playbook_patterns WHERE workspace_id = ? ORDER BY id ASC`
      ).all(workspaceId) as Array<{
        id: string;
        feature_key: string;
        feature_value: string;
        sample_size: number;
        avg_metric: number;
        confidence: number;
      }>;

      // Exactly 3 dimensions created: hook_style, duration, channel
      expect(allRows).toHaveLength(3);

      // Invariant: EVERY dimension must have sample_size = 8 without a single lost update
      for (const row of allRows) {
        expect(row.sample_size).toBe(8);
        expect(row.avg_metric).toBeGreaterThan(0);
        expect(row.confidence).toBeGreaterThan(0);
      }
    }
  }, 20000);

  // ── CHALLENGE 3: Scaling concurrency to 16 workers on cold and warm patterns ──
  it('C3: Higher parallelism (16 concurrent workers) maintains 0 dropped updates with adequate retry budget', async () => {
    const d1 = createRealSqliteD1();
    const workspaceId = 'ws_c3_scale_16';
    const patternId = `pat_${workspaceId}_hook_style_problem_agitation`;

    d1.raw.prepare(`
      INSERT INTO playbook_patterns (
        id, workspace_id, feature_key, feature_value, metric,
        avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      patternId, workspaceId, 'hook_style', 'problem_agitation', 'ces',
      50.0, 5, 0.5, 'medium', 'mission', 1000, 1000
    );

    const feedbacks: VideoEngagementFeedback[] = Array.from({ length: 16 }, (_, i) => ({
      videoId: `v_scale_${i}`,
      workspaceId,
      platform: 'youtube_shorts',
      hookStyle: 'problem_agitation',
      views: 2000,
      shares: 30 + i,
      likes: 100 + i * 5,
      completionRate: 0.7,
    }));

    // With 16 workers, retry budget of 8 provides sufficient headroom
    const results = await Promise.all(
      feedbacks.map((fb) => ingestEngagementFeedback(d1, fb, 8))
    );

    const finalRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
      sample_size: number;
      avg_metric: number;
    };

    const successfulCas = results.filter((r) => r.casApplied);
    expect(successfulCas).toHaveLength(16);
    expect(finalRow.sample_size).toBe(21); // 5 initial + 16 updates
  }, 15000);

  // ── CHALLENGE 4: Intersecting dimensions deadlock stress test ──
  it('C4: Multi-dimensional overlapping updates execute concurrently without deadlocks', async () => {
    const d1 = createRealSqliteD1();
    const workspaceId = 'ws_c4_overlap';

    // 4 overlapping permutations of features
    const feedbacks: VideoEngagementFeedback[] = [
      { videoId: 'v1', workspaceId, platform: 'tiktok', hookStyle: 'bold_claim', voiceStyle: 'dynamic_hook', views: 1000 },
      { videoId: 'v2', workspaceId, platform: 'youtube_shorts', hookStyle: 'bold_claim', voiceStyle: 'calm_authoritative', views: 1000 },
      { videoId: 'v3', workspaceId, platform: 'tiktok', hookStyle: 'story_lead', voiceStyle: 'dynamic_hook', views: 1000 },
      { videoId: 'v4', workspaceId, platform: 'youtube_shorts', hookStyle: 'story_lead', voiceStyle: 'calm_authoritative', views: 1000 },
    ];

    // Seed patterns first
    for (const fb of feedbacks) {
      await ingestEngagementFeedback(d1, fb, 5);
    }

    // Now fire 12 concurrent updates with alternating combinations
    const concurrentBatch: VideoEngagementFeedback[] = Array.from({ length: 12 }, (_, i) => {
      const template = feedbacks[i % feedbacks.length]!;
      return {
        ...template,
        videoId: `v_batch_${i}`,
        views: 1000 + i * 100,
        shares: 10 + i * 2,
        completionRate: 0.6,
      };
    });

    const results = await Promise.all(
      concurrentBatch.map((fb) => ingestEngagementFeedback(d1, fb, 6))
    );

    expect(results.every((r) => r.casApplied)).toBe(true);

    const patterns = d1.raw.prepare(
      `SELECT id, sample_size FROM playbook_patterns WHERE workspace_id = ?`
    ).all(workspaceId) as Array<{ id: string; sample_size: number }>;

    expect(patterns.length).toBeGreaterThan(0);
    // Every pattern must have had strictly positive increments
    for (const p of patterns) {
      expect(p.sample_size).toBeGreaterThanOrEqual(1);
    }
  }, 15000);

  // ── CHALLENGE 5: Clock stagnation / Same-millisecond rapid CAS updates ──
  it('C5: Rapid consecutive CAS updates strictly advance detected_at monotonically', async () => {
    const d1 = createRealSqliteD1();
    const patternId = 'pat_stagnation_test';
    const workspaceId = 'ws_stagnation';
    const frozenTime = 1700000000000;

    d1.raw.prepare(`
      INSERT INTO playbook_patterns (
        id, workspace_id, feature_key, feature_value, metric,
        avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      patternId, workspaceId, 'hook_style', 'question', 'ces',
      50.0, 1, 0.1, 'low', 'mission', frozenTime, frozenTime
    );

    // Mock Date.now to return the same timestamp
    const originalDateNow = Date.now;
    Date.now = () => frozenTime;

    try {
      let currentExpected = frozenTime;
      for (let step = 1; step <= 5; step++) {
        const updateRes = await updatePatternScoreCAS(
          patternId,
          currentExpected,
          {
            avgMetric: 50.0 + step,
            sampleSize: 1 + step,
            confidence: 0.2,
            confidenceLevel: 'low',
          },
          3,
          d1
        );

        expect(updateRes.success).toBe(true);
        expect(updateRes.changes).toBe(1);

        const updatedRow = d1.raw.prepare(`SELECT detected_at FROM playbook_patterns WHERE id = ?`).get(patternId) as { detected_at: number };
        // Must strictly advance by at least 1 even when Date.now is frozen
        expect(updatedRow.detected_at).toBeGreaterThan(currentExpected);
        currentExpected = updatedRow.detected_at;
      }
    } finally {
      Date.now = originalDateNow;
    }
  });

  // ── CHALLENGE 6: Numerical stability & Poison values under concurrency ──
  it('C6: Concurrent workers sending un-sanitized values (NaN, Infinity, zero views) maintain DB numeric integrity', async () => {
    const d1 = createRealSqliteD1();
    const workspaceId = 'ws_poison_concurrency';
    const patternId = `pat_${workspaceId}_hook_style_bold_claim`;

    d1.raw.prepare(`
      INSERT INTO playbook_patterns (
        id, workspace_id, feature_key, feature_value, metric,
        avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      patternId, workspaceId, 'hook_style', 'bold_claim', 'ces',
      50.0, 1, 0.1, 'low', 'mission', 1000, 1000
    );

    const feedbacks: VideoEngagementFeedback[] = [
      { videoId: 'p1', workspaceId, platform: 'tiktok', hookStyle: 'bold_claim', views: 0, shares: NaN as unknown as number, completionRate: Infinity as unknown as number },
      { videoId: 'p2', workspaceId, platform: 'tiktok', hookStyle: 'bold_claim', views: -100, shares: -50, completionRate: -0.5 },
      { videoId: 'p3', workspaceId, platform: 'tiktok', hookStyle: 'bold_claim', views: 1000, shares: 10, completionRate: 0.8 },
      { videoId: 'p4', workspaceId, platform: 'tiktok', hookStyle: 'bold_claim', views: undefined, shares: null as unknown as number, completionRate: undefined },
      { videoId: 'p5', workspaceId, platform: 'tiktok', hookStyle: 'bold_claim', views: 500, shares: 20, completionRate: 0.9 },
    ];

    const results = await Promise.all(
      feedbacks.map((fb) => ingestEngagementFeedback(d1, fb, 5))
    );

    expect(results.every((r) => r.casApplied)).toBe(true);

    const finalRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
      sample_size: number;
      avg_metric: number;
      confidence: number;
    };

    expect(finalRow.sample_size).toBe(6); // 1 initial + 5 updates
    expect(Number.isFinite(finalRow.avg_metric)).toBe(true);
    expect(finalRow.avg_metric).toBeGreaterThanOrEqual(0);
    expect(finalRow.avg_metric).toBeLessThanOrEqual(100);
    expect(Number.isFinite(finalRow.confidence)).toBe(true);
    expect(finalRow.confidence).toBeGreaterThanOrEqual(0);
    expect(finalRow.confidence).toBeLessThanOrEqual(1);
  });
});
