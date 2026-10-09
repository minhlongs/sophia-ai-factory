/**
 * Enterprise Quote-to-Cash Workflow Types & Mappers
 *
 * Layer: land (Business domain types & entity mappers)
 *
 * @module land/contracts/workflow/types
 */

import type {
  EnterpriseQuote,
  EnterpriseContract,
  EnterpriseQuoteStatus,
  EnterpriseContractStatus,
  PaymentRail,
} from '@/seed/types/enterprise-contracts';

export interface EnterpriseQuoteRow {
  id: string;
  deal_id: string | null;
  org_id: string;
  quote_number: string;
  mcu_capacity_monthly: number;
  sla_uptime_percent: number;
  billing_cycle: 'monthly' | 'annual';
  base_price_cents: number;
  volume_discount_percent: number;
  annual_discount_percent: number;
  final_price_cents: number;
  final_price_vnd: number | null;
  currency: 'USD' | 'VND';
  status: EnterpriseQuoteStatus;
  expires_at: number;
  created_at: number;
  updated_at: number;
}

export interface EnterpriseContractRow {
  id: string;
  deal_id: string | null;
  org_id: string;
  quote_id: string | null;
  contract_number: string;
  status: EnterpriseContractStatus;
  sla_uptime_percent: number;
  mcu_capacity_monthly: number;
  billing_cycle: 'monthly' | 'annual';
  unit_price_per_mcu_cents: number;
  volume_discount_percent: number;
  monthly_commitment_cents: number;
  annual_commitment_cents: number;
  currency: 'USD' | 'VND';
  contract_sha256: string;
  terms_version: string;
  customer_signer_name: string | null;
  customer_signer_email: string | null;
  customer_signer_title: string | null;
  customer_signer_ip: string | null;
  customer_signature_hash: string | null;
  customer_signed_at: number | null;
  platform_signature_hash: string | null;
  platform_signed_at: number | null;
  effective_date: string;
  expiration_date: string;
  payment_rail: PaymentRail | null;
  last_invoice_id: string | null;
  created_at: number;
  updated_at: number;
}

export function mapRowToQuote(row: EnterpriseQuoteRow): EnterpriseQuote {
  return {
    id: row.id,
    dealId: row.deal_id,
    orgId: row.org_id,
    quoteNumber: row.quote_number,
    mcuCapacityMonthly: row.mcu_capacity_monthly,
    slaUptimePercent: row.sla_uptime_percent,
    billingCycle: row.billing_cycle,
    basePriceCents: row.base_price_cents,
    volumeDiscountPercent: row.volume_discount_percent,
    annualDiscountPercent: row.annual_discount_percent,
    finalPriceCents: row.final_price_cents,
    finalPriceVnd: row.final_price_vnd,
    currency: row.currency,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToContract(row: EnterpriseContractRow): EnterpriseContract {
  return {
    id: row.id,
    dealId: row.deal_id,
    orgId: row.org_id,
    quoteId: row.quote_id,
    contractNumber: row.contract_number,
    status: row.status,
    slaUptimePercent: row.sla_uptime_percent,
    mcuCapacityMonthly: row.mcu_capacity_monthly,
    billingCycle: row.billing_cycle,
    unitPricePerMcuCents: row.unit_price_per_mcu_cents,
    volumeDiscountPercent: row.volume_discount_percent,
    monthlyCommitmentCents: row.monthly_commitment_cents,
    annualCommitmentCents: row.annual_commitment_cents,
    currency: row.currency,
    contractSha256: row.contract_sha256,
    termsVersion: row.terms_version,
    customerSignerName: row.customer_signer_name,
    customerSignerEmail: row.customer_signer_email,
    customerSignerTitle: row.customer_signer_title,
    customerSignerIp: row.customer_signer_ip,
    customerSignatureHash: row.customer_signature_hash,
    customerSignedAt: row.customer_signed_at,
    platformSignatureHash: row.platform_signature_hash,
    platformSignedAt: row.platform_signed_at,
    effectiveDate: row.effective_date,
    expirationDate: row.expiration_date,
    paymentRail: row.payment_rail,
    lastInvoiceId: row.last_invoice_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateQuoteInput {
  orgId: string;
  mcuCapacityMonthly: number;
  billingCycle?: 'monthly' | 'annual';
  dealId?: string;
  currency?: 'USD' | 'VND';
  fxRateVnd?: number;
  validityDays?: number;
}

export interface InitiatePaymentInput {
  contractId: string;
  paymentRail: 'NOWPAYMENTS' | 'PAYOS';
  userId: string;
  customerEmail?: string;
  customerName?: string;
}

export interface ContractPaymentInitiationResult {
  paymentRail: PaymentRail;
  orderId: string;
  invoiceId: string;
  checkoutUrl: string;
  qrUrl?: string;
  amountCents: number;
}

export interface FulfillPaymentInput {
  contractId: string;
  paymentRail: PaymentRail;
  paymentReference: string;
  paidByUserId: string;
  amountPaidCents?: number;
}

export interface FulfillPaymentResult {
  success: boolean;
  contractId: string;
  status: EnterpriseContractStatus;
  creditsProvisioned: number;
  invoiceId: string | null;
}
