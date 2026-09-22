/**
 * Adversarial Empirical Stress Tests: Milestone 3 (R3 Affiliate Expansion & Dual-Rail Payouts)
 *
 * Stress-tests:
 * 1. MRR Tier thresholds, exact boundaries, fractional cents, and non-numeric inputs.
 * 2. Tier transitions, rapid fluctuations, downgrade persistence, and idempotency.
 * 3. Tier 2 commission calculations (5% fixed override), micro-transactions, and 65% platform margin invariant.
 * 4. Monthly Leaderboard sorting hierarchy, tie-breakers, partial podium allocations (<3 partners), and empty periods.
 * 5. Dual-rail batch boundaries ($50 threshold), VietQR CSV RFC 4180 escaping, and exchange rate fallbacks.
 *
 * @module land/affiliates/__tests__/adversarial-m3-affiliate.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTierForMrr,
  calculateDualTierCommission,
  calculateMrrForAffiliate,
  evaluateAndUpgradeTier,
  batchEvaluateAllPartners,
} from '../tier-progression-engine';
import {
  maskPartnerCode,
  getBonusRewardForRank,
  getCurrentMonthPeriod,
  getPeriodTimestampRange,
  getMonthlyLeaderboard,
  snapshotMonthlyLeaderboard,
} from '../leaderboard-service';
import {
  escapeCsvField,
  getExchangeRateVnd,
  buildVietQrPaymentUrl,
  generateVietQrCsv,
  createDualRailPayoutBatch,
  executeDualRailBatch,
  DEFAULT_USD_TO_VND_RATE,
  DEFAULT_MIN_PAYOUT_CENTS,
} from '../../payouts/dual-rail-payout-engine';
import {
  AFFILIATE_TIER_CONFIGS,
  LEADERBOARD_BONUS_POOL,
  AffiliateTier,
  PayoutBatchItem,
  DualRailPayoutBatch,
} from '@/seed/types/affiliate-expansion-types';
import * as nowpaymentsModule from '../../payouts/nowpayments-mass-payout';

describe('Adversarial Stress Suite: Milestone 3 (R3 Affiliate Expansion & Dual-Rail Payouts)', () => {
  // =========================================================================
  // 1. MRR TIER THRESHOLDS & BOUNDARY CONDITIONS
  // =========================================================================
  describe('1. MRR Tier Progression Thresholds & Boundaries', () => {
    it('accurately classifies the exact boundary transitions around $1,000 (100,000 cents)', () => {
      // Just below Gold: $999.98 and $999.99
      expect(getTierForMrr(99_998).tier).toBe('SILVER');
      expect(getTierForMrr(99_999).tier).toBe('SILVER');

      // Exact threshold: $1,000.00
      const atGold = getTierForMrr(100_000);
      expect(atGold.tier).toBe('GOLD');
      expect(atGold.commissionRatePct).toBe(25.0);
      expect(atGold.tier2RatePct).toBe(5.0);

      // Just above Gold: $1,000.01
      expect(getTierForMrr(100_001).tier).toBe('GOLD');
    });

    it('accurately classifies the exact boundary transitions around $5,000 (500,000 cents)', () => {
      // Just below Platinum: $4,999.98 and $4,999.99
      expect(getTierForMrr(499_998).tier).toBe('GOLD');
      expect(getTierForMrr(499_999).tier).toBe('GOLD');

      // Exact threshold: $5,000.00
      const atPlat = getTierForMrr(500_000);
      expect(atPlat.tier).toBe('PLATINUM');
      expect(atPlat.commissionRatePct).toBe(30.0);
      expect(atPlat.tier2RatePct).toBe(5.0);

      // Just above Platinum: $5,000.01
      expect(getTierForMrr(500_001).tier).toBe('PLATINUM');
    });

    it('handles floating point cent anomalies using Math.floor defensive quantization', () => {
      // Sub-cent fraction should not prematurely trigger next tier
      expect(getTierForMrr(99_999.99).tier).toBe('SILVER');
      expect(getTierForMrr(99_999.0001).tier).toBe('SILVER');

      // Fractions above threshold stay in tier
      expect(getTierForMrr(100_000.01).tier).toBe('GOLD');
      expect(getTierForMrr(499_999.99).tier).toBe('GOLD');
      expect(getTierForMrr(500_000.5).tier).toBe('PLATINUM');
    });

    it('defensively handles negative, zero, and extreme values', () => {
      expect(getTierForMrr(0).tier).toBe('SILVER');
      expect(getTierForMrr(-1).tier).toBe('SILVER');
      expect(getTierForMrr(-500_000).tier).toBe('SILVER');
      expect(getTierForMrr(-Infinity).tier).toBe('SILVER');

      // Extreme high scale: $10,000,000 MRR (1,000,000,000 cents)
      expect(getTierForMrr(1_000_000_000).tier).toBe('PLATINUM');
      expect(getTierForMrr(Infinity).tier).toBe('PLATINUM');

      // Non-numeric NaN input safely falls back to SILVER
      expect(getTierForMrr(NaN).tier).toBe('SILVER');
    });

    it('verifies strict monotonicity of commission rates across MRR ranges', () => {
      const testCents = [
        0, 10_000, 50_000, 99_999, 100_000, 250_000, 499_999, 500_000, 1_000_000, 10_000_000,
      ];
      let previousRate = 0;

      for (const cents of testCents) {
        const config = getTierForMrr(cents);
        expect(config.commissionRatePct).toBeGreaterThanOrEqual(previousRate);
        expect(config.tier2RatePct).toBe(5.0); // Tier 2 override invariant
        previousRate = config.commissionRatePct;
      }
    });
  });

  // =========================================================================
  // 2. DYNAMIC TIER TRANSITIONS, DOWNGRADES & IDEMPOTENCY
  // =========================================================================
  describe('2. Dynamic Tier Transitions, Downgrades & Idempotency', () => {
    let mockD1: {
      prepare: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn(),
      };
    });

    it('tracks sequential tier upgrades and downgrades with state persistence', async () => {
      let currentTier = 'SILVER';
      let currentMrr = 0;
      let currentRate = 20.0;

      const partnerSelectStmt = {
        bind: vi.fn().mockImplementation(() => ({
          first: vi.fn().mockImplementation(async () => ({
            id: 'partner_flow_1',
            partner_code: 'FLOW_01',
            tier: currentTier,
            commission_rate_pct: currentRate,
            tier2_rate_pct: 5.0,
            activated_mrr_cents: currentMrr,
          })),
        })),
      };

      const updateStmt = {
        bind: vi.fn().mockImplementation((tier, rate, t2Rate, mrr) => {
          currentTier = tier;
          currentRate = rate;
          currentMrr = mrr;
          return {
            run: vi.fn().mockResolvedValue({ success: true }),
          };
        }),
      };

      mockD1.prepare.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, partner_code, tier')) {
          return partnerSelectStmt;
        }
        if (sql.includes('UPDATE affiliate_partners')) {
          return updateStmt;
        }
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      });

      // Step 1: Partner reaches $1,200 MRR -> Upgraded to GOLD
      const step1 = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'partner_flow_1',
        120_000
      );
      expect(step1.upgraded).toBe(true);
      expect(step1.previousTier).toBe('SILVER');
      expect(step1.newTier).toBe('GOLD');
      expect(step1.commissionRatePct).toBe(25.0);

      // Step 2: Idempotent re-evaluation at same MRR -> upgraded: false, stays GOLD
      const step2 = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'partner_flow_1',
        120_000
      );
      expect(step2.upgraded).toBe(false);
      expect(step2.previousTier).toBe('GOLD');
      expect(step2.newTier).toBe('GOLD');

      // Step 3: Partner scales to $5,500 MRR -> Upgraded to PLATINUM
      const step3 = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'partner_flow_1',
        550_000
      );
      expect(step3.upgraded).toBe(true);
      expect(step3.previousTier).toBe('GOLD');
      expect(step3.newTier).toBe('PLATINUM');
      expect(step3.commissionRatePct).toBe(30.0);

      // Step 4: Churn causes MRR to drop to $2,000 -> Downgraded to GOLD
      const step4 = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'partner_flow_1',
        200_000
      );
      expect(step4.upgraded).toBe(false); // Downgrade is not an upgrade
      expect(step4.previousTier).toBe('PLATINUM');
      expect(step4.newTier).toBe('GOLD');
      expect(step4.commissionRatePct).toBe(25.0);

      // Step 5: Heavy churn drops MRR to $500 -> Downgraded to SILVER
      const step5 = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'partner_flow_1',
        50_000
      );
      expect(step5.upgraded).toBe(false);
      expect(step5.previousTier).toBe('GOLD');
      expect(step5.newTier).toBe('SILVER');
      expect(step5.commissionRatePct).toBe(20.0);

      // Step 6: Rapid multi-tier leap from Silver directly to Platinum ($8,000 MRR)
      const step6 = await evaluateAndUpgradeTier(
        mockD1 as unknown as D1Database,
        'partner_flow_1',
        800_000
      );
      expect(step6.upgraded).toBe(true);
      expect(step6.previousTier).toBe('SILVER');
      expect(step6.newTier).toBe('PLATINUM');
      expect(step6.commissionRatePct).toBe(30.0);
    });

    it('batch evaluation continues processing surviving partners when individual partner evaluation fails', async () => {
      mockD1.prepare.mockImplementation((sql: string) => {
        if (sql.includes('status = \'active\'')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { id: 'p_faulty', partner_code: 'ERR_PARTNER' },
                { id: 'p_good', partner_code: 'GOOD_PARTNER' },
              ],
            }),
          };
        }
        if (sql.includes('SELECT id, partner_code, tier')) {
          return {
            bind: vi.fn().mockImplementation((id: string) => ({
              first: vi.fn().mockImplementation(async () => {
                if (id === 'p_faulty') {
                  throw new Error('D1 transient timeout on partner p_faulty');
                }
                return {
                  id: 'p_good',
                  partner_code: 'GOOD_PARTNER',
                  tier: 'SILVER',
                  commission_rate_pct: 20.0,
                  tier2_rate_pct: 5.0,
                  activated_mrr_cents: 150_000,
                };
              }),
            })),
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({ recent_mrr: 150_000, activated_mrr_cents: 150_000 }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      });

      const batchResults = await batchEvaluateAllPartners(mockD1 as unknown as D1Database);

      // The faulty partner was safely caught and logged, while the good partner succeeded
      expect(batchResults.length).toBe(1);
      expect(batchResults[0].affiliateId).toBe('p_good');
      expect(batchResults[0].newTier).toBe('GOLD');
    });
  });

  // =========================================================================
  // 3. TIER 2 COMMISSION CALCULATIONS & FINANCIAL INVARIANTS
  // =========================================================================
  describe('3. Tier 2 Commission Calculations & Financial Invariants', () => {
    it('enforces 5% Tier 2 override consistently across all partner tiers', () => {
      const orderCents = 20_000; // $200.00

      const t2Silver = calculateDualTierCommission('SILVER', orderCents, true);
      const t2Gold = calculateDualTierCommission('GOLD', orderCents, true);
      const t2Platinum = calculateDualTierCommission('PLATINUM', orderCents, true);

      expect(t2Silver.ratePct).toBe(5.0);
      expect(t2Silver.commissionCents).toBe(1000); // $10.00
      expect(t2Silver.tier).toBe('TIER2');
      expect(t2Silver.isTier2).toBe(true);

      expect(t2Gold.ratePct).toBe(5.0);
      expect(t2Gold.commissionCents).toBe(1000);

      expect(t2Platinum.ratePct).toBe(5.0);
      expect(t2Platinum.commissionCents).toBe(1000);
    });

    it('safely handles micro-transaction rounding boundaries without NaN or negative commissions', () => {
      // 0 cents order -> 0 commission
      expect(calculateDualTierCommission('PLATINUM', 0, false).commissionCents).toBe(0);
      expect(calculateDualTierCommission('PLATINUM', 0, true).commissionCents).toBe(0);

      // Negative order -> 0 commission
      expect(calculateDualTierCommission('GOLD', -999, false).commissionCents).toBe(0);
      expect(calculateDualTierCommission('GOLD', -999, true).commissionCents).toBe(0);

      // Micro cent tests for Tier 2 (5%):
      // 1 cent * 0.05 = 0.05 -> Math.round -> 0
      expect(calculateDualTierCommission('SILVER', 1, true).commissionCents).toBe(0);

      // 9 cents * 0.05 = 0.45 -> Math.round -> 0
      expect(calculateDualTierCommission('SILVER', 9, true).commissionCents).toBe(0);

      // 10 cents * 0.05 = 0.50 -> Math.round -> 1
      expect(calculateDualTierCommission('SILVER', 10, true).commissionCents).toBe(1);

      // 19 cents * 0.05 = 0.95 -> Math.round -> 1
      expect(calculateDualTierCommission('SILVER', 19, true).commissionCents).toBe(1);

      // 30 cents * 0.05 = 1.50 -> Math.round -> 2
      expect(calculateDualTierCommission('SILVER', 30, true).commissionCents).toBe(2);
    });

    it('guarantees Platform Margin Invariant: Total Affiliate Payout (Direct + Tier 2) <= 35% of Order', () => {
      const sampleOrders = [
        100, 199, 499, 1000, 1999, 5000, 9900, 19900, 39900, 79900, 100_000, 1_000_000,
      ];
      const tiers: AffiliateTier[] = ['SILVER', 'GOLD', 'PLATINUM'];

      for (const tier of tiers) {
        for (const order of sampleOrders) {
          const direct = calculateDualTierCommission(tier, order, false);
          const override = calculateDualTierCommission(tier, order, true);
          const totalCommission = direct.commissionCents + override.commissionCents;
          const payoutRatio = totalCommission / order;

          // Maximum theoretical payout is Platinum (30%) + Tier 2 (5%) = 35%
          expect(payoutRatio).toBeLessThanOrEqual(0.355); // Account for integer rounding margin
          const platformRetainedGrossMargin = 1 - payoutRatio;

          // Sophia platform must retain at least 64.5% gross margin on any transaction
          expect(platformRetainedGrossMargin).toBeGreaterThanOrEqual(0.645);
        }
      }
    });

    it('falls back safely to SILVER configuration when invalid/unknown tier is provided', () => {
      // Cast invalid string to test runtime defensive branch
      const res = calculateDualTierCommission('UNKNOWN_TIER' as AffiliateTier, 10_000, false);
      expect(res.ratePct).toBe(20.0); // Falls back to SILVER rate
      expect(res.commissionCents).toBe(2000);
    });
  });

  // =========================================================================
  // 4. LEADERBOARD SORTING HIERARCHY, TIES & BONUS POOL ALLOCATION
  // =========================================================================
  describe('4. Leaderboard Ties, Sorting Hierarchy & Bonus Pool Allocation', () => {
    let mockD1: {
      prepare: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn(),
      };
    });

    it('preserves multi-level sorting hierarchy: MRR > Commission > Conversions', async () => {
      const snapshotStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };

      // 4 partners demonstrating distinct hierarchy levels:
      // P1: $5,000 MRR, $500 comm, 2 conv (Higher MRR beats P2 despite lower comm)
      // P2: $4,000 MRR, $1,200 comm, 10 conv
      // P3: $4,000 MRR, $1,000 comm, 20 conv (Same MRR as P2, but lower comm)
      // P4: $4,000 MRR, $1,000 comm, 15 conv (Same MRR and comm as P3, but lower conv)
      const liveStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'p1',
              partner_code: 'CHAMPION_MRR',
              tier: 'PLATINUM',
              activated_mrr_cents: 500_000,
              monthly_commission_cents: 50_000,
              conversion_count: 2,
            },
            {
              id: 'p2',
              partner_code: 'HIGH_COMM',
              tier: 'GOLD',
              activated_mrr_cents: 400_000,
              monthly_commission_cents: 120_000,
              conversion_count: 10,
            },
            {
              id: 'p3',
              partner_code: 'HIGH_CONV',
              tier: 'GOLD',
              activated_mrr_cents: 400_000,
              monthly_commission_cents: 100_000,
              conversion_count: 20,
            },
            {
              id: 'p4',
              partner_code: 'LOWER_CONV',
              tier: 'GOLD',
              activated_mrr_cents: 400_000,
              monthly_commission_cents: 100_000,
              conversion_count: 15,
            },
          ],
        }),
      };

      mockD1.prepare
        .mockReturnValueOnce(snapshotStmt)
        .mockReturnValueOnce(liveStmt);

      const leaderboard = await getMonthlyLeaderboard(mockD1 as unknown as D1Database, '2026-09');

      expect(leaderboard.topAffiliates.length).toBe(4);
      expect(leaderboard.topAffiliates[0].partnerCode).toBe('CHAMPION_MRR');
      expect(leaderboard.topAffiliates[0].rank).toBe(1);
      expect(leaderboard.topAffiliates[0].bonusRewardUsd).toBe(500);

      expect(leaderboard.topAffiliates[1].partnerCode).toBe('HIGH_COMM');
      expect(leaderboard.topAffiliates[1].rank).toBe(2);
      expect(leaderboard.topAffiliates[1].bonusRewardUsd).toBe(250);

      expect(leaderboard.topAffiliates[2].partnerCode).toBe('HIGH_CONV');
      expect(leaderboard.topAffiliates[2].rank).toBe(3);
      expect(leaderboard.topAffiliates[2].bonusRewardUsd).toBe(100);

      expect(leaderboard.topAffiliates[3].partnerCode).toBe('LOWER_CONV');
      expect(leaderboard.topAffiliates[3].rank).toBe(4);
      expect(leaderboard.topAffiliates[3].bonusRewardUsd).toBe(0); // Outside top 3
    });

    it('correctly allocates bonus pool when fewer than 3 partners qualify', async () => {
      const snapshotStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };

      // Scenario: Only 1 active partner in early launch
      const liveStmt1 = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'p_solo',
              partner_code: 'SOLO_STAR',
              tier: 'GOLD',
              activated_mrr_cents: 150_000,
              monthly_commission_cents: 37_500,
              conversion_count: 5,
            },
          ],
        }),
      };

      mockD1.prepare
        .mockReturnValueOnce(snapshotStmt)
        .mockReturnValueOnce(liveStmt1);

      const soloBoard = await getMonthlyLeaderboard(mockD1 as unknown as D1Database, '2026-09');
      expect(soloBoard.topAffiliates.length).toBe(1);
      expect(soloBoard.topAffiliates[0].rank).toBe(1);
      expect(soloBoard.topAffiliates[0].bonusRewardUsd).toBe(500);
      expect(soloBoard.topAffiliates[0].isTopThree).toBe(true);

      const totalAllocatedUsd = soloBoard.topAffiliates.reduce((acc, a) => acc + a.bonusRewardUsd, 0);
      expect(totalAllocatedUsd).toBe(500);
      expect(totalAllocatedUsd).toBeLessThanOrEqual(LEADERBOARD_BONUS_POOL.TOTAL_POOL_USD);
    });

    it('returns empty list gracefully without throwing when 0 partners exist', async () => {
      const snapshotStmt = {
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      };
      const liveStmt = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };

      mockD1.prepare
        .mockReturnValueOnce(snapshotStmt)
        .mockReturnValueOnce(liveStmt);

      const emptyBoard = await getMonthlyLeaderboard(mockD1 as unknown as D1Database, '2026-09');
      expect(emptyBoard.topAffiliates).toEqual([]);
      expect(emptyBoard.totalPrizePoolUsd).toBe(850);
      expect(emptyBoard.period).toBe('2026-09');
    });

    it('properly masks partner codes for public privacy regardless of string length', () => {
      // Standard codes
      expect(maskPartnerCode('PARTNER_SG_01')).toBe('PART***01');
      expect(maskPartnerCode('AFFILIATE_TOP')).toBe('AFFI***OP');

      // Short codes <= 4 chars: preserved without throwing
      expect(maskPartnerCode('ABCD')).toBe('ABCD');
      expect(maskPartnerCode('VN1')).toBe('VN1');
      expect(maskPartnerCode('A')).toBe('A');
      expect(maskPartnerCode('')).toBe('ANON');
    });

    it('calculates calendar month UTC ranges across leap years and month boundaries', () => {
      // Leap year February (2024 has 29 days)
      const feb2024 = getPeriodTimestampRange('2024-02');
      const febStart = new Date(feb2024.startMs);
      const febEnd = new Date(feb2024.endMs);
      expect(febStart.toISOString()).toBe('2024-02-01T00:00:00.000Z');
      expect(febEnd.toISOString()).toBe('2024-03-01T00:00:00.000Z');
      const febDays = (feb2024.endMs - feb2024.startMs) / (86400 * 1000);
      expect(febDays).toBe(29);

      // Non-leap year February (2025 has 28 days)
      const feb2025 = getPeriodTimestampRange('2025-02');
      const febDays2025 = (feb2025.endMs - feb2025.startMs) / (86400 * 1000);
      expect(febDays2025).toBe(28);

      // 30-day month (September 2026)
      const sep2026 = getPeriodTimestampRange('2026-09');
      expect((sep2026.endMs - sep2026.startMs) / (86400 * 1000)).toBe(30);

      // 31-day month (December 2026 spans to next calendar year 2027)
      const dec2026 = getPeriodTimestampRange('2026-12');
      const decEnd = new Date(dec2026.endMs);
      expect(decEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z');
      expect((dec2026.endMs - dec2026.startMs) / (86400 * 1000)).toBe(31);
    });
  });

  // =========================================================================
  // 5. DUAL-RAIL PAYOUT ENGINE & VIETQR CSV RESILIENCY
  // =========================================================================
  describe('5. Dual-Rail Payout Engine & VietQR CSV Resiliency', () => {
    let mockD1: {
      prepare: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockD1 = {
        prepare: vi.fn(),
      };
    });

    it('enforces minimum payout threshold ($50.00 = 5,000 cents) filtering', async () => {
      const selectStmt = {
        bind: vi.fn().mockImplementation((minCents: number) => {
          // Verify that D1 query filters with minimum cents threshold
          expect(minCents).toBe(DEFAULT_MIN_PAYOUT_CENTS);
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: 'p_eligible',
                  partner_code: 'ELIGIBLE_AFF',
                  payout_rail: 'VIETQR',
                  pending_payout_cents: 5000, // Exactly $50.00
                  usdt_trc20_address_encrypted: null,
                  bank_bin: '970422',
                  bank_account_number: '123456789',
                  bank_account_name: 'TEST ACC',
                },
              ],
            }),
          };
        }),
      };

      mockD1.prepare.mockReturnValueOnce(selectStmt);

      const batch = await createDualRailPayoutBatch(mockD1 as unknown as D1Database, {
        minPayoutCents: DEFAULT_MIN_PAYOUT_CENTS,
      });

      expect(batch.items.length).toBe(1);
      expect(batch.items[0].amountCents).toBe(5000);
      expect(batch.items[0].amountUsd).toBe(50);
    });

    it('defends against CSV Injection and special character corruption in VietQR exports', () => {
      const adversarialItems: PayoutBatchItem[] = [
        {
          affiliateId: 'p_inj_1',
          partnerCode: 'PARTNER,WITH,COMMAS',
          amountUsd: 100,
          amountCents: 10_000,
          rail: 'VIETQR',
          bankDetails: {
            bin: '970422',
            accountNumber: '0987654321',
            accountName: 'CONG TY "TNHH" PHAN MEM',
            amountVnd: 2_545_000,
          },
          memo: 'LINE1\nLINE2,PAYOUT',
        },
        {
          affiliateId: 'p_inj_2',
          partnerCode: '=CMD|\' /C calc\'!A0', // Excel Formula injection attack payload
          amountUsd: 150,
          amountCents: 15_000,
          rail: 'VIETQR',
          bankDetails: {
            bin: '970415',
            accountNumber: '1122334455',
            accountName: '@SUM(1+1)*cmd',
            amountVnd: 3_817_500,
          },
          memo: '+PAYROLL',
        },
      ];

      const csv = generateVietQrCsv(adversarialItems, { exchangeRateVnd: 25450 });

      // Ensure quotes are escaped per RFC 4180
      expect(csv).toContain('""TNHH""');
      expect(csv).toContain('"PARTNER,WITH,COMMAS"');
      expect(csv).toContain('"LINE1\nLINE2,PAYOUT"');

      // Ensure formulas are wrapped within quotes
      expect(csv).toContain('"=CMD|\' /C calc\'!A0"');
      expect(csv).toContain('"@SUM(1+1)*cmd"');
    });

    it('sanitizes VietQR payment links and handles malformed bank details', () => {
      const url = buildVietQrPaymentUrl(
        ' 970422-BIN ', // Dirty BIN with whitespace and dashes
        ' 0987 654 321 ', // Account number with spaces
        2545000.99, // Float amount
        ' SOPHIA THANH TOAN ',
        ' NGUYEN VAN A '
      );

      // Cleaned BIN and account number
      expect(url).toContain('970422-0987654321-compact2.png');
      expect(url).toContain('amount=2545001'); // Math.round
      expect(url).toContain('addInfo=SOPHIA%20THANH%20TOAN');
      expect(url).toContain('accountName=NGUYEN%20VAN%20A');
    });

    it('safely handles zero-balance or empty batches in dual rail execution', async () => {
      const emptyBatch: DualRailPayoutBatch = {
        batchId: 'BATCH_EMPTY',
        createdAt: new Date().toISOString(),
        rail: 'COMBINED',
        totalUsdtAmount: 0,
        totalVndAmount: 0,
        itemCount: 0,
        status: 'QUEUED',
        items: [],
      };

      const result = await executeDualRailBatch(mockD1 as unknown as D1Database, emptyBatch);
      expect(result.batchId).toBe('BATCH_EMPTY');
      expect(result.exportedCount).toBe(0);
      expect(result.vietQrItemCount).toBe(0);
      expect(result.usdtItemCount).toBe(0);
      expect(result.vietQrCsv).toBeUndefined();
    });

    it('prevents negative balances in D1 during payout deduction', async () => {
      const executeMultiPayoutSpy = vi.spyOn(nowpaymentsModule, 'executeMultiPayoutBatch').mockResolvedValue({
        batchId: 'BATCH_OVER_USDT',
        totalCount: 1,
        successCount: 1,
        failureCount: 0,
        externalPaymentIds: { p_over: 'PAY_123' },
        failures: [],
      });

      const batch: DualRailPayoutBatch = {
        batchId: 'BATCH_OVER',
        createdAt: new Date().toISOString(),
        rail: 'USDT',
        totalUsdtAmount: 100,
        totalVndAmount: 0,
        itemCount: 1,
        status: 'QUEUED',
        items: [
          {
            affiliateId: 'p_over',
            partnerCode: 'OVER_AFF',
            amountUsd: 100,
            amountCents: 10_000,
            rail: 'USDT',
            usdtAddress: 'TJ_TEST_ADDR',
          },
        ],
      };

      let capturedSql = '';
      const updateStmt = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      mockD1.prepare.mockImplementation((sql: string) => {
        capturedSql = sql;
        return updateStmt;
      });

      await executeDualRailBatch(mockD1 as unknown as D1Database, batch);

      // Verify that SQL uses MAX(0, pending_payout_cents - ?) to defend against balance underflow
      expect(capturedSql).toContain('MAX(0, pending_payout_cents - ?)');
      expect(updateStmt.bind).toHaveBeenCalledWith(10_000, expect.any(Number), 'p_over');

      executeMultiPayoutSpy.mockRestore();
    });
  });
});
