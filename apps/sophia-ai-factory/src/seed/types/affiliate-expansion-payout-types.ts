/**
 * Affiliate Dual-Rail Payout & Leaderboard Domain Types
 *
 * @module seed/types/affiliate-expansion-payout-types
 */

import type { AffiliateTier } from './affiliate-expansion-types';

/** Supported payout rails */
export type PayoutRail = 'USDT' | 'VIETQR';

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
