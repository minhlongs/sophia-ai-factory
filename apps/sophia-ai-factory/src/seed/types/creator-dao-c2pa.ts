/**
 * Creator DAO Royalty Splits & C2PA Content Provenance Types
 *
 * Implements:
 * - Smart Split Waterfall (80/20 DAO & 70/30 Standard Marketplace)
 * - Multi-Currency Micro-Settlement Rails (USDC Arbitrum/Polygon, VietQR, PromptPay, SEPA)
 * - Cross-Border Contractor Tax Withholding
 * - C2PA Content Provenance Manifests, Assertions, Claims & Verification
 *
 * Layer: seed (Foundational types, zero dependencies on upper layers)
 *
 * @module seed/types/creator-dao-c2pa
 */

import { z } from 'zod';

// ─── Constants ───────────────────────────────────────────────────────────────

export const DAO_80_20_CREATOR_PCT = 80.0;
export const DAO_80_20_PLATFORM_PCT = 20.0;

export const STANDARD_70_30_CREATOR_PCT = 70.0;
export const STANDARD_70_30_PLATFORM_PCT = 30.0;

export const DEFAULT_MIN_SETTLEMENT_CENTS = 5000; // $50.00 USD
export const C2PA_CLAIM_GENERATOR_DEFAULT = 'Sophia-AI-Factory/1.0.0 (C2PA-Edge/2027)';
export const C2PA_DEFAULT_SIGNER_IDENTITY = 'SOPHIA_C2PA_ROOT_AUTHORITY_2027';

// ─── Enums & Schemas ─────────────────────────────────────────────────────────

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

// ─── Licensing Contract Types ────────────────────────────────────────────────

export interface CreatorLicensingContract {
  id: string;
  contractNumber: string;
  creatorId: string;
  daoId: string | null;
  contractTitle: string;
  contractType: ContractType;
  splitTier: SplitTier;
  creatorSharePct: number;
  platformSharePct: number;
  daoTreasurySharePct: number;
  revenueSharePercentage?: number;
  platformSharePercentage?: number;
  commercialRights: CommercialRights;
  aiTrainingPermission: AiTrainingPermission;
  minimumPayoutCents: number;
  preferredPayoutRail: SettlementPayoutRail;
  contractorTaxRegime: ContractorTaxRegime;
  taxWithholdingRatePct: number;
  taxIdNumber: string | null;
  status: ContractStatus;
  termsCanonicalJson: string;
  contractHash: string;
  creatorSignature: string;
  startsAt: number;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateLicensingContractInput {
  creatorId: string;
  daoId?: string | null;
  contractTitle: string;
  contractType: ContractType;
  splitTier: SplitTier;
  creatorSharePct?: number;
  platformSharePct?: number;
  daoTreasurySharePct?: number;
  commercialRights?: CommercialRights;
  aiTrainingPermission?: AiTrainingPermission;
  minimumPayoutCents?: number;
  preferredPayoutRail?: SettlementPayoutRail;
  contractorTaxRegime?: ContractorTaxRegime;
  taxWithholdingRatePct?: number;
  taxIdNumber?: string | null;
  startsAt?: number;
  expiresAt?: number | null;
  secretKey?: string;
}

// ─── Smart Split Waterfall & Settlement Types ────────────────────────────────

export interface SmartSplitWaterfallResult {
  grossRevenueCents: number;
  splitTier: SplitTier;
  creatorSharePct: number;
  platformSharePct: number;
  daoTreasurySharePct: number;
  creatorGrossCents: number;
  platformCents: number;
  daoTreasuryCents: number;
  // Multi-tier Lineage breakdown (if remix derivative)
  rootCreatorId?: string;
  rootCreatorCents?: number;
  remixerCreatorId?: string;
  remixerCents?: number;
  invarianceVerified: boolean;
}

export interface TaxWithholdingResult {
  grossCents: number;
  taxRegime: ContractorTaxRegime;
  taxRatePct: number;
  taxWithheldCents: number;
  netPayableCents: number;
  invarianceVerified: boolean;
}

export interface CreatorRoyaltySettlement {
  id: string;
  settlementReference: string;
  contractId: string;
  creatorId: string;
  templateId: string | null;
  batchId: string | null;
  grossRoyaltyCents: number;
  creatorGrossShareCents?: number;
  platformShareCents?: number;
  platformFeeCents: number;
  daoTreasuryCents: number;
  contractorTaxRegime: ContractorTaxRegime;
  taxWithholdingRatePct: number;
  taxWithheldCents: number;
  railFeeCents: number;
  netPayableCents: number;
  netPayoutCents?: number;
  payoutRail: SettlementPayoutRail;
  settlementCurrency: SettlementCurrency;
  settlementAmount: number;
  fxRateApplied: number;
  destinationAddress: string;
  destinationBankBin: string | null;
  destinationName: string;
  status: SettlementStatus;
  txHash: string | null;
  qrPayload: string | null;
  idempotencyKey: string;
  failureReason: string | null;
  settledAt: number | null;
  metadataJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExecuteRoyaltySplitInput {
  contractId: string;
  grossRevenueCents: number;
  templateId?: string;
  batchId?: string;
  activatingUserId?: string;
  lineageParentCreatorId?: string;
  idempotencyKey: string;
  fxRate?: number;
  payoutRail?: SettlementPayoutRail;
  destinationAddress?: string;
  destinationBankBin?: string;
  destinationName?: string;
  metadata?: Record<string, unknown>;
}

export interface RoyaltySettlementResult {
  success: boolean;
  settlementId: string;
  settlementReference: string;
  waterfall: SmartSplitWaterfallResult;
  taxWithholding: TaxWithholdingResult;
  settlementRecord?: CreatorRoyaltySettlement;
  error?: string;
}

// ─── C2PA Content Provenance Types ───────────────────────────────────────────

export interface C2paAssertion {
  label: string;
  data: Record<string, unknown>;
}

export interface C2paIngredient {
  title: string;
  format: string;
  documentId: string;
  relationship: 'parentOf' | 'componentOf' | 'inputTo';
  hash: string; // SHA-256
}

export interface C2paClaim {
  claimGenerator: string;
  title: string;
  format: string;
  instanceId: string; // URN
  assertions: C2paAssertion[];
  ingredients: C2paIngredient[];
  signatureAlgorithm: 'HMAC-SHA256' | 'Ed25519' | 'ES256';
}

export interface C2paProvenanceManifestRecord {
  id: string;
  manifestId: string;
  assetId: string;
  assetSha256: string;
  claimGenerator: string;
  title: string;
  format: string;
  claimCanonicalJson: string;
  manifestHash: string;
  signerIdentity: string;
  signatureAlgorithm: string;
  digitalSignature: string;
  assertionsJson: string;
  ingredientsJson: string;
  tamperStatus: C2paTamperStatus;
  verifiedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateC2paManifestInput {
  assetId: string;
  assetBytesOrSha256: string | Uint8Array | ArrayBuffer;
  title: string;
  format?: string;
  creatorId: string;
  licensingContractId?: string;
  daoId?: string;
  aiModelsUsed?: Array<{ name: string; version: string; role: string; promptHash?: string }>;
  dubbingDetails?: { sourceLang: string; targetLang: string; voiceModel: string };
  ingredients?: C2paIngredient[];
  customAssertions?: C2paAssertion[];
  signingSecret?: string;
}

export interface C2paVerificationResult {
  isValid: boolean;
  tamperDetected: boolean;
  tamperReason?:
    | 'ASSET_SHA256_MISMATCH'
    | 'SIGNATURE_INVALID'
    | 'MANIFEST_HASH_TAMPERED'
    | 'RECORD_NOT_FOUND';
  manifestId: string;
  assetId: string;
  storedAssetSha256: string;
  computedAssetSha256?: string;
  signatureValid: boolean;
  hashChainValid: boolean;
  verifiedAt: number;
}
