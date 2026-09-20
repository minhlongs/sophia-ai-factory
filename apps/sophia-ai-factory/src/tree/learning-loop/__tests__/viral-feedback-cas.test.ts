/**
 * Unit & Integration Tests: Continuous Viral Feedback Loop & Atomic OCC CAS
 *
 * Validates:
 * 1. Mathematical CES Formula: (0.35 * R + 0.30 * S + 0.20 * E + 0.15 * C) * 100
 * 2. Hybrid CMA (< 10 samples) and SES alpha = 0.40 (>= 10 samples) weight updates
 * 3. Deadlock prevention via monotonic lexicographical sorting of pattern IDs
 * 4. Idempotent cold pattern initialization with INSERT ... ON CONFLICT DO NOTHING
 * 5. Atomic OCC CAS updates with retry on timestamp modification collision
 * 6. Provider certification gate check wiring (isCertificationBlocking)
 *
 * Layer: tree
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateViralCES,
  ingestEngagementFeedback,
  updatePatternScoreCAS,
  divertPromptOptimization,
  divertCreativeReasoning,
} from '../scoring-cas';
import type { VideoEngagementFeedback } from '@/seed/types/creative-intelligence';
import * as providerCert from '@/seed/ai/provider-certification';
import {
  registerCertification,
  ProviderCertificationState,
  ProviderNotCertifiedError,
} from '@/seed/ai/provider-certification';

interface MockPatternRow {
  id: string;
  workspace_id: string;
  feature_key: string;
  feature_value: string;
  metric: string;
  avg_metric: number;
  sample_size: number;
  confidence: number;
  confidence_level: 'high' | 'medium' | 'low';
  detected_at: number;
}

function createMockD1(initialPatterns: MockPatternRow[] = []) {
  const patterns = [...initialPatterns];
  const executedSql: Array<{ sql: string; bindings: unknown[] }> = [];

  const db = {
    prepare: vi.fn((sql: string) => {
      return {
        bind: vi.fn((...args: unknown[]) => {
          executedSql.push({ sql, bindings: args });
          return {
            all: async () => {
              if (sql.includes('SELECT') && sql.includes('playbook_patterns')) {
                // Filter patterns by workspace_id and feature keys/values
                const wsId = args[0] as string;
                const matched = patterns.filter((p) => p.workspace_id === wsId);
                return { results: matched, success: true };
              }
              return { results: [], success: true };
            },
            first: async <T>() => {
              if (sql.includes('SELECT detected_at FROM playbook_patterns') || (sql.includes('playbook_patterns') && sql.includes('WHERE id = ?'))) {
                const id = args[0] as string;
                const match = patterns.find((p) => p.id === id);
                return (match ? { ...match } : null) as T;
              }
              return null as T;
            },
            run: async () => {
              if (sql.includes('INSERT INTO playbook_patterns')) {
                const [id, wsId, key, val, metric, avg, detectedAt] =
                  args as [string, string, string, string, string, number, number];
                // Check ON CONFLICT
                const existing = patterns.find(
                  (p) =>
                    p.workspace_id === wsId &&
                    p.feature_key === key &&
                    p.feature_value === val &&
                    p.metric === metric,
                );
                if (!existing) {
                  patterns.push({
                    id,
                    workspace_id: wsId,
                    feature_key: key,
                    feature_value: val,
                    metric,
                    avg_metric: avg,
                    sample_size: 1,
                    confidence: 0,
                    confidence_level: 'low',
                    detected_at: detectedAt,
                  });
                  return { success: true, meta: { changes: 1, duration: 1 } };
                }
                return { success: true, meta: { changes: 0, duration: 1 } };
              }

              if (sql.includes('UPDATE playbook_patterns')) {
                const [avgMetric, sampleSize, confidence, confidenceLevel, newDetectedAt, patternId, expectedDetectedAt] =
                  args as [number, number, number, 'high'|'medium'|'low', number, string, number];

                const row = patterns.find((p) => p.id === patternId);
                if (row && row.detected_at === expectedDetectedAt) {
                  row.avg_metric = avgMetric;
                  row.sample_size = sampleSize;
                  row.confidence = confidence;
                  row.confidence_level = confidenceLevel;
                  row.detected_at = newDetectedAt;
                  return { success: true, meta: { changes: 1, duration: 1 } };
                }
                // Concurrency conflict: timestamp mismatch
                return { success: true, meta: { changes: 0, duration: 1 } };
              }

              return { success: true, meta: { changes: 1, duration: 1 } };
            },
          };
        }),
      };
    }),
    _patterns: patterns,
    _executedSql: executedSql,
  };

  return db as unknown as D1Database & {
    _patterns: MockPatternRow[];
    _executedSql: typeof executedSql;
  };
}

describe('Continuous Viral Feedback Loop & Atomic OCC CAS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Creative Effectiveness Score (CES) Math', () => {
    it('computes exact CES formula for a high-performing viral video', () => {
      // Retention: completionRate = 0.90 -> R = 0.90
      // Shares: 350 shares / 10,000 views = 0.035 -> S = min(1.0, 0.035 * 33.33) = 1.0
      // Engagement: (800 likes + 2 * 100 comments) / 10,000 = 1000/10000 = 0.10 -> E = min(1.0, 0.10 * 10.0) = 1.0
      // Conversions: ctr = 500/10000 = 0.05, convRate = 50/500 = 0.10 -> C = 0.6*(0.5) + 0.4*(0.5) = 0.50
      // CES = (0.35 * 0.90 + 0.30 * 1.0 + 0.20 * 1.0 + 0.15 * 0.50) * 100
      //     = (0.315 + 0.30 + 0.20 + 0.075) * 100 = 0.89 * 100 = 89.0
      const feedback: VideoEngagementFeedback = {
        videoId: 'v_viral_1',
        workspaceId: 'ws_growth',
        platform: 'tiktok',
        views: 10_000,
        shares: 350,
        watchTimeSeconds: 54,
        totalDurationSeconds: 60,
        completionRate: 0.9,
        likes: 800,
        comments: 100,
        impressions: 10_000,
        clicks: 500,
        conversions: 50,
        hookStyle: 'bold_claim',
      };

      const ces = calculateViralCES(feedback);
      expect(ces).toBe(89.0);
    });

    it('computes baseline CES for low engagement content', () => {
      // Views 1,000, 0 shares, 0 likes, 0 clicks, 10% watch time
      // R = 0.10, S = 0, E = 0, C = 0
      // CES = (0.35 * 0.10) * 100 = 3.5
      const feedback: VideoEngagementFeedback = {
        videoId: 'v_low_1',
        platform: 'youtube_shorts',
        views: 1000,
        shares: 0,
        watchTimeSeconds: 6,
        totalDurationSeconds: 60,
        hookStyle: 'question',
      };

      const ces = calculateViralCES(feedback);
      expect(ces).toBe(3.5);
    });
  });

  describe('2. Lexicographical Monotonic Sorting (Deadlock Elimination)', () => {
    it('executes pattern updates in strict ascending alphabetical order of pattern IDs', async () => {
      const initialPatterns: MockPatternRow[] = [
        {
          id: 'pat_ws_voice_dynamic',
          workspace_id: 'ws_sort_test',
          feature_key: 'voice_style',
          feature_value: 'dynamic_hook',
          metric: 'ces',
          avg_metric: 60,
          sample_size: 5,
          confidence: 0.5,
          confidence_level: 'medium',
          detected_at: 100,
        },
        {
          id: 'pat_ws_duration_30s',
          workspace_id: 'ws_sort_test',
          feature_key: 'duration',
          feature_value: '16-30s',
          metric: 'ces',
          avg_metric: 65,
          sample_size: 5,
          confidence: 0.5,
          confidence_level: 'medium',
          detected_at: 100,
        },
        {
          id: 'pat_ws_hook_curiosity',
          workspace_id: 'ws_sort_test',
          feature_key: 'hook_style',
          feature_value: 'curiosity_gap',
          metric: 'ces',
          avg_metric: 70,
          sample_size: 5,
          confidence: 0.5,
          confidence_level: 'medium',
          detected_at: 100,
        },
        {
          id: 'pat_ws_channel_tiktok',
          workspace_id: 'ws_sort_test',
          feature_key: 'channel',
          feature_value: 'tiktok',
          metric: 'ces',
          avg_metric: 75,
          sample_size: 5,
          confidence: 0.5,
          confidence_level: 'medium',
          detected_at: 100,
        },
      ];

      const mockDb = createMockD1(initialPatterns);

      const feedback: VideoEngagementFeedback = {
        videoId: 'v_sort_1',
        workspaceId: 'ws_sort_test',
        platform: 'tiktok',
        durationSeconds: 25,
        hookStyle: 'curiosity_gap',
        voiceStyle: 'dynamic_hook',
        views: 5000,
        shares: 100,
        watchTimeSeconds: 20,
      };

      const result = await ingestEngagementFeedback(mockDb, feedback);

      expect(result.casApplied).toBe(true);
      expect(result.updatedPatterns).toHaveLength(4);

      // Verify that pattern IDs were processed in strict ascending alphabetical order:
      // pat_ws_channel_tiktok < pat_ws_duration_30s < pat_ws_hook_curiosity < pat_ws_voice_dynamic
      const updatedIds = result.updatedPatterns!.map((p) => p.patternId);
      const sortedIds = [...updatedIds].sort((a, b) => a.localeCompare(b));
      expect(updatedIds).toEqual(sortedIds);
    });
  });

  describe('3. Hybrid CMA & SES alpha=0.40 Smoothing', () => {
    it('applies Cumulative Moving Average (CMA) when sample_size < 10', async () => {
      // Initial: avgMetric = 60, sampleSize = 4.
      // Feedback CES = 80.
      // New avg = (60 * 4 + 80) / 5 = (240 + 80) / 5 = 320 / 5 = 64.0
      const initialPatterns: MockPatternRow[] = [
        {
          id: 'pat_cma_1',
          workspace_id: 'ws_cma',
          feature_key: 'hook_style',
          feature_value: 'bold_claim',
          metric: 'ces',
          avg_metric: 60,
          sample_size: 4,
          confidence: 0,
          confidence_level: 'low',
          detected_at: 100,
        },
      ];

      const mockDb = createMockD1(initialPatterns);

      const feedback: VideoEngagementFeedback = {
        videoId: 'v_cma',
        workspaceId: 'ws_cma',
        platform: 'tiktok',
        completionRate: 0.8,
        shares: 240,
        views: 10_000,
        hookStyle: 'bold_claim',
      };
      // CES for this feedback:
      // R: 0.8 * 35 = 28
      // S: (240/10000)*33.33 = 0.024*33.33 = 0.80 -> 0.80 * 30 = 24
      // E: 0
      // C: 0
      // CES = 28 + 24 = 52.0
      const calculatedCes = calculateViralCES(feedback);

      const result = await ingestEngagementFeedback(mockDb, feedback);
      const updated = result.updatedPatterns?.find((p) => p.featureKey === 'hook_style');

      expect(updated).toBeDefined();
      expect(updated?.sampleSize).toBe(5);
      // Expected CMA: (60 * 4 + calculatedCes) / 5
      const expectedCma = Math.round(((60 * 4 + calculatedCes) / 5) * 100) / 100;
      expect(updated?.newAvg).toBe(expectedCma);
    });

    it('applies Single Exponential Smoothing (SES alpha = 0.40) when sample_size >= 10', async () => {
      // Initial: avgMetric = 70, sampleSize = 15.
      // Feedback CES = 90.
      // Expected SES: 0.40 * 90 + 0.60 * 70 = 36 + 42 = 78.0
      const initialPatterns: MockPatternRow[] = [
        {
          id: 'pat_ses_1',
          workspace_id: 'ws_ses',
          feature_key: 'hook_style',
          feature_value: 'statistic_reveal',
          metric: 'ces',
          avg_metric: 70,
          sample_size: 15,
          confidence: 0.75,
          confidence_level: 'high',
          detected_at: 100,
        },
      ];

      const mockDb = createMockD1(initialPatterns);

      // Construct feedback with CES exactly 90
      // R=1.0 (35), S=1.0 (30), E=0.75 (15), C=0.666 (10) -> 90.0
      const feedback: VideoEngagementFeedback = {
        videoId: 'v_ses',
        workspaceId: 'ws_ses',
        platform: 'youtube_shorts',
        completionRate: 1.0,
        views: 1000,
        shares: 30, // S = 1.0
        likes: 75,  // E = 0.75
        impressions: 1000,
        clicks: 100,
        conversions: 10,
        hookStyle: 'statistic_reveal',
      };
      const ces = calculateViralCES(feedback);

      const result = await ingestEngagementFeedback(mockDb, feedback);
      const updated = result.updatedPatterns?.find((p) => p.featureKey === 'hook_style');

      expect(updated).toBeDefined();
      expect(updated?.sampleSize).toBe(16);
      const expectedSes = Math.round((0.4 * ces + 0.6 * 70) * 100) / 100;
      expect(updated?.newAvg).toBe(expectedSes);
    });
  });

  describe('4. Cold Pattern Creation & Idempotency', () => {
    it('creates brand-new pattern rows on first feedback without throwing conflict error', async () => {
      const mockDb = createMockD1([]); // empty database

      const feedback: VideoEngagementFeedback = {
        videoId: 'v_cold_1',
        workspaceId: 'ws_cold_test',
        platform: 'tiktok',
        durationSeconds: 15,
        hookStyle: 'curiosity_gap',
        voiceStyle: 'cinematic_narrator',
        views: 1000,
        shares: 10,
      };

      const result = await ingestEngagementFeedback(mockDb, feedback);

      expect(result.updatedPatterns?.length).toBeGreaterThanOrEqual(1);
      // All inserted patterns should exist in mockDb
      const hookPattern = mockDb._patterns.find(
        (p) => p.workspace_id === 'ws_cold_test' && p.feature_key === 'hook_style',
      );
      expect(hookPattern).toBeDefined();
      expect(hookPattern?.feature_value).toBe('curiosity_gap');
    });
  });

  describe('5. Concurrency Conflict Retry (OCC CAS with Jitter)', () => {
    it('retries when detected_at changes concurrently and commits on next attempt', async () => {
      const initialPatterns: MockPatternRow[] = [
        {
          id: 'pat_concurrent_1',
          workspace_id: 'ws_occ',
          feature_key: 'hook_style',
          feature_value: 'bold_claim',
          metric: 'ces',
          avg_metric: 65,
          sample_size: 10,
          confidence: 0.7,
          confidence_level: 'high',
          detected_at: 100, // Stale timestamp on first attempt
        },
      ];

      const mockDb = createMockD1(initialPatterns);

      // Simulate a concurrent writer changing detected_at from 100 to 200
      let attemptCount = 0;
      const originalPrepare = mockDb.prepare;
      mockDb.prepare = vi.fn((sql: string) => {
        if (sql.includes('UPDATE playbook_patterns')) {
          return {
            bind: vi.fn((...args: unknown[]) => ({
              run: async () => {
                attemptCount++;
                if (attemptCount === 1) {
                  // Simulate concurrent collision: row was modified concurrently
                  initialPatterns[0].detected_at = 200;
                  return { success: true, meta: { changes: 0, duration: 1 } };
                }
                // Subsequent attempt with refreshed timestamp succeeds
                initialPatterns[0].detected_at = args[4] as number;
                return { success: true, meta: { changes: 1, duration: 1 } };
              },
            })),
          };
        }
        return originalPrepare(sql);
      }) as unknown as typeof mockDb.prepare;

      const feedback: VideoEngagementFeedback = {
        videoId: 'v_collision_1',
        workspaceId: 'ws_occ',
        platform: 'tiktok',
        hookStyle: 'bold_claim',
        views: 1000,
        shares: 20,
      };

      const result = await ingestEngagementFeedback(mockDb, feedback, 3);
      expect(result.casApplied).toBe(true);
      expect(attemptCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('6. Provider Certification Gate Check', () => {
    it('evaluates provider certification for hermes text provider', async () => {
      const isCertBlockingSpy = vi.spyOn(providerCert, 'isCertificationBlocking');

      const mockDb = createMockD1();
      const feedback: VideoEngagementFeedback = {
        videoId: 'v_cert_1',
        workspaceId: 'ws_cert',
        platform: 'x',
        hookStyle: 'story_lead',
        views: 500,
        shares: 10,
      };

      await ingestEngagementFeedback(mockDb, feedback);

      expect(isCertBlockingSpy).toHaveBeenCalledWith('hermes');
    });

    it('actively diverts to openrouter when hermes is uncertified/blocked', async () => {
      registerCertification('hermes', {
        state: ProviderCertificationState.BLOCKED,
        security: 'BLOCKED',
        health: 'BLOCKED',
        canary: 'BLOCKED',
      });
      registerCertification('openrouter', {
        state: ProviderCertificationState.PRODUCTION_READY,
        security: 'PASS',
        health: 'PASS',
        canary: 'PASS',
      });

      const mockDb = createMockD1();
      const feedback: VideoEngagementFeedback = {
        videoId: 'v_cert_divert',
        workspaceId: 'ws_cert_divert',
        platform: 'tiktok',
        hookStyle: 'curiosity_gap',
        views: 1000,
        shares: 20,
      };

      const result = await ingestEngagementFeedback(mockDb, feedback);
      expect(result.resolvedProvider).toBe('openrouter');
      expect(result.providerDiverted).toBe(true);
    });

    it('uses hermes directly when hermes is registered as production ready', async () => {
      registerCertification('hermes', {
        state: ProviderCertificationState.PRODUCTION_READY,
        security: 'PASS',
        health: 'PASS',
        canary: 'PASS',
      });

      const mockDb = createMockD1();
      const feedback: VideoEngagementFeedback = {
        videoId: 'v_cert_hermes_ok',
        workspaceId: 'ws_cert_hermes_ok',
        platform: 'tiktok',
        hookStyle: 'curiosity_gap',
        views: 1000,
        shares: 20,
      };

      const result = await ingestEngagementFeedback(mockDb, feedback);
      expect(result.resolvedProvider).toBe('hermes');
      expect(result.providerDiverted).toBe(false);

      // Re-block hermes
      registerCertification('hermes', {
        state: ProviderCertificationState.BLOCKED,
        security: 'BLOCKED',
        health: 'BLOCKED',
        canary: 'BLOCKED',
      });
    });

    it('safely rejects when all candidates are blocked', async () => {
      registerCertification('hermes', {
        state: ProviderCertificationState.BLOCKED,
        security: 'BLOCKED',
        health: 'BLOCKED',
        canary: 'BLOCKED',
      });
      registerCertification('openrouter', {
        state: ProviderCertificationState.BLOCKED,
        security: 'BLOCKED',
        health: 'BLOCKED',
        canary: 'BLOCKED',
      });
      registerCertification('anthropic', {
        state: ProviderCertificationState.BLOCKED,
        security: 'BLOCKED',
        health: 'BLOCKED',
        canary: 'BLOCKED',
      });

      const mockDb = createMockD1();
      const feedback: VideoEngagementFeedback = {
        videoId: 'v_cert_all_blocked',
        workspaceId: 'ws_cert_all_blocked',
        platform: 'tiktok',
        hookStyle: 'curiosity_gap',
        views: 1000,
        shares: 20,
      };

      await expect(ingestEngagementFeedback(mockDb, feedback)).rejects.toThrow(ProviderNotCertifiedError);

      // Restore openrouter certification
      registerCertification('openrouter', {
        state: ProviderCertificationState.PRODUCTION_READY,
        security: 'PASS',
        health: 'PASS',
        canary: 'PASS',
      });
    });

    it('divertPromptOptimization and divertCreativeReasoning route to certified fallback', () => {
      registerCertification('hermes', {
        state: ProviderCertificationState.BLOCKED,
        security: 'BLOCKED',
        health: 'BLOCKED',
        canary: 'BLOCKED',
      });
      registerCertification('openrouter', {
        state: ProviderCertificationState.PRODUCTION_READY,
        security: 'PASS',
        health: 'PASS',
        canary: 'PASS',
      });

      const optRes = divertPromptOptimization({ originalPrompt: 'Test prompt' });
      expect(optRes.resolvedProvider).toBe('openrouter');
      expect(optRes.diverted).toBe(true);

      const reasonRes = divertCreativeReasoning({ brief: 'Campaign brief' });
      expect(reasonRes.resolvedProvider).toBe('openrouter');
      expect(reasonRes.diverted).toBe(true);
    });
  });

  describe('7. D1 Moving Average NaN Immunity & Self-Healing', () => {
    it('self-heals corrupted D1 pattern rows with NaN avg_metric upon new feedback', async () => {
      const corruptedPatterns: MockPatternRow[] = [
        {
          id: 'pat_ws_nan_heal_hook_style_bold_claim',
          workspace_id: 'ws_nan_heal',
          feature_key: 'hook_style',
          feature_value: 'bold_claim',
          metric: 'ces',
          avg_metric: NaN,
          sample_size: 10,
          confidence: 0.7,
          confidence_level: 'high',
          detected_at: 1000,
        },
      ];

      const mockDb = createMockD1(corruptedPatterns);
      const feedback: VideoEngagementFeedback = {
        videoId: 'v_heal_1',
        workspaceId: 'ws_nan_heal',
        platform: 'tiktok',
        hookStyle: 'bold_claim',
        views: 1000,
        shares: 30, // 3% -> S=1.0 (weight 30%)
        completionRate: 0.8, // R=0.8 (weight 35% -> 28)
      };

      const result = await ingestEngagementFeedback(mockDb, feedback);
      expect(result.casApplied).toBe(true);
      expect(Number.isFinite(result.newScore)).toBe(true);
      expect(Number.isNaN(result.newScore)).toBe(false);

      const row = mockDb._patterns.find((p) => p.id === 'pat_ws_nan_heal_hook_style_bold_claim');
      expect(row).toBeDefined();
      expect(Number.isFinite(row!.avg_metric)).toBe(true);
      expect(Number.isNaN(row!.avg_metric)).toBe(false);
      expect(row!.avg_metric).toBeGreaterThan(0);
    });
  });
});
