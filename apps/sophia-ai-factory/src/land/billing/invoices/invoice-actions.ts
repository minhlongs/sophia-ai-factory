'use server';

/**
 * Server Actions for Enterprise Multi-Currency Billing & E-Invoicing
 * @module land/billing/invoices/invoice-actions
 */

import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  EInvoice,
  CreateInvoiceInput,
} from '@/seed/types/enterprise-billing';
import {
  createInvoiceRecord,
  getInvoicesByOrg,
  updateInvoiceStatus,
  markInvoicePaid,
  validateVietnameseTaxId,
} from '@/tree/billing/invoice-generator';
import type { BillingActionError } from './auth-check';
import { loadAuthorizedInvoice, loadAuthorizedOrgDb } from './invoice-action-helpers';

/**
 * Server Action: Create a new compliant enterprise invoice record in D1.
 */
export async function createInvoiceAction(
  input: CreateInvoiceInput,
): Promise<Result<EInvoice, BillingActionError>> {
  try {
    const orgDb = await loadAuthorizedOrgDb(input.orgId);
    if (!orgDb.ok) {
      return failure(orgDb.error);
    }

    // Validate Tax ID if Vietnamese domestic tax ID is supplied
    if (input.taxId && input.currency === 'VND') {
      const taxValidation = validateVietnameseTaxId(input.taxId);
      if (!taxValidation.valid) {
        return failure({ code: 'INVALID_TAX_ID', message: taxValidation.error ?? 'Invalid Tax ID format' });
      }
    }

    const invoice = await createInvoiceRecord(orgDb.db, input);
    return success(invoice);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] createInvoiceAction failed', toError(err));
    return failure({ code: 'CREATION_FAILED', message: err instanceof Error ? err.message : 'Failed to create invoice' });
  }
}

/**
 * Server Action: Retrieve all invoices belonging to an organization.
 */
export async function getInvoicesByOrgAction(
  orgId: string,
): Promise<Result<EInvoice[], BillingActionError>> {
  try {
    const orgDb = await loadAuthorizedOrgDb(orgId);
    if (!orgDb.ok) return failure(orgDb.error);

    const invoices = await getInvoicesByOrg(orgDb.db, orgId);
    return success(invoices);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] getInvoicesByOrgAction failed', toError(err));
    return failure({ code: 'QUERY_FAILED', message: err instanceof Error ? err.message : 'Failed to retrieve invoices' });
  }
}

/**
 * Server Action: Retrieve single invoice by ID with organization verification.
 */
export async function getInvoiceByIdAction(
  id: string,
): Promise<Result<EInvoice, BillingActionError>> {
  try {
    const loaded = await loadAuthorizedInvoice(id);
    if (!loaded.ok) return failure(loaded.error);

    return success(loaded.invoice);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] getInvoiceByIdAction failed', toError(err));
    return failure({ code: 'QUERY_FAILED', message: err instanceof Error ? err.message : 'Failed to retrieve invoice' });
  }
}

/**
 * Server Action: Issue a draft invoice to 'issued' status.
 */
export async function issueInvoiceAction(
  id: string,
): Promise<Result<EInvoice, BillingActionError>> {
  try {
    const loaded = await loadAuthorizedInvoice(id);
    if (!loaded.ok) return failure(loaded.error);

    const updated = await updateInvoiceStatus(loaded.db, id, 'issued');
    if (!updated) {
      return failure({ code: 'UPDATE_FAILED', message: 'Failed to update invoice status' });
    }

    return success(updated);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] issueInvoiceAction failed', toError(err));
    return failure({ code: 'ACTION_FAILED', message: err instanceof Error ? err.message : 'Failed to issue invoice' });
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
    const loaded = await loadAuthorizedInvoice(id);
    if (!loaded.ok) return failure(loaded.error);

    const updated = await markInvoicePaid(
      loaded.db,
      id,
      Math.floor(Date.now() / 1000),
      paymentRail,
      paymentReference,
    );
    if (!updated) {
      return failure({ code: 'UPDATE_FAILED', message: 'Failed to mark invoice as paid' });
    }

    return success(updated);
  } catch (err) {
    logger.error('[EnterpriseBillingActions] markInvoicePaidAction failed', toError(err));
    return failure({ code: 'ACTION_FAILED', message: err instanceof Error ? err.message : 'Failed to mark invoice paid' });
  }
}
