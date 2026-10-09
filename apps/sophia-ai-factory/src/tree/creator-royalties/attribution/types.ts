/**
 * @file types.ts
 * @description Types for creator royalty calculation, ledger accrual, and lineage verification.
 * @layer tree
 */

export interface AccrueLedgerInput {
  creatorId: string;
  amountCents: number;
  currency?: string;
  eventType?: 'royalty_accrual' | 'royalty_payout' | 'royalty_clawback' | 'adjustment';
  sourceType?: string;
  referenceId: string;
  status?: 'pending' | 'payable' | 'paid' | 'clawed_back';
  metadata?: Record<string, unknown>;
}

export interface AccrueLedgerResult {
  success: boolean;
  ledgerId: string;
  newBalanceCents: number;
  sequenceNum: number;
  error?: string;
}

export interface InsertLedgerParams {
  ledgerId: string;
  creatorId: string;
  sourceType: string;
  referenceId: string;
  amountCents: number;
  status: string;
  nowMs: number;
  balanceAfterCents: number;
  sequenceNum: number;
  eventType: string;
  currency: string;
  metadataJson: string;
}

export interface BlueprintLineageRow {
  id: string;
  creator_id?: string | null;
  parent_blueprint_id?: string | null;
}
