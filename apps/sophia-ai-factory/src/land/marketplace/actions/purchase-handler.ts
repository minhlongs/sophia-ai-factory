'use server';

/**
 * Marketplace Purchase, Activation & Royalty Withdrawal Handlers
 *
 * Layer: land
 *
 * @module land/marketplace/actions/purchase-handler
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorTemplateItem,
  RoyaltyAccrualResult,
  WithdrawalRequestResult,
  CreatorBalanceSummary,
  PayoutRail,
} from '@/tree/marketplace/types';
import { activateMarketplaceTemplate } from '@/tree/marketplace/marketplace-service';
import {
  processCreatorWithdrawal,
  getCreatorBalance,
} from '@/tree/marketplace/royalty-engine';
import { requireAuthUser, getRequiredD1, type ActionResult } from './types';

/**
 * Activates a template, allocating a 70/30 royalty split to the creator via OCC CAS ledger.
 */
export async function activateTemplate(input: {
  templateId: string;
  videoJobId?: string;
}): Promise<ActionResult<{ activationResult: RoyaltyAccrualResult; template: CreatorTemplateItem }>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const tenantId =
      ((user as unknown as { tenantId?: string; orgId?: string }).tenantId ??
        (user as unknown as { tenantId?: string; orgId?: string }).orgId ??
        'default_tenant');

    const result = await activateMarketplaceTemplate(db, {
      templateId: input.templateId,
      activatingUserId: user.id,
      tenantId,
      videoJobId: input.videoJobId,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] activateTemplate failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Requests a royalty withdrawal via VietQR or USDT rail.
 */
export async function requestWithdrawal(input: {
  amountCents: number;
  rail: PayoutRail;
  destinationAddress?: string;
  bankBin?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  txHash?: string;
}): Promise<ActionResult<WithdrawalRequestResult>> {
  try {
    const user = await requireAuthUser();
    const db = await getRequiredD1();

    const result = await processCreatorWithdrawal({
      db,
      creatorId: user.id,
      amountCents: input.amountCents,
      rail: input.rail,
      destinationAddress: input.destinationAddress,
      bankBin: input.bankBin,
      bankAccountNumber: input.bankAccountNumber,
      bankAccountName: input.bankAccountName,
      txHash: input.txHash,
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] requestWithdrawal failed', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Retrieves the current royalty balance summary for a creator.
 */
export async function getCreatorRoyaltyBalance(
  creatorId?: string,
): Promise<ActionResult<CreatorBalanceSummary>> {
  try {
    const user = await requireAuthUser();
    const targetCreatorId = creatorId || user.id;

    const db = await getRequiredD1();
    const balance = await getCreatorBalance(db, targetCreatorId);

    return {
      success: true,
      data: balance,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[marketplace-actions] getCreatorRoyaltyBalance failed', { error: message });
    return { success: false, error: message };
  }
}
