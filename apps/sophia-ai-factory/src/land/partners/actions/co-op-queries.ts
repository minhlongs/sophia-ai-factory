/**
 * Partner Co-Op Queries (Server Actions)
 *
 * Layer: land
 *
 * @module land/partners/actions/co-op-queries
 */

'use server';

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
import { authorizeCoOpQueryContext } from './co-op-query-guard';
import type { CoOpActionError } from './types';

/**
 * Retrieves Co-Op summary statistics for a partner.
 */
export async function getPartnerCoOpSummaryAction(
  partnerId: string,
): Promise<Result<PartnerCoOpSummary, CoOpActionError>> {
  try {
    const ctx = await authorizeCoOpQueryContext(
      partnerId,
      'Authentication required to view Co-Op summary',
    );
    if (!ctx.ok) return ctx.result;

    const summary = await getPartnerCoOpSummary(ctx.db, ctx.trimmedPartnerId);
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
    const ctx = await authorizeCoOpQueryContext(
      partnerId,
      'Authentication required to view Co-Op allocations',
    );
    if (!ctx.ok) return ctx.result;

    const allocations = await getPartnerCoOpAllocations(ctx.db, ctx.trimmedPartnerId);
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
    const ctx = await authorizeCoOpQueryContext(
      partnerId,
      'Authentication required to view Co-Op claims',
    );
    if (!ctx.ok) return ctx.result;

    const claims = await getPartnerCoOpClaims(ctx.db, ctx.trimmedPartnerId, status);
    return success(claims);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('getPartnerCoOpClaimsAction failed', { error: error.message, partnerId });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}
