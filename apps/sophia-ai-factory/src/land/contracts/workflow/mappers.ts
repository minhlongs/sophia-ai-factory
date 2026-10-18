/**
 * Enterprise Quote-to-Cash Row Mappers
 *
 * Layer: land (Business domain entity mappers)
 *
 * @module land/contracts/workflow/mappers
 */

import type {
  EnterpriseQuote,
  EnterpriseContract,
} from '@/seed/types/enterprise-contracts';
import type { EnterpriseQuoteRow, EnterpriseContractRow } from './types';

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
