/**
 * Server Actions for Custom Enterprise SLA Contracts & Quote-to-Cash
 *
 * Implements authenticated Server Actions with RBAC permission enforcement
 * (`canManageBilling` / `isUserAdminWithRole`), Cloudflare D1 persistence,
 * and dual-rail payment gateway coordination (NOWPayments USDT & PayOS VietQR).
 *
 * Layer: land (Public business layer — Server Actions)
 * Dependencies: @/seed/*, @/tree/*, @/land/contracts/*
 *
 * @module land/contracts/enterprise-contract-actions
 */

'use server';

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  hasEnterprisePermission,
  isEnterpriseRole,
  type EnterpriseRole,
} from '@/seed/types/enterprise-rbac';
import type {
  EnterpriseQuote,
  EnterpriseContract,
  CustomerSignerInput,
  PaymentRail,
} from '@/seed/types/enterprise-contracts';
import {
  createEnterpriseQuote,
  getQuoteById,
  convertQuoteToContract,
  getContractById,
  executeContractSigning,
  initiateContractPayment,
  fulfillContractPayment,
  type CreateQuoteInput,
  type ContractPaymentInitiationResult,
  type FulfillPaymentResult,
} from '@/land/contracts/quote-to-cash-workflow';
import {
  generateContractLegalTerms,
  generateContractHtml,
} from '@/tree/contracts/contract-generator';

export interface ContractActionError {
  code: string;
  message: string;
}

/**
 * Asserts that the active user is authenticated and authorized to manage billing/contracts
 * for the specified organization.
 */
async function assertContractAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; isAdmin: boolean }, ContractActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, isAdmin: true });
  }

  // Check solo organization
  const isSoloOrg = orgId === `org-${user.id}`;
  if (isSoloOrg) {
    return success({ userId: user.id, isAdmin: false });
  }

  // Check organization member role
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member) {
    return failure({
      code: 'FORBIDDEN',
      message: 'You are not a member of this enterprise organization.',
    });
  }

  const role = member.role;
  const isTraditionalAdmin = role === 'owner' || role === 'admin';
  const isEnterpriseBillingAdmin =
    role === 'enterprise_admin' ||
    (isEnterpriseRole(role) && hasEnterprisePermission(role as EnterpriseRole, 'canManageBilling'));

  if (!isTraditionalAdmin && !isEnterpriseBillingAdmin) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Your role lacks permission to manage enterprise contracts or billing.',
    });
  }

  return success({ userId: user.id, isAdmin: false });
}

// ── Server Actions ────────────────────────────────────────────────────────────

/**
 * Server Action: Generate a new custom Enterprise Volume Quote.
 */
export async function generateEnterpriseQuoteAction(
  input: CreateQuoteInput,
): Promise<Result<EnterpriseQuote, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const authRes = await assertContractAccess(db, input.orgId);
    if (!authRes.ok) return authRes;

    const quote = await createEnterpriseQuote(db, input);
    return success(quote);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] generateQuote error', error);
    return failure({ code: 'CREATE_QUOTE_FAILED', message: error.message });
  }
}

/**
 * Server Action: Retrieve an Enterprise Quote by ID.
 */
export async function getEnterpriseQuoteAction(
  quoteId: string,
): Promise<Result<EnterpriseQuote, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const quote = await getQuoteById(db, quoteId);
    if (!quote) {
      return failure({ code: 'NOT_FOUND', message: 'Enterprise quote not found' });
    }

    const authRes = await assertContractAccess(db, quote.orgId);
    if (!authRes.ok) return authRes;

    return success(quote);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] getQuote error', error);
    return failure({ code: 'GET_QUOTE_FAILED', message: error.message });
  }
}

/**
 * Server Action: Accept an Enterprise Quote and convert it to an SLA Contract.
 */
export async function convertQuoteToContractAction(
  quoteId: string,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const quote = await getQuoteById(db, quoteId);
    if (!quote) {
      return failure({ code: 'NOT_FOUND', message: 'Enterprise quote not found' });
    }

    const authRes = await assertContractAccess(db, quote.orgId);
    if (!authRes.ok) return authRes;

    const contract = await convertQuoteToContract(db, quoteId);
    return success(contract);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] convertQuote error', error);
    return failure({ code: 'CONVERT_CONTRACT_FAILED', message: error.message });
  }
}

/**
 * Server Action: Retrieve an Enterprise Contract by ID.
 */
export async function getEnterpriseContractAction(
  contractId: string,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const contract = await getContractById(db, contractId);
    if (!contract) {
      return failure({ code: 'NOT_FOUND', message: 'Enterprise contract not found' });
    }

    const authRes = await assertContractAccess(db, contract.orgId);
    if (!authRes.ok) return authRes;

    return success(contract);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] getContract error', error);
    return failure({ code: 'GET_CONTRACT_FAILED', message: error.message });
  }
}

/**
 * Server Action: Digitally sign an Enterprise Contract.
 */
export async function signEnterpriseContractAction(
  contractId: string,
  signer: CustomerSignerInput,
): Promise<Result<EnterpriseContract, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const contract = await getContractById(db, contractId);
    if (!contract) {
      return failure({ code: 'NOT_FOUND', message: 'Enterprise contract not found' });
    }

    const authRes = await assertContractAccess(db, contract.orgId);
    if (!authRes.ok) return authRes;

    const signedContract = await executeContractSigning(db, contractId, signer);
    return success(signedContract);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] signContract error', error);
    return failure({ code: 'SIGN_CONTRACT_FAILED', message: error.message });
  }
}

/**
 * Server Action: Initiate dual-rail payment checkout for a signed Enterprise Contract.
 */
export async function initiateEnterprisePaymentAction(
  contractId: string,
  paymentRail: 'NOWPAYMENTS' | 'PAYOS',
): Promise<Result<ContractPaymentInitiationResult, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const contract = await getContractById(db, contractId);
    if (!contract) {
      return failure({ code: 'NOT_FOUND', message: 'Enterprise contract not found' });
    }

    const authRes = await assertContractAccess(db, contract.orgId);
    if (!authRes.ok) return authRes;

    const user = await getCurrentUser();
    const result = await initiateContractPayment(db, {
      contractId,
      paymentRail,
      userId: user?.id ?? authRes.value.userId,
      customerEmail: user?.email ?? contract.customerSignerEmail ?? undefined,
      customerName: user?.full_name ?? contract.customerSignerName ?? undefined,
    });

    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] initiatePayment error', error);
    return failure({ code: 'INITIATE_PAYMENT_FAILED', message: error.message });
  }
}

/**
 * Server Action: Fulfill enterprise contract payment and activate capacity.
 * Restricted to platform admins or authorized automated billing webhooks.
 */
export async function fulfillEnterprisePaymentAction(
  contractId: string,
  paymentRail: PaymentRail,
  paymentReference: string,
): Promise<Result<FulfillPaymentResult, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { isAdmin } = await isUserAdminWithRole(user);
    if (!isAdmin && user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Only platform administrators can fulfill contracts.' });
    }

    const result = await fulfillContractPayment(db, {
      contractId,
      paymentRail,
      paymentReference,
      paidByUserId: user.id,
    });

    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] fulfillPayment error', error);
    return failure({ code: 'FULFILL_PAYMENT_FAILED', message: error.message });
  }
}

/**
 * Server Action: Retrieve formatted legal terms (Markdown and HTML) for an enterprise contract.
 */
export async function getContractTermsDocumentAction(
  contractId: string,
  locale: 'vi' | 'en' = 'vi',
): Promise<Result<{ termsMarkdown: string; termsHtml: string }, ContractActionError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DATABASE_ERROR', message: 'D1 database binding unavailable' });
    }

    const contract = await getContractById(db, contractId);
    if (!contract) {
      return failure({ code: 'NOT_FOUND', message: 'Enterprise contract not found' });
    }

    const authRes = await assertContractAccess(db, contract.orgId);
    if (!authRes.ok) return authRes;

    const termsMarkdown = generateContractLegalTerms(contract, locale);
    const termsHtml = generateContractHtml(contract, locale);

    return success({ termsMarkdown, termsHtml });
  } catch (err) {
    const error = toError(err);
    logger.error('[EnterpriseContractActions] getTermsDocument error', error);
    return failure({ code: 'GET_TERMS_FAILED', message: error.message });
  }
}
