import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { handleEndOfCycleChange } from './end-of-cycle-handler';
import { handleImmediateProvision } from './immediate-provisioner';
import {
  TIER_RANK,
  type ProvisionResult,
  type ProvisionTierChangeParams,
  type SubscriptionRow,
} from './types';

/**
 * Provision a tier change atomically in D1.
 */
export async function provisionTierChange(
  params: ProvisionTierChangeParams
): Promise<ProvisionResult> {
  const { userId, orgId, currentTier, targetTier, timing } = params;
  const isDowngrade = TIER_RANK[targetTier] < TIER_RANK[currentTier];
  const eventType = isDowngrade ? 'downgrade' : 'upgrade';

  if (!isDowngrade) {
    logger.warn(
      '[TierProvisioner] Direct upgrade blocked: requires verified payment fulfillment',
      {
        userId,
        orgId,
        currentTier,
        targetTier,
      }
    );
    return { success: false, error: 'upgrade_requires_payment' };
  }

  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const sub = await db
    .prepare(
      'SELECT id, org_id, plan, status, current_period_start, current_period_end FROM subscriptions WHERE org_id = ?1 LIMIT 1'
    )
    .bind(orgId)
    .first<SubscriptionRow>();

  if (!sub) {
    return { success: false, error: 'no_active_subscription' };
  }

  if (sub.status !== 'active') {
    return { success: false, error: 'subscription_not_active' };
  }

  const now = new Date().toISOString();

  if (timing === 'end_of_cycle') {
    return handleEndOfCycleChange(db, sub, params, eventType, now);
  }

  return handleImmediateProvision(db, sub, params, eventType, now);
}
