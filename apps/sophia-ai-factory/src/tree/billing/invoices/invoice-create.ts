/**
 * Enterprise invoice creation (Cloudflare D1)
 *
 * @module tree/billing/invoices/invoice-create
 */

import { logger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  EInvoice,
  CreateInvoiceInput,
  InvoiceStatus,
  TaxFormType,
  BillingCycle,
  SupportedCurrency,
} from '@/seed/types/enterprise-billing';
import { generateInvoiceNumber } from './tax-validator';

/**
 * Create a new invoice record in Cloudflare D1.
 */
export async function createInvoiceRecord(
  db: D1Database,
  input: CreateInvoiceInput,
): Promise<EInvoice> {
  const now = Math.floor(Date.now() / 1000);
  const id = `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const invoiceNumber = generateInvoiceNumber();

  const billingCycle: BillingCycle = input.billingCycle ?? 'annual';
  const currency: SupportedCurrency = input.currency ?? 'USD';
  const fxRate = input.fxRate ?? 1.0;

  // Determine VAT rate: 10% for domestic VND software by default, 0% for international cross-border
  const vatRate = input.vatRate !== undefined
    ? input.vatRate
    : (currency === 'VND' ? 0.10 : 0.0);

  const vatAmountCents = input.vatAmountCents !== undefined
    ? input.vatAmountCents
    : Math.round(input.amountCents * vatRate);

  const totalAmountCents = input.totalAmountCents !== undefined
    ? input.totalAmountCents
    : input.amountCents + vatAmountCents;

  const taxFormType: TaxFormType = input.taxFormType ?? 'NONE';
  const status: InvoiceStatus = 'draft';

  await db
    .prepare(
      `INSERT INTO invoices (
        id, invoice_number, org_id, subaccount_id, tier,
        billing_cycle, amount_cents, currency, fx_rate, tax_id,
        legal_name, billing_address, vat_rate, vat_amount_cents, total_amount_cents,
        tax_form_type, status, pdf_r2_key, paid_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`,
    )
    .bind(
      id,
      invoiceNumber,
      input.orgId,
      input.subaccountId ?? null,
      input.tier,
      billingCycle,
      input.amountCents,
      currency,
      fxRate,
      input.taxId ?? null,
      input.legalName,
      input.billingAddress,
      vatRate,
      vatAmountCents,
      totalAmountCents,
      taxFormType,
      status,
      null,
      null,
      now,
      now,
    )
    .run();

  logger.info('[InvoiceGenerator] Invoice record created in D1', {
    id,
    invoiceNumber,
    orgId: input.orgId,
    totalAmountCents,
    currency,
  });

  return {
    id,
    invoiceNumber,
    orgId: input.orgId,
    subaccountId: input.subaccountId ?? null,
    tier: input.tier,
    billingCycle,
    amountCents: input.amountCents,
    currency,
    fxRate,
    taxId: input.taxId ?? null,
    legalName: input.legalName,
    billingAddress: input.billingAddress,
    vatRate,
    vatAmountCents,
    totalAmountCents,
    taxFormType,
    status,
    pdfR2Key: null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    lineItems: input.lineItems,
    paymentRail: input.paymentRail,
    paymentReference: input.paymentReference,
  };
}
