/**
 * Shared D1 lookup and RBAC authorization helpers for Enterprise E-Invoice server actions.
 * @module land/billing/invoices/invoice-action-helpers
 */

import { getD1 } from '@/seed/db/client';
import type { CreateInvoiceInput, EInvoice } from '@/seed/types/enterprise-billing';
import { getInvoiceById, validateVietnameseTaxId } from '@/tree/billing/invoice-generator';
import { assertBillingAccess, type BillingActionError } from './auth-check';

export type AuthorizedOrgDbLookup =
  | { ok: true; db: NonNullable<Awaited<ReturnType<typeof getD1>>> }
  | { ok: false; error: BillingActionError };

export type AuthorizedInvoiceLookup =
  | { ok: true; db: NonNullable<Awaited<ReturnType<typeof getD1>>>; invoice: EInvoice }
  | { ok: false; error: BillingActionError };

/**
 * Resolves the D1 database binding and verifies that the current user
 * has billing access to the given organization.
 */
export async function loadAuthorizedOrgDb(orgId: string): Promise<AuthorizedOrgDbLookup> {
  const db = await getD1();
  if (!db) {
    return { ok: false, error: { code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' } };
  }

  const authCheck = await assertBillingAccess(db, orgId);
  if (!authCheck.ok) {
    return { ok: false, error: authCheck.error };
  }

  return { ok: true, db };
}

/**
 * Resolves the D1 database binding, fetches an invoice by ID, and verifies
 * that the current user has billing access to the invoice's organization.
 */
export async function loadAuthorizedInvoice(id: string): Promise<AuthorizedInvoiceLookup> {
  const db = await getD1();
  if (!db) {
    return { ok: false, error: { code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' } };
  }

  const invoice = await getInvoiceById(db, id);
  if (!invoice) {
    return { ok: false, error: { code: 'NOT_FOUND', message: `Invoice "${id}" not found` } };
  }

  const authCheck = await assertBillingAccess(db, invoice.orgId);
  if (!authCheck.ok) {
    return { ok: false, error: authCheck.error };
  }

  return { ok: true, db, invoice };
}

export function validateInvoiceTaxIdIfNeeded(
  input: CreateInvoiceInput,
): BillingActionError | null {
  if (input.taxId && input.currency === 'VND') {
    const taxValidation = validateVietnameseTaxId(input.taxId);
    if (!taxValidation.valid) {
      return {
        code: 'INVALID_TAX_ID',
        message: taxValidation.error ?? 'Invalid Tax ID format',
      };
    }
  }
  return null;
}
