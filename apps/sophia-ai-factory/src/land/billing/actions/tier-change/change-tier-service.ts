import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { normalizePlanToTier } from '@/seed/db/get-user-tier';
import { isUserInDunning } from '@/land/billing/dunning/check-user-dunning';
import type {
  ChangeTierResult,
  BillingError,
  SubscriptionRow,
  ChangeTierOptions,
} from './types';
import {
  validateTargetTier,
  isDowngrade,
  isMasterTier,
} from './tier-transition-validator';
import {
  calculateProRataCredit,
  getTierPriceInCents,
} from './proration-calculator';

export async function executeChangeTier(
  targetTierRaw: string,
  options?: ChangeTierOptions,
): Promise<Result<ChangeTierResult, BillingError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    const targetTier = validateTargetTier(targetTierRaw);
    if (!targetTier) {
      return failure({ code: 'INVALID_TIER', message: `Invalid tier: ${targetTierRaw}` });
    }

    if (isMasterTier(targetTier)) {
      return failure({
        code: 'MASTER_REQUIRES_SEPARATE_FLOW',
        message: 'Master tier requires separate payment flow. Please contact support.',
      });
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const orgId = await resolveOrgId(user.id, d1);
    if (!orgId) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No organization found' });
    }

    const sub = await d1
      .prepare(
        "SELECT id, org_id, plan, status, current_period_start, current_period_end FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1",
      )
      .bind(orgId)
      .first<SubscriptionRow>();

    if (!sub) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active subscription found' });
    }

    const currentTier = normalizePlanToTier(sub.plan);

    if (currentTier === targetTier) {
      return failure({
        code: 'ALREADY_ON_TIER',
        message: `You are already on the ${targetTier} tier`,
      });
    }

    const inDunning = await isUserInDunning(user.id, {
      bypassDunningCache: options?.bypassDunningCache,
      orgId,
      db: d1,
    });
    if (inDunning) {
      return failure({
        code: 'IN_DUNNING',
        message: 'Cannot change tier while account is in dunning state. Please resolve outstanding payments first.',
      });
    }

    if (!isDowngrade(currentTier, targetTier)) {
      return failure({
        code: 'UPGRADE_REQUIRES_PAYMENT',
        message: 'Upgrades require payment. Please complete checkout to activate the new tier.',
      });
    }

    const currentPrice = await getTierPriceInCents(currentTier);
    const proratedAmount = calculateProRataCredit(
      currentPrice,
      sub.current_period_start,
      sub.current_period_end,
    );
    const effectiveDate = sub.current_period_end;
    const now = new Date().toISOString();

    const settingsRow = await d1
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?')
      .bind(user.id)
      .first<{ settings: string | null }>();

    let settings: Record<string, unknown> = {};
    try {
      if (settingsRow?.settings) settings = JSON.parse(settingsRow.settings) as Record<string, unknown>;
    } catch {
      // ignore parse errors
    }

    settings.tier_change_request = {
      target_tier: targetTier,
      timing: 'end_of_cycle',
      requested_at: Math.floor(Date.now() / 1000),
      from_tier: currentTier,
    };

    if (proratedAmount > 0) {
      const existingCredit = (settings.account_credit_cents as number) ?? 0;
      settings.account_credit_cents = existingCredit + proratedAmount;
      settings.last_credit_reason = `pro_rata_downgrade_${currentTier}_to_${targetTier}`;
      settings.last_credit_at = Math.floor(Date.now() / 1000);
    }

    await d1.batch([
      d1.prepare('UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE org_id = ?')
        .bind(now, orgId),
      d1.prepare(
        `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(user.id, orgId, currentTier, targetTier, 'pending_downgrade'),
      d1.prepare('UPDATE user_profiles SET settings = ?, updated_at = ? WHERE user_id = ?')
        .bind(JSON.stringify(settings), now, user.id),
    ]);

    logger.info('[ChangeTier] Downgrade scheduled', {
      userId: user.id,
      orgId,
      from: currentTier,
      to: targetTier,
      proratedAmount,
      effectiveDate,
    });

    return success({
      newTier: targetTier,
      proratedAmount,
      effectiveDate,
    });
  } catch (err) {
    logger.error('[ChangeTier] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
