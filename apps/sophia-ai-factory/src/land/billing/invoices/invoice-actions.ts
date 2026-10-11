'use server';

/**
 * Server Actions for Enterprise Multi-Currency Billing & E-Invoicing
 * @module land/billing/invoices/invoice-actions
 */

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  EInvoice,
  CreateInvoiceInput,
} from '@/seed/types/enterprise-billing';
import {
  createInvoiceRecord,
  getInvoiceById,
  getInvoicesByOrg,
  updateInvoiceStatus,
  markInvoicePaid,
  validateVietnameseTaxId,
} from '@/tree/billing/invoice-generator';
import { assertBillingAccess, type BillingActionError } from './auth-check';

/**
 * Server Action: Create a new compliant enterprise invoice record in D1.
 */
export async function createInvoiceAction(
  input: CreateInvoiceInput,
): Promise<Result<EInvoice, BillingActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const authCheck = await assertBillingAccess(db, input.orgId);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    // Validate Tax ID if Vietnamese domestic tax ID is supplied
    if (input.taxId && input.currency === 'VND') {
      const taxValidation = validateVietnameseTaxId(input.taxId);
      if (!taxValidation.valid) {
        return failure({
          code: 'INVALID_TAX_ID',
          message: taxValidation.error ?? 'Invalid Tax ID format',
        });
      }
    }

    const invoice = await createInvoiceRecord(db, input);
    return success(invoice);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] createInvoiceAction failed', toError(err));
    return failure({
      code: 'CREATION_FAILED',
      message: err instanceof Error ? err.message : 'Failed to create invoice',
    });
  }
}

/**
 * Server Action: Retrieve all invoices belonging to an organization.
 */
export async function getInvoicesByOrgAction(
  orgId: string,
): Promise<Result<EInvoice[], BillingActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const authCheck = await assertBillingAccess(db, orgId);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const invoices = await getInvoicesByOrg(db, orgId);
    return success(invoices);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] getInvoicesByOrgAction failed', toError(err));
    return failure({
      code: 'QUERY_FAILED',
      message: err instanceof Error ? err.message : 'Failed to retrieve invoices',
    });
  }
}

/**
 * Server Action: Retrieve single invoice by ID with organization verification.
 */
export async function getInvoiceByIdAction(
  id: string,
): Promise<Result<EInvoice, BillingActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const invoice = await getInvoiceById(db, id);
    if (!invoice) {
      return failure({ code: 'NOT_FOUND', message: `Invoice "${id}" not found` });
    }

    const authCheck = await assertBillingAccess(db, invoice.orgId);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    return success(invoice);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] getInvoiceByIdAction failed', toError(err));
    return failure({
      code: 'QUERY_FAILED',
      message: err instanceof Error ? err.message : 'Failed to retrieve invoice',
    });
  }
}

/**
 * Server Action: Issue a draft invoice to 'issued' status.
 */
export async function issueInvoiceAction(
  id: string,
): Promise<Result<EInvoice, BillingActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const existing = await getInvoiceById(db, id);
    if (!existing) {
      return failure({ code: 'NOT_FOUND', message: `Invoice "${id}" not found` });
    }

    const authCheck = await assertBillingAccess(db, existing.orgId);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const updated = await updateInvoiceStatus(db, id, 'issued');
    if (!updated) {
      return failure({ code: 'UPDATE_FAILED', message: 'Failed to update invoice status' });
    }

    return success(updated);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] issueInvoiceAction failed', toError(err));
    return failure({
      code: 'ACTION_FAILED',
      message: err instanceof Error ? err.message : 'Failed to issue invoice',
    });
  }
}

/**
 * Server Action: Mark an invoice as paid.
 */
export async function markInvoicePaidAction(
  id: string,
  paymentRail?: string,
  paymentReference?: string,
): Promise<Result<EInvoice, BillingActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database connection unavailable' });
    }

    const existing = await getInvoiceById(db, id);
    if (!existing) {
      return failure({ code: 'NOT_FOUND', message: `Invoice "${id}" not found` });
    }

    const authCheck = await assertBillingAccess(db, existing.orgId);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const updated = await markInvoicePaid(db, id, Math.floor(Date.now() / 1000), paymentRail, paymentReference);
    if (!updated) {
      return failure({ code: 'UPDATE_FAILED', message: 'Failed to mark invoice as paid' });
    }

    return success(updated);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] markInvoicePaidAction failed', toError(err));
    return failure({
      code: 'ACTION_FAILED',
      message: err instanceof Error ? err.message : 'Failed to mark invoice paid',
    });
  }
}
