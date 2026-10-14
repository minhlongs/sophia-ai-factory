export type EnterpriseContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'signed'
  | 'active'
  | 'suspended'
  | 'terminated'
  | 'expired';

export type PaymentRail = 'NOWPAYMENTS' | 'PAYOS' | 'MANUAL';

export const CURRENT_TERMS_VERSION = '2026.1-ENTERPRISE-SLA';

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
