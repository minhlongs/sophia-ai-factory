/**
 * Multi-Rail Batch Settlement Types & DTOs
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/types
 */

import type {
  PartnerPayoutBatch,
  PayoutBatchType,
  PayoutRail,
  PayoutBatchExecutionResult,
} from '@/tree/partners/types';

export type { PayoutBatchExecutionResult };

export interface CreatePayoutBatchOptions {
  fxRate?: number;
  destinationAddress?: string;
  claimIds?: string[];
  commissionIds?: string[];
}

export interface CreatePayoutBatchObjectParams {
  partnerId?: string | null;
  batchType: PayoutBatchType;
  payoutRail?: PayoutRail;
  rail?: PayoutRail;
  currency?: 'USD' | 'VND' | 'USDT';
  claimIds?: string[];
  commissionIds?: string[];
  fxRate?: number;
  destinationAddress?: string;
}

export interface CreatePayoutBatchResult {
  success: boolean;
  batch?: PartnerPayoutBatch;
  itemCount: number;
  totalAmountCents: number;
  totalAmountLocal: number;
  commissionsClaimedCount: number;
  coOpClaimsClaimedCount: number;
  error?: string;
}

export type GatewayDispatcher = (
  batch: PartnerPayoutBatch,
) => Promise<{
  success: boolean;
  externalReference?: string;
  txHash?: string;
  rawResponse?: Record<string, unknown>;
  error?: string;
}>;

export interface NormalizedBatchArgs {
  partnerId: string | null;
  batchType: PayoutBatchType;
  rail: PayoutRail;
  currency: 'USD' | 'VND' | 'USDT';
  options?: CreatePayoutBatchOptions;
}
