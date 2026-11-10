'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import { failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  executeWinnerTakeAllBidding,
  type WtaBiddingResult,
} from './winner-take-all-bidding';

export type ErrorResponse = { code: string; message: string };

/**
 * Server Action wrapper to execute Winner-Take-All bidding evaluation.
 * Triggered from UX when user wants to cull low performers and double down on winners.
 */
export async function evalCampaignRoiAction(params: {
  campaignDateRangeStart: number;
  campaignDateRangeEnd: number;
  tenantId?: string;
}): Promise<Result<WtaBiddingResult, ErrorResponse>> {
  try {
    const user = await getCurrentUser();
    const isAdmin = Boolean(user && (user.role === 'admin' || (await isUserAdmin(user))));
    if (!user || !isAdmin) {
      return failure({
        code: 'UNAUTHORIZED',
        message: 'Must be logged in to evaluate campaign ROI',
      });
    }

    const { campaignDateRangeStart, campaignDateRangeEnd } = params;
    if (campaignDateRangeStart >= campaignDateRangeEnd) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'Invalid date range',
      });
    }

    const resolvedTenantId = params.tenantId?.trim() || user.id;
    return await executeWinnerTakeAllBidding({
      tenantId: resolvedTenantId,
      userId: user.id,
      campaignDateRangeStart,
      campaignDateRangeEnd,
    });
  } catch (err: unknown) {
    logger.error(
      '[eval-campaign-roi] Failed to evaluate campaign ROI',
      err instanceof Error ? err : undefined,
    );
    return failure({
      code: 'ROI_EVAL_ERROR',
      message: 'Failed to evaluate campaign ROI',
    });
  }
}
