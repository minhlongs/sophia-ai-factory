/**
 * Server Actions for Enterprise Multi-Currency Billing & E-Invoicing
 *
 * Implements secure invoice creation, retrieval, status transition,
 * and payment marking with RBAC role authorization (canManageBilling),
 * platform admin bypass, and organization tier gating.
 *
 * Layer: land (Public business layer — Server Actions)
 * Dependencies: @/seed/*, @/tree/*
 *
 * @module land/billing/enterprise-invoice-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  hasEnterprisePermission,
  isEnterpriseRole,
  type EnterpriseRole,
} from '@/seed/types/enterprise-rbac';
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

export interface BillingActionError {
  code: string;
  message: string;
}

/**
 * Asserts that the current user has permission to manage or view billing for the org.
 * Enforces authentication, admin/role permission (canManageBilling), and tier gating.
 */
async function assertBillingAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; isAdmin: boolean }, BillingActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, isAdmin: true });
  }

  // 1. Verify organization membership & role
  const isSoloOrg = orgId === `org-${user.id}`;
  let hasBillingRole = isSoloOrg;

  if (!isSoloOrg) {
    const member = await db
      .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
      .bind(orgId, user.id)
      .first<{ role: string }>();

    if (!member) {
      return failure({
        code: 'FORBIDDEN',
        message: 'You do not belong to this organization.',
      });
    }

    const role = member.role;
    const isTraditionalAdmin = role === 'owner' || role === 'admin';
    const isEnterpriseBillingAdmin =
      role === 'enterprise_admin' ||
      (isEnterpriseRole(role) && hasEnterprisePermission(role as EnterpriseRole, 'canManageBilling'));

    hasBillingRole = isTraditionalAdmin || isEnterpriseBillingAdmin;
  }

  if (!hasBillingRole) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Your role lacks permission to manage enterprise billing and invoices.',
    });
  }

  // 2. Tier gating check (Enterprise/Master or active paid subscription)
  const userTier = await getUserTier(user.id);
  const subRow = await db
    .prepare('SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1')
    .bind(orgId)
    .first<{ plan: string; status: string }>();

  const eligiblePlans = ['enterprise', 'master', 'agency', 'pro', 'premium', 'growth', 'starter', 'basic'];
  const orgPlan = (subRow?.plan || '').toLowerCase();
  const orgStatus = subRow?.status || '';

  const isTierEligible =
    userTier === 'ENTERPRISE' ||
    userTier === 'MASTER' ||
    (orgStatus === 'active' && eligiblePlans.includes(orgPlan));

  if (!isTierEligible && !isSoloOrg) {
    return failure({
      code: 'TIER_REQUIRED',
      message: 'Enterprise E-Invoicing requires an active paid tier or Enterprise/Master subscription.',
    });
  }

  return success({ userId: user.id, isAdmin: false });
}

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
