/**
 * Enterprise Invoice Types & Row Mapper
 *
 * @module tree/billing/invoices/types
 */

import type {
  EInvoice,
  InvoiceStatus,
  TaxFormType,
  BillingCycle,
  SupportedCurrency,
} from '@/seed/types/enterprise-billing';

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  org_id: string;
  subaccount_id: string | null;
  tier: string;
  billing_cycle: string;
  amount_cents: number;
  currency: string;
  fx_rate: number;
  tax_id: string | null;
  legal_name: string;
  billing_address: string;
  vat_rate: number;
  vat_amount_cents: number;
  total_amount_cents: number;
  tax_form_type: string;
  status: string;
  pdf_r2_key: string | null;
  paid_at: number | null;
  created_at: number;
  updated_at: number;
}

export function mapRowToEInvoice(row: InvoiceRow): EInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    orgId: row.org_id,
    subaccountId: row.subaccount_id,
    tier: row.tier,
    billingCycle: (row.billing_cycle as BillingCycle) || 'annual',
    amountCents: row.amount_cents,
    currency: (row.currency as SupportedCurrency) || 'USD',
    fxRate: row.fx_rate,
    taxId: row.tax_id,
    legalName: row.legal_name,
    billingAddress: row.billing_address,
    vatRate: row.vat_rate,
    vatAmountCents: row.vat_amount_cents,
    totalAmountCents: row.total_amount_cents,
    taxFormType: (row.tax_form_type as TaxFormType) || 'NONE',
    status: (row.status as InvoiceStatus) || 'draft',
    pdfR2Key: row.pdf_r2_key,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
