'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  calculateCrossBorderPayout,
  settleCrossBorderPayout,
} from '@/tree/partners/cross-border-ledger';
import type {
  TaxCalculationResult,
  CrossBorderPayoutCalculation,
  PartnerCrossBorderLedgerEntry,
} from '@/seed/types/cross-border-ledger';
import type {
  CrossBorderActionError,
  PreviewCrossBorderPayoutInput,
  SettleCrossBorderPayoutActionInput,
} from './types';

/**
 * Preview withholding tax deduction and hedged local currency payout without persisting to D1.
 * Available to authenticated users for transparent fee and tax estimation.
 */
export async function previewCrossBorderPayoutAction(
  input: PreviewCrossBorderPayoutInput,
): Promise<Result<{ tax: TaxCalculationResult; payout: CrossBorderPayoutCalculation }, CrossBorderActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to preview cross-border payout' });
    }

    if (typeof input.grossCents !== 'number' || input.grossCents < 0) {
      return failure({ code: 'INVALID_AMOUNT', message: 'Gross amount must be a positive integer in cents' });
    }

    const result = calculateCrossBorderPayout(input);
    return success(result);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to preview cross-border payout', { error: error.message });
    return failure({ code: 'PREVIEW_FAILED', message: error.message });
  }
}

/**
 * Settle a cross-border commission ledger entry upon disbursement confirmation.
 */
export async function settleCrossBorderPayoutAction(
  input: SettleCrossBorderPayoutActionInput,
): Promise<Result<PartnerCrossBorderLedgerEntry, CrossBorderActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    if (!input.ledgerId || !input.batchId) {
      return failure({ code: 'INVALID_INPUT', message: 'Ledger ID and Batch ID are required' });
    }

    const updated = await settleCrossBorderPayout(db, input.ledgerId, input.batchId);
    logger.info('Cross-border commission settled', {
      ledgerId: updated.id,
      batchId: input.batchId,
      status: updated.status,
    });

    return success(updated);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to settle cross-border payout', { error: error.message });
    return failure({ code: 'SETTLE_FAILED', message: error.message });
  }
}
