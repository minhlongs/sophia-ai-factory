/**
 * Cloudflare D1 Repository for Enterprise Invoices
 *
 * @module tree/billing/invoices/invoice-repo
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
import { type InvoiceRow, mapRowToEInvoice } from './types';

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

/**
 * Retrieve invoice by unique ID from D1.
 */
export async function getInvoiceById(db: D1Database, id: string): Promise<EInvoice | null> {
  const row = await db
    .prepare('SELECT * FROM invoices WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first<InvoiceRow>();

  if (!row) return null;
  return mapRowToEInvoice(row);
}

/**
 * Retrieve all invoices for an organization, ordered by newest first.
 */
export async function getInvoicesByOrg(
  db: D1Database,
  orgId: string,
  limit: number = 50,
): Promise<EInvoice[]> {
  const { results } = await db
    .prepare('SELECT * FROM invoices WHERE org_id = ?1 ORDER BY created_at DESC LIMIT ?2')
    .bind(orgId, Math.max(1, Math.min(limit, 200)))
    .all<InvoiceRow>();

  if (!results) return [];
  return results.map(mapRowToEInvoice);
}

/**
 * Update status of an invoice (e.g. issued, paid, void).
 */
export async function updateInvoiceStatus(
  db: D1Database,
  id: string,
  status: InvoiceStatus,
  paidAt?: number,
): Promise<EInvoice | null> {
  const now = Math.floor(Date.now() / 1000);
  const effectivePaidAt = status === 'paid' ? (paidAt ?? now) : null;

  await db
    .prepare(
      'UPDATE invoices SET status = ?1, paid_at = COALESCE(?2, paid_at), updated_at = ?3 WHERE id = ?4',
    )
    .bind(status, effectivePaidAt, now, id)
    .run();

  return getInvoiceById(db, id);
}

/**
 * Mark invoice as paid with optional payment rail reference.
 */
export async function markInvoicePaid(
  db: D1Database,
  id: string,
  paidAt?: number,
  _paymentRail?: string,
  _paymentReference?: string,
): Promise<EInvoice | null> {
  return updateInvoiceStatus(db, id, 'paid', paidAt);
}
