import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  maskPartnerCode,
  getBonusRewardForRank,
  getCurrentMonthPeriod,
  getPeriodTimestampRange,
  getMonthlyLeaderboard,
  snapshotMonthlyLeaderboard,
} from '../leaderboard-service';
import { LEADERBOARD_BONUS_POOL } from '@/seed/types/affiliate-expansion-types';

describe('Monthly Affiliate Leaderboard Service', () => {
  describe('maskPartnerCode', () => {
    it('masks middle characters of longer partner codes for privacy', () => {
      expect(maskPartnerCode('PARTNER_99')).toBe('PART***99');
      expect(maskPartnerCode('SOPHIA_ELITE_01')).toBe('SOPH***01');
    });

    it('handles short or edge-case codes without throwing', () => {
      expect(maskPartnerCode('ABC')).toBe('ABC');
      expect(maskPartnerCode('')).toBe('ANON');
    });
  });

  describe('getBonusRewardForRank', () => {
    it('allocates $500 for Rank 1 champion', () => {
      expect(getBonusRewardForRank(1)).toBe(500);
    });

    it('allocates $250 for Rank 2 runner-up', () => {
      expect(getBonusRewardForRank(2)).toBe(250);
    });

    it('allocates $100 for Rank 3 bronze podium', () => {
      expect(getBonusRewardForRank(3)).toBe(100);
    });

    it('allocates $0 for Rank 4 and below', () => {
      expect(getBonusRewardForRank(4)).toBe(0);
      expect(getBonusRewardForRank(10)).toBe(0);
    });
  });

  describe('Period and Timestamp Helpers', () => {
    it('getCurrentMonthPeriod formats date to YYYY-MM', () => {
      const fixedDate = new Date('2026-09-22T12:00:00Z');
      expect(getCurrentMonthPeriod(fixedDate)).toBe('2026-09');
    });

    it('getPeriodTimestampRange produces valid UTC timestamps spanning the full calendar month', () => {
      const range = getPeriodTimestampRange('2026-09');
      const startDate = new Date(range.startMs);
      const endDate = new Date(range.endMs);

      expect(startDate.getUTCFullYear()).toBe(2026);
      expect(startDate.getUTCMonth()).toBe(8); // September is month index 8 (0-indexed)
      expect(startDate.getUTCDate()).toBe(1);

      expect(endDate.getUTCFullYear()).toBe(2026);
      expect(endDate.getUTCMonth()).toBe(9); // October 1st
      expect(endDate.getUTCDate()).toBe(1);

      expect(range.endMs).toBeGreaterThan(range.startMs);
    });
  });

  describe('D1 Leaderboard Querying & Snapshots', () => {
    let mockD1: {
      prepare: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn(),
      };
    });

    it('returns persisted snapshot when available in D1', async () => {
      const cachedSnapshot = {
        period: '2026-09',
        totalPrizePoolUsd: 850,
        topAffiliates: [
          {
            rank: 1,
            partnerCode: 'PARTNER_VN_01',
            displayName: 'Partner PARTNER_VN_01',
            maskedCode: 'PART***01',
            tier: 'PLATINUM',
            monthlyMrrUsd: 5500,
            activeConversions: 18,
            commissionEarnedUsd: 1650,
            bonusRewardUsd: 500,
            isTopThree: true,
          },
        ],
        updatedAt: '2026-09-22T00:00:00.000Z',
      };

      const snapshotStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          snapshot_json: JSON.stringify(cachedSnapshot),
          total_prize_pool_usd: 850,
          created_at: 1727000000000,
        }),
      };

      mockD1.prepare.mockReturnValueOnce(snapshotStmt);

      const result = await getMonthlyLeaderboard(mockD1 as unknown as D1Database, '2026-09');
      expect(result.period).toBe('2026-09');
      expect(result.topAffiliates.length).toBe(1);
      expect(result.topAffiliates[0].rank).toBe(1);
      expect(result.topAffiliates[0].bonusRewardUsd).toBe(500);
      expect(result.topAffiliates[0].tier).toBe('PLATINUM');
    });

    it('aggregates live top 10 rankings from D1 when no snapshot exists', async () => {
      // 1. Snapshot query returns null
      const snapshotStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };

      // 2. Live aggregation query returns 3 mock partners
      const liveStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'p1',
              partner_code: 'MASTER_DEV_01',
              tier: 'PLATINUM',
              activated_mrr_cents: 620_000,
              monthly_gross_cents: 620_000,
              monthly_commission_cents: 186_000,
              conversion_count: 22,
            },
            {
              id: 'p2',
              partner_code: 'GOLD_TIKTOK_88',
              tier: 'GOLD',
              activated_mrr_cents: 240_000,
              monthly_gross_cents: 240_000,
              monthly_commission_cents: 60_000,
              conversion_count: 8,
            },
            {
              id: 'p3',
              partner_code: 'SILVER_GROWTH_03',
              tier: 'SILVER',
              activated_mrr_cents: 80_000,
              monthly_gross_cents: 80_000,
              monthly_commission_cents: 16_000,
              conversion_count: 3,
            },
          ],
        }),
      };

      mockD1.prepare
        .mockReturnValueOnce(snapshotStmt)
        .mockReturnValueOnce(liveStmt);

      const result = await getMonthlyLeaderboard(mockD1 as unknown as D1Database, '2026-09');

      expect(result.period).toBe('2026-09');
      expect(result.totalPrizePoolUsd).toBe(850);
      expect(result.topAffiliates.length).toBe(3);

      // Rank 1
      expect(result.topAffiliates[0].rank).toBe(1);
      expect(result.topAffiliates[0].monthlyMrrUsd).toBe(6200);
      expect(result.topAffiliates[0].commissionEarnedUsd).toBe(1860);
      expect(result.topAffiliates[0].bonusRewardUsd).toBe(500);
      expect(result.topAffiliates[0].isTopThree).toBe(true);
      expect(result.topAffiliates[0].tier).toBe('PLATINUM');

      // Rank 2
      expect(result.topAffiliates[1].rank).toBe(2);
      expect(result.topAffiliates[1].monthlyMrrUsd).toBe(2400);
      expect(result.topAffiliates[1].bonusRewardUsd).toBe(250);
      expect(result.topAffiliates[1].isTopThree).toBe(true);
      expect(result.topAffiliates[1].tier).toBe('GOLD');

      // Rank 3
      expect(result.topAffiliates[2].rank).toBe(3);
      expect(result.topAffiliates[2].monthlyMrrUsd).toBe(800);
      expect(result.topAffiliates[2].bonusRewardUsd).toBe(100);
      expect(result.topAffiliates[2].isTopThree).toBe(true);
      expect(result.topAffiliates[2].tier).toBe('SILVER');
    });

    it('snapshotMonthlyLeaderboard persists snapshot into D1', async () => {
      const snapshotStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      const liveStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'p1',
              partner_code: 'P1',
              tier: 'GOLD',
              activated_mrr_cents: 150_000,
              monthly_commission_cents: 37_500,
              conversion_count: 5,
            },
          ],
        }),
      };
      const insertStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockD1.prepare
        .mockReturnValueOnce(snapshotStmt)
        .mockReturnValueOnce(liveStmt)
        .mockReturnValueOnce(insertStmt);

      const snapshot = await snapshotMonthlyLeaderboard(mockD1 as unknown as D1Database, '2026-09');

      expect(snapshot.period).toBe('2026-09');
      expect(insertStmt.bind).toHaveBeenCalledWith(
        'snapshot_2026-09',
        '2026-09',
        850,
        expect.any(String),
        expect.any(Number)
      );
    });

    it('handles query failure gracefully and returns valid empty summary', async () => {
      mockD1.prepare.mockImplementation(() => {
        throw new Error('D1 unavailable');
      });

      const fallback = await getMonthlyLeaderboard(mockD1 as unknown as D1Database, '2026-09');
      expect(fallback.period).toBe('2026-09');
      expect(fallback.totalPrizePoolUsd).toBe(850);
      expect(fallback.topAffiliates).toEqual([]);
    });
  });
});
