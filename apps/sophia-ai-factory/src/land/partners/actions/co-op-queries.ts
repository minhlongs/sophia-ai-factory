/**
 * Partner Co-Op Queries (Server Actions)
 *
 * Layer: land
 *
 * @module land/partners/actions/co-op-queries
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getPartnerCoOpSummary,
  getPartnerCoOpAllocations,
  getPartnerCoOpClaims,
  type PartnerCoOpSummary,
} from '@/tree/partners/co-op-engine';
import type {
  CoOpBudgetAllocation,
  PartnerCoOpClaim,
  CoOpClaimStatus,
} from '@/tree/partners/types';
import { verifyPartnerOwnership } from './ownership-verifier';
import type { CoOpActionError } from './types';

/**
 * Retrieves Co-Op summary statistics for a partner.
 */
export async function getPartnerCoOpSummaryAction(
  partnerId: string,
): Promise<Result<PartnerCoOpSummary, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view Co-Op summary' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedPartnerId = partnerId?.trim();
    if (!trimmedPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId is required' });
    }

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const summary = await getPartnerCoOpSummary(db, trimmedPartnerId);
    if (!summary) {
      return failure({ code: 'PARTNER_NOT_FOUND', message: 'Partner not found' });
    }

    return success(summary);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerCoOpSummaryAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Retrieves budget allocations for a partner.
 */
export async function getPartnerCoOpAllocationsAction(
  partnerId: string,
): Promise<Result<CoOpBudgetAllocation[], CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view Co-Op allocations' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedPartnerId = partnerId?.trim();
    if (!trimmedPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId is required' });
    }

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const allocations = await getPartnerCoOpAllocations(db, trimmedPartnerId);
    return success(allocations);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerCoOpAllocationsAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Retrieves Co-Op claims for a partner.
 */
export async function getPartnerCoOpClaimsAction(
  partnerId: string,
  status?: CoOpClaimStatus,
): Promise<Result<PartnerCoOpClaim[], CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view Co-Op claims' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedPartnerId = partnerId?.trim();
    if (!trimmedPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId is required' });
    }

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, trimmedPartnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const claims = await getPartnerCoOpClaims(db, trimmedPartnerId, status);
    return success(claims);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerCoOpClaimsAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}
