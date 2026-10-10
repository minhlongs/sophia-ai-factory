/**
 * Creator Withdrawal Types & Mappers
 *
 * Layer: land/creator/withdrawals
 */

import type {
  WithdrawalRequest,
  WithdrawalStatus,
  PayoutRail,
} from '@/seed/types/creator-marketplace';

export interface WithdrawalDbRow {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  rail: string;
  destination_address: string | null;
  bank_bin: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  status: string;
  tx_hash: string | null;
  admin_notes: string | null;
  created_at: number;
  updated_at: number;
}

export function mapWithdrawalRow(row: WithdrawalDbRow): WithdrawalRequest {
  return {
    id: row.id,
    creatorId: row.creator_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    rail: row.rail as PayoutRail,
    destinationAddress: row.destination_address,
    bankBin: row.bank_bin,
    bankAccountNumber: row.bank_account_number,
    bankAccountName: row.bank_account_name,
    status: row.status as WithdrawalStatus,
    txHash: row.tx_hash,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
