/**
 * Affiliate Expansion & Dual-Rail Payout Domain Types
 *
 * Defines models for 2-Tier Master Affiliate progression (Silver 20%, Gold 25%, Platinum 30%),
 * public monthly leaderboard rankings, and dual-rail payout settlements (NOWPayments USDT + VietQR NAPAS 247).
 *
 * @module seed/types/affiliate-expansion-types
 */

/** Canonical partner tier classification based on activated MRR */
export type AffiliateTier = 'SILVER' | 'GOLD' | 'PLATINUM';

/** Supported payout rails */
export type PayoutRail = 'USDT' | 'VIETQR';

/** Tier progression rule configurations */
export interface AffiliateTierConfig {
  tier: AffiliateTier;
  commissionRatePct: number; // Silver: 20%, Gold: 25%, Platinum: 30%
  tier2RatePct: number;      // 5% override across all tiers
  minMrrUsd: number;         // 0, 1000, 5000
  minMrrCents: number;       // 0, 100000, 500000
  badgeNameEn: string;
  badgeNameVi: string;
  badgeColorHex: string;
  descriptionEn: string;
  descriptionVi: string;
}

/** Standard Tier Thresholds and Configurations */
export const AFFILIATE_TIER_CONFIGS: Record<AffiliateTier, AffiliateTierConfig> = {
  SILVER: {
    tier: 'SILVER',
    commissionRatePct: 20.0,
    tier2RatePct: 5.0,
    minMrrUsd: 0,
    minMrrCents: 0,
    badgeNameEn: 'Silver Partner',
    badgeNameVi: 'Đối tác Bạc',
    badgeColorHex: '#94a3b8', // slate-400
    descriptionEn: 'Starting tier with 20% recurring commission on all direct sales.',
    descriptionVi: 'Hạng khởi đầu với 20% hoa hồng định kỳ cho mọi đơn hàng trực tiếp.',
  },
  GOLD: {
    tier: 'GOLD',
    commissionRatePct: 25.0,
    tier2RatePct: 5.0,
    minMrrUsd: 1000,
    minMrrCents: 100_000, // $1,000 in cents
    badgeNameEn: 'Gold Partner',
    badgeNameVi: 'Đối tác Vàng',
    badgeColorHex: '#f59e0b', // amber-500
    descriptionEn: 'Intermediate tier unlocked at $1,000+ MRR with 25% recurring commission.',
    descriptionVi: 'Hạng trung cấp kích hoạt khi đạt $1,000+ MRR với 25% hoa hồng định kỳ.',
  },
  PLATINUM: {
    tier: 'PLATINUM',
    commissionRatePct: 30.0,
    tier2RatePct: 5.0,
    minMrrUsd: 5000,
    minMrrCents: 500_000, // $5,000 in cents
    badgeNameEn: 'Platinum Master',
    badgeNameVi: 'Đối tác Bạch Kim',
    badgeColorHex: '#38bdf8', // sky-400
    descriptionEn: 'Elite master tier unlocked at $5,000+ MRR with 30% top-bracket recurring commission.',
    descriptionVi: 'Hạng cao cấp ưu tú kích hoạt khi đạt $5,000+ MRR với 30% hoa hồng tối đa.',
  },
};

/** Result of an affiliate tier evaluation and upgrade */
export interface TierUpgradeEvaluationResult {
  affiliateId: string;
  partnerCode: string;
  previousTier: AffiliateTier | string;
  newTier: AffiliateTier;
  upgraded: boolean;
  activatedMrrCents: number;
  activatedMrrUsd: number;
  commissionRatePct: number;
  tier2RatePct: number;
  evaluatedAt: string;
}

/** Vietnamese bank account details for VietQR / NAPAS 247 domestic transfers */
export interface VietQrBankDetails {
  bin: string;           // Bank BIN code, e.g. "970422" (MBBank), "970415" (VietinBank)
  bankName?: string;     // e.g. "MBBank", "Vietcombank"
  accountNumber: string; // Recipient account number
  accountName: string;   // Recipient account owner name
  amountVnd: number;     // Converted VND amount
}

/** Item representing an individual affiliate payout in a batch */
export interface PayoutBatchItem {
  affiliateId: string;
  partnerCode: string;
  amountUsd: number;
  amountCents: number;
  rail: PayoutRail;
  usdtAddress?: string;
  bankDetails?: VietQrBankDetails;
  memo?: string;
}

/** Row formatted for NAPAS 247 banking batch CSV upload */
export interface VietQrBatchRow {
  index: number;
  partnerCode: string;
  bankBin: string;
  bankAccountNumber: string;
  bankAccountName: string;
  amountVnd: number;
  amountUsd: number;
  memo: string;
  payoutStatus: string;
}

/** Aggregate dual-rail batch data structure */
export interface DualRailPayoutBatch {
  batchId: string;
  createdAt: string;
  rail: PayoutRail | 'COMBINED';
  totalUsdtAmount: number;
  totalVndAmount: number;
  itemCount: number;
  status: 'QUEUED' | 'PROCESSED' | 'FAILED' | 'PARTIAL';
  items: PayoutBatchItem[];
}

/** Ranked affiliate item on the monthly public leaderboard */
export interface LeaderboardEntry {
  rank: number;
  partnerCode: string;
  displayName: string;
  maskedCode: string;
  tier: AffiliateTier;
  monthlyMrrUsd: number;
  activeConversions: number;
  commissionEarnedUsd: number;
  bonusRewardUsd: number;
  isTopThree: boolean;
}

/** Monthly Leaderboard Summary representation */
export interface LeaderboardSummary {
  period: string; // Format: "YYYY-MM"
  totalPrizePoolUsd: number; // Standard: 850 USD
  topAffiliates: LeaderboardEntry[];
  updatedAt: string;
}

/** Bonus prize distribution by rank */
export const LEADERBOARD_BONUS_POOL = {
  RANK_1_USD: 500,
  RANK_2_USD: 250,
  RANK_3_USD: 100,
  TOTAL_POOL_USD: 850,
} as const;
