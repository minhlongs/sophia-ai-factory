/**
 * GET /api/admin/dunning/[licenseNonce]
 *
 * Get dunning state and history for a license
 * Admin-only endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getDunningState, getDunningHistory } from '@/lib/billing/dunning-workflow';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export async function GET(
  req: NextRequest,
  { params }: { params: { licenseNonce: string } }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {

    // Get dunning state
    const dunningState = await getDunningState(params.licenseNonce);

    // Get dunning history (last 20 attempts)
    const dunningHistory = await getDunningHistory(params.licenseNonce, 20);

    logger.info('[Admin Dunning API] Retrieved dunning state', {
      licenseNonce: params.licenseNonce.slice(0, 8) + '...',
      state: dunningState.state,
      allowed: dunningState.allowed,
    });

    return NextResponse.json({
      licenseNonce: params.licenseNonce.slice(0, 8) + '...',
      state: dunningState.state,
      allowed: dunningState.allowed,
      gracePeriodEndsAt: dunningState.gracePeriodEndsAt,
      nextRetryAt: dunningState.nextRetryAt,
      failedPaymentCount: dunningState.failedPaymentCount,
      blockReason: dunningState.blockReason,
      history: dunningHistory.map(h => ({
        attemptNumber: h.attempt_number,
        attemptType: h.attempt_type,
        paymentProvider: h.payment_provider,
        success: h.success,
        amount: h.amount,
        currency: h.currency,
        failureReason: h.failure_reason,
        dunningStateBefore: h.dunning_state_before,
        dunningStateAfter: h.dunning_state_after,
        nextRetryAt: h.next_retry_at,
        createdAt: h.created_at,
      })),
    });
  } catch (error) {
    logger.error('[Admin Dunning API] Error', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch dunning state' },
      { status: 500 }
    );
  }
}
