import type { PayoutRail } from './partner';

export type PayoutStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface AffiliatePayoutRow {
  id: string;
  payout_reference: string;
  partner_id: string;
  rail: PayoutRail;
  amount_cents: number;
  currency: string;
  destination_encrypted: string;
  status: PayoutStatus;
  commission_count: number;
  tx_hash_or_bank_ref: string | null;
  approved_by: string | null;
  approved_at: number | null;
  failure_reason: string | null;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface PayoutBatchWithdrawal {
  partnerId: string;
  address: string;
  amount: number;
}

export interface PayoutBatchRequest {
  batchId: string;
  currency: 'usdttrc20' | 'vnd';
  withdrawals: PayoutBatchWithdrawal[];
}
