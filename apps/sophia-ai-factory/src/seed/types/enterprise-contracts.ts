/**
 * Enterprise Custom SLA Contracts, Quotes, Volume Discounts & Digital Signatures
 *
 * Layer: seed (Foundational types, interfaces, and constants)
 * Strict 4-layer architecture: Zero upper-layer imports (no tree, forest, land).
 *
 * @module seed/types/enterprise-contracts
 */

export type EnterpriseSlaTier = '99.9%';

export type VolumeDiscountBracketCode =
  | 'SCALE_50K'
  | 'SCALE_100K'
  | 'SCALE_250K'
  | 'SCALE_500K';

export interface VolumeDiscountBracket {
  code: VolumeDiscountBracketCode;
  minMcu: number;
  maxMcu: number;
  basePriceCents: number; // 5.0 cents ($0.050)
  discountPercent: number; // 0.20, 0.30, 0.45, 0.60
  effectivePricePerMcuCents: number; // 4.0, 3.5, 2.75, 2.0 cents
}

export const BASE_ENTERPRISE_MCU_PRICE_CENTS = 5.0; // $0.050 / MCU
export const ANNUAL_COMMITMENT_DISCOUNT_PERCENT = 0.17; // 17% savings for annual billing
export const DEFAULT_SLA_UPTIME_PERCENT = 99.9;
export const CURRENT_TERMS_VERSION = '2026.1-ENTERPRISE-SLA';
export const MIN_ENTERPRISE_MCU = 50_000;
export const MAX_ENTERPRISE_MCU = 500_000;

export const VOLUME_DISCOUNT_BRACKETS: readonly VolumeDiscountBracket[] = [
  {
    code: 'SCALE_50K',
    minMcu: 50_000,
    maxMcu: 99_999,
    basePriceCents: 5.0,
    discountPercent: 0.20,
    effectivePricePerMcuCents: 4.0,
  },
  {
    code: 'SCALE_100K',
    minMcu: 100_000,
    maxMcu: 249_999,
    basePriceCents: 5.0,
    discountPercent: 0.30,
    effectivePricePerMcuCents: 3.5,
  },
  {
    code: 'SCALE_250K',
    minMcu: 250_000,
    maxMcu: 499_999,
    basePriceCents: 5.0,
    discountPercent: 0.45,
    effectivePricePerMcuCents: 2.75,
  },
  {
    code: 'SCALE_500K',
    minMcu: 500_000,
    maxMcu: Number.POSITIVE_INFINITY,
    basePriceCents: 5.0,
    discountPercent: 0.60,
    effectivePricePerMcuCents: 2.0,
  },
] as const;

export interface VolumeDiscountResult {
  mcuCapacityMonthly: number;
  billingCycle: 'monthly' | 'annual';
  bracket: VolumeDiscountBracket;
  unitPricePerMcuCents: number;
  monthlyCommitmentCents: number;
  annualCommitmentCents: number;
  annualSavingsCents: number;
  effectiveRateDisplayUsd: string;
  monthlyCommitmentUsd: number;
  annualCommitmentUsd: number;
}

export type EnterpriseQuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired';

export interface EnterpriseQuote {
  id: string;
  dealId?: string | null;
  orgId: string;
  quoteNumber: string;
  mcuCapacityMonthly: number;
  slaUptimePercent: number;
  billingCycle: 'monthly' | 'annual';
  basePriceCents: number;
  volumeDiscountPercent: number;
  annualDiscountPercent: number;
  finalPriceCents: number;
  finalPriceVnd?: number | null;
  currency: 'USD' | 'VND';
  status: EnterpriseQuoteStatus;
  expiresAt: number; // Unix timestamp seconds
  createdAt: number;
  updatedAt: number;
}

export type EnterpriseContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'signed'
  | 'active'
  | 'suspended'
  | 'terminated'
  | 'expired';

export type PaymentRail = 'NOWPAYMENTS' | 'PAYOS' | 'MANUAL';

export interface EnterpriseContract {
  id: string;
  dealId?: string | null;
  orgId: string;
  quoteId?: string | null;
  contractNumber: string;
  status: EnterpriseContractStatus;
  slaUptimePercent: number;
  mcuCapacityMonthly: number;
  billingCycle: 'monthly' | 'annual';
  unitPricePerMcuCents: number;
  volumeDiscountPercent: number;
  monthlyCommitmentCents: number;
  annualCommitmentCents: number;
  currency: 'USD' | 'VND';
  contractSha256: string;
  termsVersion: string;
  customerSignerName?: string | null;
  customerSignerEmail?: string | null;
  customerSignerTitle?: string | null;
  customerSignerIp?: string | null;
  customerSignatureHash?: string | null;
  customerSignedAt?: number | null;
  platformSignatureHash?: string | null;
  platformSignedAt?: number | null;
  effectiveDate: string; // YYYY-MM-DD
  expirationDate: string; // YYYY-MM-DD
  paymentRail?: PaymentRail | null;
  lastInvoiceId?: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Payload fields that are canonically ordered and hashed to produce contractSha256.
 * Adheres to RFC-8785 JSON canonicalization rules.
 */
export interface ContractSignablePayload {
  contractNumber: string;
  orgId: string;
  mcuCapacityMonthly: number;
  slaUptimePercent: number;
  billingCycle: 'monthly' | 'annual';
  unitPricePerMcuCents: number;
  monthlyCommitmentCents: number;
  annualCommitmentCents: number;
  currency: 'USD' | 'VND';
  effectiveDate: string;
  expirationDate: string;
  termsVersion: string;
}

export interface CustomerSignerInput {
  signerName: string;
  signerEmail: string;
  signerTitle: string;
  signerIp?: string;
  signingSecret?: string;
}

export interface ContractSignatureVerificationResult {
  isValid: boolean;
  contractSha256: string;
  customerSignatureValid: boolean;
  platformSignatureValid: boolean;
  reason?: string;
}

export interface SlaRemedyTier {
  minAvailabilityPercent: number;
  maxAvailabilityPercent: number;
  creditPercent: number;
  descriptionVi: string;
  descriptionEn: string;
}

export const SLA_SERVICE_CREDIT_SCHEDULE: readonly SlaRemedyTier[] = [
  {
    minAvailabilityPercent: 99.9,
    maxAvailabilityPercent: 100.0,
    creditPercent: 0,
    descriptionVi: 'Đạt cam kết SLA (>= 99.9%) — Không áp dụng hoàn tiền',
    descriptionEn: 'SLA target met (>= 99.9%) — No service credit applicable',
  },
  {
    minAvailabilityPercent: 99.0,
    maxAvailabilityPercent: 99.89,
    creditPercent: 10,
    descriptionVi: 'Suy giảm nhẹ (99.0% – 99.89%) — Hoàn lại 10% phí chu kỳ',
    descriptionEn: 'Minor degradation (99.0% – 99.89%) — 10% cycle credit remedy',
  },
  {
    minAvailabilityPercent: 95.0,
    maxAvailabilityPercent: 98.99,
    creditPercent: 25,
    descriptionVi: 'Suy giảm trung bình (95.0% – 98.99%) — Hoàn lại 25% phí chu kỳ',
    descriptionEn: 'Moderate degradation (95.0% – 98.99%) — 25% cycle credit remedy',
  },
  {
    minAvailabilityPercent: 0.0,
    maxAvailabilityPercent: 94.99,
    creditPercent: 50,
    descriptionVi: 'Suy giảm nghiêm trọng (< 95.0%) — Hoàn lại 50% phí chu kỳ',
    descriptionEn: 'Critical degradation (< 95.0%) — 50% cycle credit remedy',
  },
] as const;
