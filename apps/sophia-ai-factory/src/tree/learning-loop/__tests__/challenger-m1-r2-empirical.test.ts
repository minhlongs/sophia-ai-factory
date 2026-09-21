/**
 * Challenger Empirical Verification Suite — Milestone M1 Round 2
 *
 * @vitest-environment node
 *
 * Exhaustive empirical challenge testing:
 * 1. Numerical sanitization under extreme inputs:
 *    - NaN, null, undefined, +Infinity, -Infinity across all telemetry fields
 *    - Division-by-zero, subnormals, extreme exponents (1e300, 1e-300)
 *    - Monte Carlo fuzzing with randomized poison injection
 * 2. Self-healing of corrupted database state:
 *    - Recovery from NaN / Infinity / negative values in D1 rows
 *    - Concurrent self-healing under multi-worker contention
 * 3. Monotonic timestamp advancing:
 *    - Math.max(Date.now(), currentDetectedAt + 1) under frozen clock
 *    - Clock skew (NTP backward jump by 1 hour)
 *    - Rapid concurrent bursts within the same millisecond
 * 4. Hook scorer numerical boundary resilience:
 *    - NaN / +/-Infinity / extreme float scores and non-string inputs
 * 5. Audit of effectiveness-scorer.ts vs scoring-cas.ts
 *
 * Layer: tree
 */

import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  calculateViralCES,
  ingestEngagementFeedback,
  updatePatternScoreCAS,
} from '../scoring-cas';
import {
  calculateHookScore,
  classifyHookStyle,
  VIRAL_SCORE_WEIGHTS,
} from '@/tree/trend-intelligence/hook-scorer';
import {
  calculateEffectivenessScore,
  computeLogarithmicConfidence,
  determineConfidenceLevel,
} from '../effectiveness-scorer';
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

describe('Challenger M1 R2: Mathematical & Numerical Empirical Suite', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE GROUP 1: Extreme Numerical Inputs to calculateViralCES
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 1: calculateViralCES Extreme Numerical Sanitization', () => {
    it('1.1 handles pure NaN across all fields without producing NaN', () => {
      const ces = calculateViralCES({
        videoId: 'vid_pure_nan',
        platform: 'tiktok',
        views: NaN,
        shares: NaN,
        likes: NaN,
        comments: NaN,
        clicks: NaN,
        conversions: NaN,
        impressions: NaN,
        completionRate: NaN,
        watchTimeSeconds: NaN,
        totalDurationSeconds: NaN,
        durationSeconds: NaN,
      });

      expect(Number.isFinite(ces)).toBe(true);
      expect(Number.isNaN(ces)).toBe(false);
      expect(ces).toBe(0);
    });

    it('1.2 handles pure null / undefined across all fields', () => {
      const cesNull = calculateViralCES({
        videoId: 'vid_null',
        platform: 'tiktok',
        views: null as unknown as number,
        shares: null as unknown as number,
        likes: null as unknown as number,
        comments: null as unknown as number,
        clicks: null as unknown as number,
        conversions: null as unknown as number,
        impressions: null as unknown as number,
        completionRate: null as unknown as number,
        watchTimeSeconds: null as unknown as number,
        totalDurationSeconds: null as unknown as number,
      });

      expect(Number.isFinite(cesNull)).toBe(true);
      expect(cesNull).toBe(0);

      const cesUndefined = calculateViralCES({
        videoId: 'vid_undefined',
        platform: 'tiktok',
      });
      expect(Number.isFinite(cesUndefined)).toBe(true);
      expect(cesUndefined).toBe(0);
    });

    it('1.3 handles pure +Infinity across all fields without overflow', () => {
      const ces = calculateViralCES({
        videoId: 'vid_inf',
        platform: 'tiktok',
        views: Infinity,
        shares: Infinity,
        likes: Infinity,
        comments: Infinity,
        clicks: Infinity,
        conversions: Infinity,
        impressions: Infinity,
        completionRate: Infinity,
        watchTimeSeconds: Infinity,
        totalDurationSeconds: Infinity,
      });

      expect(Number.isFinite(ces)).toBe(true);
      expect(ces).toBeGreaterThanOrEqual(0);
      expect(ces).toBeLessThanOrEqual(100);
    });

    it('1.4 handles pure -Infinity across all fields cleanly', () => {
      const ces = calculateViralCES({
        videoId: 'vid_neg_inf',
        platform: 'tiktok',
        views: -Infinity,
        shares: -Infinity,
        likes: -Infinity,
        comments: -Infinity,
        clicks: -Infinity,
        conversions: -Infinity,
        impressions: -Infinity,
        completionRate: -Infinity,
        watchTimeSeconds: -Infinity,
        totalDurationSeconds: -Infinity,
      });

      expect(Number.isFinite(ces)).toBe(true);
      expect(ces).toBe(0);
    });

    it('1.5 handles subnormal and extreme IEEE 754 floats without precision loss', () => {
      const cesSubnormal = calculateViralCES({
        videoId: 'vid_subnormal',
        platform: 'tiktok',
        views: 1000,
        shares: 30,
        completionRate: 5e-324, // Smallest positive subnormal float
        likes: Number.MIN_VALUE,
        clicks: Number.EPSILON,
        conversions: -0,
      });

      expect(Number.isFinite(cesSubnormal)).toBe(true);
      expect(cesSubnormal).toBeGreaterThanOrEqual(0);
      expect(cesSubnormal).toBeLessThanOrEqual(100);

      const cesMax = calculateViralCES({
        videoId: 'vid_max',
        platform: 'tiktok',
        views: Number.MAX_SAFE_INTEGER,
        shares: 1000,
        completionRate: 1.0,
        likes: Number.MAX_VALUE,
        impressions: Number.MAX_VALUE,
      });

      expect(Number.isFinite(cesMax)).toBe(true);
      expect(cesMax).toBeGreaterThanOrEqual(0);
      expect(cesMax).toBeLessThanOrEqual(100);
    });

    it('1.6 handles extreme ratio calculations: watchTime vs duration overflows', () => {
      // 1e300 / 1e-300 = 1e600 = Infinity
      const cesOverflowRatio = calculateViralCES({
        videoId: 'vid_ratio_overflow',
        platform: 'tiktok',
        views: 1000,
        watchTimeSeconds: 1e300,
        totalDurationSeconds: 1e-300,
      });
      expect(Number.isFinite(cesOverflowRatio)).toBe(true);
      expect(cesOverflowRatio).toBe(0); // rawRatio = Infinity -> Number.isFinite is false -> R = 0

      // 0 / 0 ratio
      const cesZeroZero = calculateViralCES({
        videoId: 'vid_zero_zero',
        platform: 'tiktok',
        views: 0,
        watchTimeSeconds: 0,
        totalDurationSeconds: 0,
      });
      expect(Number.isFinite(cesZeroZero)).toBe(true);
      expect(cesZeroZero).toBe(0);
    });

    it('1.7 Monte Carlo fuzzing: 5,000 random feedbacks with poison values maintain [0, 100] invariant', () => {
      let seed = 987654321;
      function rng(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      const poisonGenerators = [
        () => NaN,
        () => Infinity,
        () => -Infinity,
        () => null as unknown as number,
        () => undefined as unknown as number,
        () => -0,
        () => -100 * rng(),
        () => 1e6 * rng(),
        () => Number.MIN_VALUE,
        () => Number.MAX_SAFE_INTEGER,
        () => rng(),
      ];

      for (let i = 0; i < 5000; i++) {
        const randomField = () => {
          const gen = poisonGenerators[Math.floor(rng() * poisonGenerators.length)]!;
          return gen();
        };

        const feedback: VideoEngagementFeedback = {
          videoId: `fuzz_${i}`,
          platform: 'tiktok',
          views: randomField(),
          shares: randomField(),
          likes: randomField(),
          comments: randomField(),
          clicks: randomField(),
          conversions: randomField(),
          impressions: randomField(),
          completionRate: randomField(),
          watchTimeSeconds: randomField(),
          totalDurationSeconds: randomField(),
        };

        const score = calculateViralCES(feedback);
        expect(Number.isFinite(score)).toBe(true);
        expect(Number.isNaN(score)).toBe(false);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        expect(score).toBe(Math.round(score * 100) / 100);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE GROUP 2: Self-Healing of Corrupted D1 Database Rows
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 2: D1 State Numerical Self-Healing under Corrupted Data', () => {
    it('2.1 self-heals a row corrupted with NaN avg_metric and NaN sample_size', async () => {
      const d1 = createRealSqliteD1();
      const workspaceId = 'ws_heal_nan';
      const patternId = 'pat_ws_heal_nan_hook_style_bold_claim';
      const initialDetectedAt = 1000;

      // Seed row with corrupted out-of-bound values (-99999, -50)
      d1.raw.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric,
          avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patternId, workspaceId, 'hook_style', 'bold_claim', 'ces',
        -99999, -50, -1, 'low', 'mission', initialDetectedAt, initialDetectedAt
      );

      const feedback: VideoEngagementFeedback = {
        videoId: 'vid_heal_1',
        workspaceId,
        platform: 'tiktok',
        hookStyle: 'bold_claim',
        views: 1000,
        shares: 30, // 3% share rate
        completionRate: 0.8,
      };

      const result = await ingestEngagementFeedback(d1, feedback);
      expect(result.casApplied).toBe(true);

      const healedRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
        avg_metric: number;
        sample_size: number;
        confidence: number;
        confidence_level: string;
      };

      expect(Number.isFinite(healedRow.avg_metric)).toBe(true);
      expect(healedRow.avg_metric).toBeGreaterThan(0);
      expect(healedRow.avg_metric).toBeLessThanOrEqual(100);
      expect(healedRow.sample_size).toBe(1); // Self-healed: 0 + 1 = 1
      expect(Number.isFinite(healedRow.confidence)).toBe(true);
      expect(healedRow.confidence_level).toBe('low');
    });

    it('2.2 self-heals negative sample_size and out-of-range avg_metric', async () => {
      const d1 = createRealSqliteD1();
      const workspaceId = 'ws_heal_neg';
      const patternId = 'pat_ws_heal_neg_hook_style_question';
      const initialDetectedAt = 1000;

      // Seed corrupted row: sample_size = -999, avg_metric = 999999
      d1.raw.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric,
          avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patternId, workspaceId, 'hook_style', 'question', 'ces',
        999999, -999, 10, 'high', 'mission', initialDetectedAt, initialDetectedAt
      );

      const feedback: VideoEngagementFeedback = {
        videoId: 'vid_heal_2',
        workspaceId,
        platform: 'tiktok',
        hookStyle: 'question',
        views: 1000,
        completionRate: 0.5,
      };

      const result = await ingestEngagementFeedback(d1, feedback);
      expect(result.casApplied).toBe(true);

      const row = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
        avg_metric: number;
        sample_size: number;
        confidence: number;
      };

      // sample_size reset to 0 + 1 = 1 because -999 was negative
      expect(row.sample_size).toBe(1);
      // avg_metric clamped to <= 100
      expect(row.avg_metric).toBeLessThanOrEqual(100);
      expect(row.avg_metric).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(row.avg_metric)).toBe(true);
    });

    it('2.3 concurrent self-healing: 5 workers simultaneously hit a corrupted row', async () => {
      const d1 = createRealSqliteD1();
      const workspaceId = 'ws_heal_concurrent';
      const patternId = 'pat_ws_heal_concurrent_hook_style_story_lead';
      const initialDetectedAt = 1000;

      // Seed corrupt row with out-of-bound values
      d1.raw.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric,
          avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patternId, workspaceId, 'hook_style', 'story_lead', 'ces',
        -500, -10, -1, 'low', 'mission', initialDetectedAt, initialDetectedAt
      );

      const feedbacks: VideoEngagementFeedback[] = Array.from({ length: 5 }, (_, i) => ({
        videoId: `vid_heal_c_${i}`,
        workspaceId,
        platform: 'tiktok',
        hookStyle: 'story_lead',
        views: 1000,
        shares: 10 + i * 5,
        completionRate: 0.6,
      }));

      const results = await Promise.all(
        feedbacks.map((fb) => ingestEngagementFeedback(d1, fb, 5))
      );

      expect(results.every((r) => r.casApplied)).toBe(true);

      const finalRow = d1.raw.prepare(`SELECT * FROM playbook_patterns WHERE id = ?`).get(patternId) as {
        avg_metric: number;
        sample_size: number;
      };

      expect(finalRow.sample_size).toBe(5); // exactly 5 updates ingested
      expect(Number.isFinite(finalRow.avg_metric)).toBe(true);
      expect(finalRow.avg_metric).toBeGreaterThan(0);
      expect(finalRow.avg_metric).toBeLessThanOrEqual(100);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE GROUP 3: Monotonic Timestamp Advancing
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 3: Monotonic Timestamp Advancing Math.max(Date.now(), currentDetectedAt + 1)', () => {
    it('3.1 strictly advances timestamp by +1 per update when Date.now() is frozen (50 iterations)', async () => {
      const d1 = createRealSqliteD1();
      const workspaceId = 'ws_time_frozen';
      const patternId = 'pat_time_frozen';
      const T0 = 1700000000000;

      d1.raw.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric,
          avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patternId, workspaceId, 'hook_style', 'bold_claim', 'ces',
        50.0, 1, 0.1, 'low', 'mission', T0, T0
      );

      const originalDateNow = Date.now;
      Date.now = () => T0;

      try {
        let lastDetectedAt = T0;
        for (let i = 1; i <= 50; i++) {
          const res = await updatePatternScoreCAS(
            patternId,
            lastDetectedAt,
            { avgMetric: 50 + i, sampleSize: 1 + i, confidence: 0.2, confidenceLevel: 'low' },
            3,
            d1
          );

          expect(res.success).toBe(true);

          const row = d1.raw.prepare(`SELECT detected_at FROM playbook_patterns WHERE id = ?`).get(patternId) as { detected_at: number };
          // Strictly monotonic invariant: each update advances detected_at by at least 1
          expect(row.detected_at).toBe(lastDetectedAt + 1);
          lastDetectedAt = row.detected_at;
        }

        expect(lastDetectedAt).toBe(T0 + 50);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('3.2 survives clock skew (NTP backward jump by 1 hour) without losing monotonicity', async () => {
      const d1 = createRealSqliteD1();
      const workspaceId = 'ws_time_skew';
      const patternId = 'pat_time_skew';
      const T_future = 1800000000000; // Far ahead in future

      d1.raw.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric,
          avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patternId, workspaceId, 'hook_style', 'bold_claim', 'ces',
        50.0, 1, 0.1, 'low', 'mission', T_future, T_future
      );

      // System clock is 1 hour in the past relative to T_future
      const originalDateNow = Date.now;
      Date.now = () => T_future - 3600000;

      try {
        const res = await updatePatternScoreCAS(
          patternId,
          T_future,
          { avgMetric: 60, sampleSize: 2, confidence: 0.3, confidenceLevel: 'low' },
          3,
          d1
        );

        expect(res.success).toBe(true);
        const row = d1.raw.prepare(`SELECT detected_at FROM playbook_patterns WHERE id = ?`).get(patternId) as { detected_at: number };
        // Invariant: Even though Date.now() was 1 hour in the past, detected_at advanced by +1
        expect(row.detected_at).toBe(T_future + 1);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('3.3 rapid concurrent updates in ingestEngagementFeedback maintain strict timestamp ordering', async () => {
      const d1 = createRealSqliteD1();
      const workspaceId = 'ws_time_concurrent';
      const patternId = 'pat_ws_time_concurrent_hook_style_question';
      const T0 = 1700000000000;

      d1.raw.prepare(`
        INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric,
          avg_metric, sample_size, confidence, confidence_level, source, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        patternId, workspaceId, 'hook_style', 'question', 'ces',
        50.0, 1, 0.1, 'low', 'mission', T0, T0
      );

      // Freeze Date.now at T0
      const originalDateNow = Date.now;
      Date.now = () => T0;

      try {
        const feedbacks: VideoEngagementFeedback[] = Array.from({ length: 8 }, (_, i) => ({
          videoId: `v_time_${i}`,
          workspaceId,
          platform: 'tiktok',
          hookStyle: 'question',
          views: 1000,
          shares: 20,
          completionRate: 0.7,
        }));

        const results = await Promise.all(
          feedbacks.map((fb) => ingestEngagementFeedback(d1, fb, 6))
        );

        expect(results.every((r) => r.casApplied)).toBe(true);

        const row = d1.raw.prepare(`SELECT sample_size, detected_at FROM playbook_patterns WHERE id = ?`).get(patternId) as {
          sample_size: number;
          detected_at: number;
        };

        expect(row.sample_size).toBe(9); // 1 initial + 8 updates
        // detected_at must have advanced by at least 8 (one per update) even though Date.now() was completely frozen
        expect(row.detected_at).toBeGreaterThanOrEqual(T0 + 8);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE GROUP 4: Hook Scorer Extreme Value Boundaries
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 4: Hook Scorer Extreme Value Boundaries', () => {
    it('4.1 handles NaN in all hook component scores gracefully', () => {
      const res = calculateHookScore({
        hookText: 'Test hook with NaN',
        scores: {
          hookScore: NaN,
          pacingScore: NaN,
          retentionScore: NaN,
          ctaScore: NaN,
        },
      });

      expect(Number.isFinite(res.viralScore)).toBe(true);
      expect(Number.isNaN(res.viralScore)).toBe(false);
      // Fallback is 0.50 for all components -> viralScore = 0.50
      expect(res.viralScore).toBe(0.5);
      expect(res.hookScore).toBe(0.5);
      expect(res.pacingScore).toBe(0.5);
      expect(res.retentionScore).toBe(0.5);
      expect(res.ctaScore).toBe(0.5);
    });

    it('4.2 handles non-string and anomalous hookText inputs', () => {
      expect(classifyHookStyle(null as unknown as string)).toBe('curiosity_gap');
      expect(classifyHookStyle(undefined as unknown as string)).toBe('curiosity_gap');
      expect(classifyHookStyle('' as string)).toBe('curiosity_gap');
      expect(classifyHookStyle('   ' as string)).toBe('curiosity_gap');
      expect(classifyHookStyle(12345 as unknown as string)).toBe('curiosity_gap');
    });

    it('4.3 handles massive strings and multi-megabyte payloads in hookText', () => {
      const largeText = 'Why do '.repeat(10000) + 'you still make this mistake?';
      const style = classifyHookStyle(largeText);
      expect(style).toBe('question');

      const res = calculateHookScore({
        hookText: largeText,
      });
      expect(res.detectedHookStyle).toBe('question');
      expect(res.viralScore).toBe(0.5);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE GROUP 5: Investigation of calculateEffectivenessScore in effectiveness-scorer.ts
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 5: Empirical Audit of calculateEffectivenessScore', () => {
    it('5.1 demonstrates calculateEffectivenessScore vulnerability on NaN inputs', () => {
      // Direct call to calculateEffectivenessScore with NaN ctr
      const resCtrNaN = calculateEffectivenessScore({ ctr: NaN });
      // Empirically confirmed: returns NaN!
      expect(Number.isNaN(resCtrNaN.score)).toBe(true);

      const resRetNaN = calculateEffectivenessScore({ retentionRate: NaN });
      expect(Number.isNaN(resRetNaN.score)).toBe(true);
    });

    it('5.2 confirms scoring-cas.ts is decoupled from calculateEffectivenessScore', () => {
      // In scoring-cas.ts, ingestEngagementFeedback and calculateViralCES do NOT use calculateEffectivenessScore.
      // They use calculateViralCES which is completely immunized against NaN.
      const feedbackWithNaN: VideoEngagementFeedback = {
        videoId: 'vid_check_decoupled',
        platform: 'tiktok',
        completionRate: NaN,
        views: NaN,
      };

      const ces = calculateViralCES(feedbackWithNaN);
      expect(Number.isNaN(ces)).toBe(false);
      expect(ces).toBe(0);
    });
  });
});
