/**
 * Co-Op Marketing Budget Server Actions
 *
 * Layer: land
 *
 * @module land/partners/actions/budget-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  accrueMonthlyCoOpBudget,
  sweepExpiredCoOpBudgets,
  type SweepExpiredBudgetsResult,
} from '@/tree/partners/co-op-engine';
import type { CoOpBudgetAllocation } from '@/tree/partners/types';
import { verifyPartnerOwnership } from './ownership-verifier';
import type { AccrueBudgetActionInput, CoOpActionError } from './types';

/**
 * Accrues 5% monthly Co-Op budget for an eligible Gold/Platinum partner.
 */
export async function accrueMonthlyCoOpBudgetAction(
  input: AccrueBudgetActionInput,
): Promise<Result<CoOpBudgetAllocation, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to accrue Co-Op budget' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partnerId = input.partnerId?.trim();
    const cycleMonth = input.cycleMonth?.trim();

    if (!partnerId || !cycleMonth) {
      return failure({ code: 'INVALID_INPUT', message: 'partnerId and cycleMonth are required' });
    }

    // Enforce object ownership
    const authCheck = await verifyPartnerOwnership(db, partnerId, user.id, user.role);
    if (!authCheck.ok) {
      return failure(authCheck.error);
    }

    const result = await accrueMonthlyCoOpBudget(db, partnerId, cycleMonth, input.mrrCents, input.tier);

    if (!result.success || !result.allocation) {
      return failure({
        code: result.error ?? 'ACCRUAL_FAILED',
        message: `Failed to accrue Co-Op budget: ${result.error ?? 'unknown error'}`,
      });
    }

    return success(result.allocation);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('accrueMonthlyCoOpBudgetAction failed', { error: error.message, input });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}

/**
 * Sweeps expired unspent Co-Op budgets older than 90 days.
 * Restricted to Platform Administrators.
 */
export async function sweepExpiredCoOpBudgetsAction(
  currentTimestampMs?: number,
): Promise<Result<SweepExpiredBudgetsResult, CoOpActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to execute budget sweep' });
    }

    if (user.role !== 'admin') {
      return failure({ code: 'FORBIDDEN', message: 'Admin access required to sweep expired Co-Op budgets' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const result = await sweepExpiredCoOpBudgets(db, currentTimestampMs);
    return success(result);
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('sweepExpiredCoOpBudgetsAction failed', { error: error.message });
    return failure({ code: 'INTERNAL_ERROR', message: error.message });
  }
}
