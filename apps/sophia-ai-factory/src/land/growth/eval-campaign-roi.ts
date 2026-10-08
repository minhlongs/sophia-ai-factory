'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { executeWinnerTakeAllBidding } from './winner-take-all-bidding';
import { failure, type Result } from '@/seed/types/result';

export type ErrorResponse = { code: string; message: string; };

/**
 * Server Action wrapper to execute Winner-Take-All bidding evaluation.
 * Triggered from UX when user wants to cull low performers and double down on winners.
 */
export async function evalCampaignRoiAction(params: {
  campaignDateRangeStart: number;
  campaignDateRangeEnd: number;
}): Promise<Result<{ culledCount: number, duplicatedCount: number, batchId: string }, ErrorResponse>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return failure({
        code: 'UNAUTHORIZED',
        message: 'Must be logged in to evaluate campaign ROI',
      });
    }

    const { campaignDateRangeStart, campaignDateRangeEnd } = params;
    
    if (campaignDateRangeStart >= campaignDateRangeEnd) {
      return failure({
        code: 'VALIDATION_ERROR',
        message: 'Invalid date range'
      });
    }

    // Delegate to the core logic handler (use root tenant mapping if not multi-tenant context)
    return await executeWinnerTakeAllBidding({
      tenantId: 'default', // Fallback as User type doesn't have tenantId directly
      userId: user.id,
      campaignDateRangeStart,
      campaignDateRangeEnd
    });
    
  } catch (err: unknown) {
    return failure({
      code: 'ROI_EVAL_ERROR',
      message: err instanceof Error ? err.message : 'Unknown evaluation error',
    });
  }
}
