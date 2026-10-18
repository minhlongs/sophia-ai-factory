/**
 * Outcome-Based Pricing Engine
 *
 * Domain logic for calculating and recording RaaS billing events.
 * Fee = gross_revenue * (percentage / 100), default 15%.
 *
 * All timestamps are Unix epoch seconds (Math.floor(Date.now() / 1000)).
 * All money values are in cents (integer) to avoid floating-point errors.
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  BillingEvent,
  BillingStatus,
  CreatorBillingSummary,
  OutcomePricingTier,
} from '@/seed/types/outcome-pricing';
import {
  calculateFee,
  getActivePricingTiers,
  DEFAULT_FEE_PERCENTAGE,
} from './outcome-pricing-calc';
import { getCreatorBillingSummary } from './outcome-billing-summary';

export { calculateFee, getActivePricingTiers, DEFAULT_FEE_PERCENTAGE, getCreatorBillingSummary };
export type { BillingEvent, BillingStatus, CreatorBillingSummary, OutcomePricingTier };

export async function createBillingEvent(params: {
  userId: string;
  executionId: string;
  outcomeId?: string;
  grossRevenueCents: number;
  pricingTierId?: string;
  percentage?: number;
}): Promise<string> {
  const { userId, executionId, outcomeId, grossRevenueCents, pricingTierId, percentage } = params;
  const { feeCents, feePercentage } = calculateFee(grossRevenueCents, percentage);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `INSERT INTO outcome_billing_events
          (id, user_id, execution_id, outcome_id, gross_revenue_cents,
           fee_cents, fee_percentage, pricing_tier_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .bind(
        id,
        userId,
        executionId,
        outcomeId ?? null,
        grossRevenueCents,
        feeCents,
        feePercentage,
        pricingTierId ?? null,
        now,
      )
      .run();

    logger.info('billing_event_created', { id, userId, feeCents, feePercentage });
    return id;
  } catch (err) {
    logger.warn('billing_event_create_failed', { userId, executionId, error: getErrorMessage(err) });
    throw new Error(`Failed to create billing event: ${getErrorMessage(err)}`);
  }
}

export async function settleBillingEvent(eventId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `UPDATE outcome_billing_events
         SET status = 'settled', settled_at = ?
         WHERE id = ? AND status != 'settled'`,
      )
      .bind(now, eventId)
      .run();
    logger.info('billing_event_settled', { eventId });
  } catch (err) {
    logger.warn('billing_event_settle_failed', { eventId, error: getErrorMessage(err) });
    throw new Error(`Failed to settle billing event: ${getErrorMessage(err)}`);
  }
}
