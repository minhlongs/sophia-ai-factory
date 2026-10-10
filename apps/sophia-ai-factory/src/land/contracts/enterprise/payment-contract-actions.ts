'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { PaymentRail } from '@/seed/types/enterprise-contracts';
import {
  getContractById,
  initiateContractPayment,
  fulfillContractPayment,
  type ContractPaymentInitiationResult,
  type FulfillPaymentResult,
} from '@/land/contracts/quote-to-cash-workflow';
import type { ContractActionError } from './types';
import { assertContractAccess } from './contract-access';

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
