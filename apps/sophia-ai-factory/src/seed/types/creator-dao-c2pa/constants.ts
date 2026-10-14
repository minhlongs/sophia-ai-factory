/**
 * Creator DAO Royalty Splits & C2PA Constants and Enums
 * Layer: seed
 */

import { z } from 'zod';

export const DAO_80_20_CREATOR_PCT = 80.0;
export const DAO_80_20_PLATFORM_PCT = 20.0;

export const STANDARD_70_30_CREATOR_PCT = 70.0;
export const STANDARD_70_30_PLATFORM_PCT = 30.0;

export const DEFAULT_MIN_SETTLEMENT_CENTS = 5000; // $50.00 USD
export const C2PA_CLAIM_GENERATOR_DEFAULT = 'Sophia-AI-Factory/1.0.0 (C2PA-Edge/2027)';
export const C2PA_DEFAULT_SIGNER_IDENTITY = 'SOPHIA_C2PA_ROOT_AUTHORITY_2027';

export const ContractTypeSchema = z.enum([
  'standard_marketplace',
  'dao_exclusive',
  'co_production',
  'syndication_franchise',
]);
export type ContractType = z.infer<typeof ContractTypeSchema>;

export const SplitTierSchema = z.enum(['DAO_80_20', 'STANDARD_70_30', 'CUSTOM']);
export type SplitTier = z.infer<typeof SplitTierSchema>;

export const ContractStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'active',
  'suspended',
  'terminated',
  'expired',
]);
export type ContractStatus = z.infer<typeof ContractStatusSchema>;

export const CommercialRightsSchema = z.enum(['exclusive', 'non_exclusive', 'sole']);
export type CommercialRights = z.infer<typeof CommercialRightsSchema>;

export const AiTrainingPermissionSchema = z.enum([
  'prohibited',
  'allowed_with_attribution',
  'licensed',
]);
export type AiTrainingPermission = z.infer<typeof AiTrainingPermissionSchema>;

export const SettlementPayoutRailSchema = z.enum([
  'NOWPAYMENTS_USDC_ARBITRUM',
  'NOWPAYMENTS_USDC_POLYGON',
  'PAYOS_VIETQR',
  'PROMPTPAY',
  'SEPA_INSTANT',
]);
export type SettlementPayoutRail = z.infer<typeof SettlementPayoutRailSchema>;

export const SettlementCurrencySchema = z.enum(['USDC', 'USDT', 'VND', 'THB', 'EUR', 'USD']);
export type SettlementCurrency = z.infer<typeof SettlementCurrencySchema>;

export const ContractorTaxRegimeSchema = z.enum([
  'VN_CONTRACTOR_10PCT',
  'VN_CONTRACTOR_5PCT',
  'US_W8BEN_30PCT',
  'US_W8BEN_TREATY_10PCT',
  'TH_WHT_3PCT',
  'EU_REVERSE_CHARGE_0PCT',
  'EXEMPT_NONE',
]);
export type ContractorTaxRegime = z.infer<typeof ContractorTaxRegimeSchema>;

export const STATUTORY_TAX_RATES: Record<ContractorTaxRegime, number> = {
  VN_CONTRACTOR_10PCT: 10.0,
  VN_CONTRACTOR_5PCT: 5.0,
  US_W8BEN_30PCT: 30.0,
  US_W8BEN_TREATY_10PCT: 10.0,
  TH_WHT_3PCT: 3.0,
  EU_REVERSE_CHARGE_0PCT: 0.0,
  EXEMPT_NONE: 0.0,
};

export const SettlementStatusSchema = z.enum([
  'pending',
  'queued',
  'processing',
  'settled',
  'failed',
  'disputed',
  'reverted',
]);
export type SettlementStatus = z.infer<typeof SettlementStatusSchema>;

export const C2paActionTypeSchema = z.enum([
  'c2pa.created',
  'c2pa.ai_generated',
  'c2pa.dubbed',
  'c2pa.translated',
  'c2pa.watermarked',
  'c2pa.voice_synthesized',
  'c2pa.remixed',
]);
export type C2paActionType = z.infer<typeof C2paActionTypeSchema>;

export const C2paTamperStatusSchema = z.enum(['valid', 'tampered', 'revoked', 'unknown']);
export type C2paTamperStatus = z.infer<typeof C2paTamperStatusSchema>;
