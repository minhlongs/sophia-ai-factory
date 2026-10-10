/**
 * Dual-rail affiliate payout types and constants.
 *
 * Layer: land/payouts/dual-rail
 * Allowed imports: @/seed/*, @/land/payouts/*
 */

import type {
  PayoutRail,
  PayoutBatchItem,
  DualRailPayoutBatch,
} from '@/seed/types/affiliate-expansion-types';
import type { MultiPayoutBatchResult } from '../nowpayments-mass-payout';

/** Standard default conversion rate: 1 USD = 25,450 VND */
export const DEFAULT_USD_TO_VND_RATE = 25450;

/** Minimum payout threshold in cents ($50.00 USD = 5,000 cents) */
export const DEFAULT_MIN_PAYOUT_CENTS = 5000;

export interface DualRailBatchExecutionResult {
  batchId: string;
  usdtResult?: MultiPayoutBatchResult;
  vietQrCsv?: string;
  vietQrItemCount: number;
  usdtItemCount: number;
  exportedCount: number;
}

export type {
  PayoutRail,
  PayoutBatchItem,
  DualRailPayoutBatch,
  MultiPayoutBatchResult,
};
