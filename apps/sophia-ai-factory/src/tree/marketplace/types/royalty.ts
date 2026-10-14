/**
 * Creator Marketplace Royalty Engine & Balance Contracts
 *
 * Layer: tree/marketplace/types
 */

import type { D1Database } from '@/seed/db/client';
import type { PayoutRail, WithdrawalStatus } from './enums';

export interface RoyaltySplit {
  creatorCents: number;
  platformCents: number;
  totalCents: number;
}

export interface RoyaltyAccrualInput {
  db: D1Database;
  templateId: string;
  creatorId: string;
  activatingUserId: string;
  tenantId: string;
  priceCents: number;
  royaltyPct?: number;
  referenceId?: string;
  videoJobId?: string;
  nowMs?: number;
}

export interface RoyaltyAccrualResult {
  success: boolean;
  activationId: string;
  creatorCents: number;
  platformCents: number;
  ledgerId: string;
  sequenceNum: number;
  balanceAfterCents: number;
  error?: string;
}

export interface WithdrawalRequestInput {
  db: D1Database;
  creatorId: string;
  amountCents: number;
  rail: PayoutRail;
  destinationAddress?: string;
  bankBin?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  txHash?: string;
  nowMs?: number;
}

export interface WithdrawalRequestResult {
  success: boolean;
  withdrawalId: string;
  amountCents: number;
  rail: PayoutRail;
  status: WithdrawalStatus;
  ledgerId?: string;
  sequenceNum?: number;
  remainingBalanceCents?: number;
  txHash?: string;
  error?: string;
}

export interface CreatorBalanceSummary {
  creatorId: string;
  totalEarnedCents: number;
  totalWithdrawnCents: number;
  availableBalanceCents: number;
  lastSequenceNum: number;
}
