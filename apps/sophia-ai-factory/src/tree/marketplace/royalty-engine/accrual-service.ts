/**
 * @file accrual-service.ts
 * @description 70/30 royalty accruals with OCC CAS on creator earnings ledger.
 * @layer tree
 */

import { logger } from '@/seed/utils/logger-utility';
import type { RoyaltyAccrualInput, RoyaltyAccrualResult } from '../types';
import { DEFAULT_ROYALTY_PCT, MAX_CAS_RETRIES } from './constants';
import { calculateRoyaltySplit, isSelfTemplateActivation } from './split-calculator';
import {
  probeExistingRoyaltyAccrual,
  insertRoyaltyLedgerEntry,
  isSqliteConstraintError,
} from './accrual-cas-helpers';

/**
 * Executes a 70/30 template activation royalty accrual with OCC CAS on creator_earnings_ledger.
 */
export async function accrueRoyalty(input: RoyaltyAccrualInput): Promise<RoyaltyAccrualResult> {
  const nowMs = input.nowMs ?? Date.now();

  if (isSelfTemplateActivation(input.creatorId, input.activatingUserId)) {
    throw new Error('SELF_TEMPLATE_ACTIVATION_PROHIBITED');
  }

  const split = calculateRoyaltySplit(input.priceCents, input.royaltyPct ?? DEFAULT_ROYALTY_PCT);
  const activationId = input.referenceId || `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

  const eventType = 'royalty_accrual';
  const sourceType = 'template_activation';

  try {
    const existing = await probeExistingRoyaltyAccrual(
      input.db,
      input.creatorId,
      activationId,
      eventType,
      split,
    );
    if (existing) return existing;
  } catch {
    // Proceed if table doesn't have existing record
  }

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const retryExisting = await probeExistingRoyaltyAccrual(
          input.db,
          input.creatorId,
          activationId,
          eventType,
          split,
        );
        if (retryExisting) return retryExisting;
      }

      return await insertRoyaltyLedgerEntry(
        input,
        activationId,
        eventType,
        sourceType,
        split,
        nowMs,
      );
    } catch (err: unknown) {
      const errStr = String(err);
      if (isSqliteConstraintError(errStr) && attempt < MAX_CAS_RETRIES - 1) {
        const maxWait = 10 * Math.pow(2, attempt);
        const delay = Math.floor(Math.random() * maxWait) + Math.floor(Math.random() * 15);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      logger.error('[royalty-engine] CAS accrual failed after retries', {
        creatorId: input.creatorId,
        attempt,
        error: errStr,
      });

      throw err;
    }
  }

  throw new Error('ROYALTY_ACCRUAL_CAS_EXHAUSTED');
}
