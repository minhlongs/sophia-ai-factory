/**
 * Unit & Integration Tests: Cross-Channel Trend Scout
 *
 * Validates:
 * 1. Trend discovery across TikTok, YouTube Shorts, and X.
 * 2. Velocity and momentum calculations over sliding 24h windows.
 * 3. 7-day SES forecast trajectory attachment (alpha = 0.40).
 * 4. Viral hook scoring integration.
 * 5. Optional D1 persistence to market_signals and trend_detections tables.
 *
 * Layer: tree
 */

import { describe, it, expect, vi } from 'vitest';
import { scoutTrendingSignals } from '../trend-scout';
import type { TrendingPlatform } from '@/seed/types/creative-intelligence';

function createMockD1() {
  const preparedStatements: Array<{ sql: string; bindings: unknown[] }> = [];

  const db = {
    prepare: vi.fn((sql: string) => {
      return {
        bind: vi.fn((...args: unknown[]) => {
          preparedStatements.push({ sql, bindings: args });
          return {
            run: async () => ({
              success: true,
              meta: { changes: 1, duration: 1 },
            }),
            all: async () => ({ results: [], success: true }),
            first: async () => null,
          };
        }),
      };
    }),
    _statements: preparedStatements,
  };

  return db as unknown as D1Database & { _statements: typeof preparedStatements };
}

describe('Trend Scout — Cross-Channel Discovery & Forecasting', () => {
  const platforms: TrendingPlatform[] = ['tiktok', 'youtube_shorts', 'x'];

  for (const platform of platforms) {
    it(`scouts trending signals for platform: ${platform}`, async () => {
      const query = 'AI Marketing';
      const fixedNow = 1_760_000_000_000;

      const signals = await scoutTrendingSignals(platform, query, undefined, {
        nowMs: fixedNow,
        workspaceId: 'ws_test_scout',
        limit: 3,
      });

      expect(signals).toHaveLength(3);

      for (const sig of signals) {
        expect(sig.platform).toBe(platform);
        expect(sig.query).toBe(query);
        expect(sig.detectedAt).toBe(fixedNow);
        expect(sig.hashtags.length).toBeGreaterThan(0);
        expect(sig.engagementMetrics.viewCount).toBeGreaterThan(0);
        expect(sig.engagementMetrics.shareCount).toBeGreaterThan(0);

        // Velocity and momentum are valid numbers
        expect(Number.isFinite(sig.velocityScore)).toBe(true);
        expect(Number.isFinite(sig.momentumScore)).toBe(true);

        // Viral score is normalized in [0, 1]
        expect(sig.viralScore).toBeDefined();
        expect(sig.viralScore!).toBeGreaterThanOrEqual(0);
        expect(sig.viralScore!).toBeLessThanOrEqual(1);

        // Raw data contains 7-day SES forecast with alpha = 0.40
        const raw = sig.rawData as {
          forecast: {
            model: string;
            alpha: number;
            horizonSteps: number;
            points: Array<{ step: number; projected: number }>;
          };
          windowCounts: number[];
        };

        expect(raw.forecast.model).toBe('exponential-smoothing');
        expect(raw.forecast.alpha).toBe(0.4);
        expect(raw.forecast.horizonSteps).toBe(7);
        expect(raw.forecast.points).toHaveLength(7);
        expect(raw.windowCounts).toHaveLength(7);
      }
    });
  }

  it('persists signals to D1 market_signals and trend_detections when db is provided', async () => {
    const mockDb = createMockD1();
    const signals = await scoutTrendingSignals('tiktok', 'SaaS Growth', mockDb, {
      workspaceId: 'ws_d1_test',
      limit: 2,
    });

    expect(signals).toHaveLength(2);
    // 2 signals * 2 statements each (market_signals + trend_detections) = 4 statements executed
    expect(mockDb._statements.length).toBe(4);

    const signalInsert = mockDb._statements.find((s) =>
      s.sql.includes('INSERT OR IGNORE INTO market_signals'),
    );
    expect(signalInsert).toBeDefined();
    expect(signalInsert?.bindings).toContain('ws_d1_test');
    expect(signalInsert?.bindings).toContain('tiktok');

    const detectionInsert = mockDb._statements.find((s) =>
      s.sql.includes('INSERT OR REPLACE INTO trend_detections'),
    );
    expect(detectionInsert).toBeDefined();
    expect(detectionInsert?.bindings).toContain('ws_d1_test');
    expect(detectionInsert?.bindings).toContain('tiktok');
  });

  it('gracefully handles empty queries and sets default trending topic', async () => {
    const signals = await scoutTrendingSignals('x', '', undefined, { limit: 1 });
    expect(signals).toHaveLength(1);
    expect(signals[0].query).toBe('trending');
    expect(signals[0].platform).toBe('x');
  });
});
