/**
 * Creator Royalty Split Engine Types & Interfaces.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/types
 */

import type { SettlementCurrency } from '@/seed/types/creator-dao-c2pa';

export type {
  ContractStatus,
  ContractType,
  ContractorTaxRegime,
  CreateLicensingContractInput,
  CreatorLicensingContract,
  CreatorRoyaltySettlement,
  ExecuteRoyaltySplitInput,
  RoyaltySettlementResult,
  SettlementCurrency,
  SettlementPayoutRail,
  SettlementStatus,
  SmartSplitWaterfallResult,
  SplitTier,
  TaxWithholdingResult,
} from '@/seed/types/creator-dao-c2pa';

export interface SplitWaterfallOptions {
  creatorSharePct?: number;
  platformSharePct?: number;
  daoTreasurySharePct?: number;
  lineageParentCreatorId?: string;
  rootCreatorId?: string;
}

export interface PayoutDestinationValidation {
  valid: boolean;
  error?: string;
}

export interface SettlementCurrencyDetails {
  settlementCurrency: SettlementCurrency;
  fxRateApplied: number;
  settlementAmount: number;
}

export interface ContractDbRow {
  id: string;
  contract_number: string;
  creator_id: string;
  dao_id: string | null;
  contract_title: string;
  contract_type: string;
  split_tier: string;
  creator_share_pct: number;
  platform_share_pct: number;
  dao_treasury_share_pct: number;
  commercial_rights: string;
  ai_training_permission: string;
  minimum_payout_cents: number;
  preferred_payout_rail: string;
  contractor_tax_regime: string;
  tax_withholding_rate_pct: number;
  tax_id_number: string | null;
  status: string;
  terms_canonical_json: string;
  contract_hash: string;
  creator_signature: string;
  starts_at: number;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SettlementDbRow {
  id: string;
  settlement_reference: string;
  contract_id: string;
  creator_id: string;
  template_id: string | null;
  batch_id: string | null;
  gross_royalty_cents: number;
  platform_fee_cents: number;
  dao_treasury_cents: number;
  contractor_tax_regime: string;
  tax_withholding_rate_pct: number;
  tax_withheld_cents: number;
  rail_fee_cents: number;
  net_payable_cents: number;
  payout_rail: string;
  settlement_currency: string;
  settlement_amount: number;
  fx_rate_applied: number;
  destination_address: string;
  destination_bank_bin: string | null;
  destination_name: string;
  status: string;
  tx_hash: string | null;
  qr_payload: string | null;
  idempotency_key: string;
  failure_reason: string | null;
  settled_at: number | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}
