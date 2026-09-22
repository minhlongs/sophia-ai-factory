import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTierForMrr,
  calculateDualTierCommission,
  calculateMrrForAffiliate,
  evaluateAndUpgradeTier,
  batchEvaluateAllPartners,
} from '../tier-progression-engine';
import { AFFILIATE_TIER_CONFIGS } from '@/seed/types/affiliate-expansion-types';

describe('Affiliate Tier Progression Engine', () => {
  describe('getTierForMrr', () => {
    it('returns SILVER config for $0 MRR', () => {
      const config = getTierForMrr(0);
      expect(config.tier).toBe('SILVER');
      expect(config.commissionRatePct).toBe(20.0);
      expect(config.tier2RatePct).toBe(5.0);
    });

    it('returns SILVER config for MRR under $1,000 threshold (e.g. $999.99 = 99,999 cents)', () => {
      const config = getTierForMrr(99_999);
      expect(config.tier).toBe('SILVER');
      expect(config.commissionRatePct).toBe(20.0);
    });

    it('returns GOLD config upon reaching $1,000 MRR (100,000 cents)', () => {
      const config = getTierForMrr(100_000);
      expect(config.tier).toBe('GOLD');
      expect(config.commissionRatePct).toBe(25.0);
      expect(config.tier2RatePct).toBe(5.0);
    });

    it('returns GOLD config for MRR between $1,000 and $4,999.99 (499,999 cents)', () => {
      const config = getTierForMrr(499_999);
      expect(config.tier).toBe('GOLD');
      expect(config.commissionRatePct).toBe(25.0);
    });

    it('returns PLATINUM config upon reaching $5,000 MRR (500,000 cents)', () => {
      const config = getTierForMrr(500_000);
      expect(config.tier).toBe('PLATINUM');
      expect(config.commissionRatePct).toBe(30.0);
      expect(config.tier2RatePct).toBe(5.0);
    });

    it('returns PLATINUM config for high scale MRR ($25,000 MRR)', () => {
      const config = getTierForMrr(2_500_000);
      expect(config.tier).toBe('PLATINUM');
      expect(config.commissionRatePct).toBe(30.0);
    });

    it('handles negative or invalid cents gracefully by defaulting to SILVER', () => {
      const config = getTierForMrr(-500);
      expect(config.tier).toBe('SILVER');
    });
  });

  describe('calculateDualTierCommission', () => {
    it('returns 0 commission for zero or negative order amounts', () => {
      const res1 = calculateDualTierCommission('SILVER', 0);
      expect(res1.commissionCents).toBe(0);
      expect(res1.ratePct).toBe(0);

      const res2 = calculateDualTierCommission('GOLD', -100);
      expect(res2.commissionCents).toBe(0);
    });

    it('calculates Silver direct tier commission at 20%', () => {
      // Order: $199 = 19,900 cents -> 20% = 3,980 cents ($39.80)
      const res = calculateDualTierCommission('SILVER', 19_900);
      expect(res.ratePct).toBe(20.0);
      expect(res.commissionCents).toBe(3980);
      expect(res.tier).toBe('SILVER');
      expect(res.isTier2).toBe(false);
    });

    it('calculates Gold direct tier commission at 25%', () => {
      // Order: $399 = 39,900 cents -> 25% = 9,975 cents ($99.75)
      const res = calculateDualTierCommission('GOLD', 39_900);
      expect(res.ratePct).toBe(25.0);
      expect(res.commissionCents).toBe(9975);
      expect(res.tier).toBe('GOLD');
      expect(res.isTier2).toBe(false);
    });

    it('calculates Platinum direct tier commission at 30%', () => {
      // Order: $799 = 79,900 cents -> 30% = 23,970 cents ($239.70)
      const res = calculateDualTierCommission('PLATINUM', 79_900);
      expect(res.ratePct).toBe(30.0);
      expect(res.commissionCents).toBe(23970);
      expect(res.tier).toBe('PLATINUM');
      expect(res.isTier2).toBe(false);
    });

    it('calculates Tier 2 sub-affiliate override at 5% across all tiers', () => {
      // 5% of $199 (19,900 cents) = 995 cents ($9.95)
      const resSilver = calculateDualTierCommission('SILVER', 19_900, true);
      expect(resSilver.ratePct).toBe(5.0);
      expect(resSilver.commissionCents).toBe(995);
      expect(resSilver.tier).toBe('TIER2');
      expect(resSilver.isTier2).toBe(true);

      // 5% of $799 (79,900 cents) = 3,995 cents ($39.95)
      const resPlat = calculateDualTierCommission('PLATINUM', 79_900, true);
      expect(resPlat.ratePct).toBe(5.0);
      expect(resPlat.commissionCents).toBe(3995);
      expect(resPlat.tier).toBe('TIER2');
      expect(resPlat.isTier2).toBe(true);
    });
  });

  describe('D1 Database Operations (calculateMrrForAffiliate, evaluateAndUpgradeTier, batchEvaluateAllPartners)', () => {
    let mockD1: {
      prepare: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn(),
      };
    });

    it('calculateMrrForAffiliate returns 0 if partner not found', async () => {
      const mockStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      mockD1.prepare.mockReturnValue(mockStmt);

      const mrr = await calculateMrrForAffiliate(mockD1 as unknown as D1Database, 'non-existent');
      expect(mrr).toBe(0);
    });

    it('calculateMrrForAffiliate aggregates stored MRR and commission ledger correctly', async () => {
      const partnerStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          id: 'partner_1',
          partner_code: 'CODE1',
          activated_mrr_cents: 150_000,
        }),
      };
      const ledgerStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          recent_mrr: 200_000,
        }),
      };

      mockD1.prepare
        .mockReturnValueOnce(partnerStmt)
        .mockReturnValueOnce(ledgerStmt);

      const mrr = await calculateMrrForAffiliate(mockD1 as unknown as D1Database, 'partner_1');
      expect(mrr).toBe(200_000); // Takes max of verified recent ledger (200,000) and stored (150,000)
    });

    it('evaluateAndUpgradeTier upgrades SILVER partner to GOLD when MRR hits $1,000', async () => {
      const partnerSelectStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          id: 'p1',
          partner_code: 'SILVER_HERO',
          tier: 'SILVER',
          commission_rate_pct: 20.0,
          tier2_rate_pct: 5.0,
          activated_mrr_cents: 0,
        }),
      };

      const updateStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockD1.prepare
        .mockReturnValueOnce(partnerSelectStmt)
        .mockReturnValueOnce(updateStmt);

      const result = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'p1',
        120_000 // $1,200 MRR in cents
      );

      expect(result.upgraded).toBe(true);
      expect(result.previousTier).toBe('SILVER');
      expect(result.newTier).toBe('GOLD');
      expect(result.commissionRatePct).toBe(25.0);
      expect(result.activatedMrrUsd).toBe(1200);

      // Verify D1 update was called with new tier parameters
      expect(updateStmt.bind).toHaveBeenCalledWith(
        'GOLD',
        25.0,
        5.0,
        120_000,
        expect.any(Number),
        'p1'
      );
    });

    it('evaluateAndUpgradeTier upgrades GOLD partner to PLATINUM when MRR hits $5,000', async () => {
      const partnerSelectStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          id: 'p2',
          partner_code: 'TOP_LEADER',
          tier: 'GOLD',
          commission_rate_pct: 25.0,
          tier2_rate_pct: 5.0,
          activated_mrr_cents: 200_000,
        }),
      };

      const updateStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockD1.prepare
        .mockReturnValueOnce(partnerSelectStmt)
        .mockReturnValueOnce(updateStmt);

      const result = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'p2',
        650_000 // $6,500 MRR in cents
      );

      expect(result.upgraded).toBe(true);
      expect(result.previousTier).toBe('GOLD');
      expect(result.newTier).toBe('PLATINUM');
      expect(result.commissionRatePct).toBe(30.0);
      expect(result.activatedMrrUsd).toBe(6500);
    });

    it('evaluateAndUpgradeTier leaves partner at same tier if MRR threshold not crossed', async () => {
      const partnerSelectStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          id: 'p3',
          partner_code: 'ROOKIE',
          tier: 'SILVER',
          commission_rate_pct: 20.0,
          tier2_rate_pct: 5.0,
          activated_mrr_cents: 30_000,
        }),
      };

      mockD1.prepare.mockReturnValueOnce(partnerSelectStmt);

      const result = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'p3',
        30_000 // $300 MRR
      );

      expect(result.upgraded).toBe(false);
      expect(result.previousTier).toBe('SILVER');
      expect(result.newTier).toBe('SILVER');
    });

    it('batchEvaluateAllPartners evaluates multiple partners in D1', async () => {
      mockD1.prepare.mockImplementation((sql: string) => {
        if (sql.includes('status = \'active\'')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { id: 'p1', partner_code: 'AFF1' },
                { id: 'p2', partner_code: 'AFF2' },
              ],
            }),
          };
        }
        if (sql.includes('SELECT id, partner_code, tier')) {
          return {
            bind: vi.fn().mockImplementation((id: string) => ({
              first: vi.fn().mockResolvedValue(
                id === 'p1'
                  ? {
                      id: 'p1',
                      partner_code: 'AFF1',
                      tier: 'SILVER',
                      commission_rate_pct: 20.0,
                      tier2_rate_pct: 5.0,
                      activated_mrr_cents: 10_000,
                    }
                  : {
                      id: 'p2',
                      partner_code: 'AFF2',
                      tier: 'GOLD',
                      commission_rate_pct: 25.0,
                      tier2_rate_pct: 5.0,
                      activated_mrr_cents: 150_000,
                    }
              ),
            })),
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ recent_mrr: 0, activated_mrr_cents: 0 }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      });

      const results = await batchEvaluateAllPartners(mockD1 as unknown as D1Database);
      expect(results.length).toBe(2);
      expect(results[0].affiliateId).toBe('p1');
      expect(results[1].affiliateId).toBe('p2');
    });
  });
});
