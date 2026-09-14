/**
 * Customer Usage Plan & Overage Calculation.
 * Resolves subscription tier, allowance limits, overage economics, and billing events.
 *
 * @module land/billing/customer-usage-plan
 */

import { createServerClient } from '@/seed/db/client';
import { normalizePlanToTier } from '@/seed/db/get-user-tier';
import { getUnifiedTierLimits } from '@/seed/config/tiers/unified-limits';
import { TOPUP_PRICE_PER_MCU } from '@/seed/config/tiers/tier-configs';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { Tier } from '@/seed/types';
import type {
  CustomerUsagePlan,
  CustomerUsageLimit,
  NextBillingEvent,
  CustomerUsageRemaining,
  CustomerUsageOverage,
} from './customer-usage-types';

interface RawSubscriptionRow {
  tier: string | null;
  plan: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: number | null;
}

interface RawOrgSubRow {
  tier: string | null;
  plan: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

export async function resolveCustomerPlan(
  userId: string,
  fallbackEndIso: string,
): Promise<{
  plan: CustomerUsagePlan;
  limit: CustomerUsageLimit;
  nextBillingEvent: NextBillingEvent;
}> {
  let resolvedTier: Tier = 'BASIC';
  let subStatus = 'active';
  let periodEnd: string | null = null;

  try {
    const db = createServerClient();

    // 1. Check user-scoped active subscription first
    const userSub = await db
      .prepare(
        `SELECT tier, plan, status, current_period_start, current_period_end, trial_ends_at
         FROM subscriptions
         WHERE user_id = ?1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(userId)
      .first<RawSubscriptionRow>();

    if (userSub) {
      resolvedTier = normalizePlanToTier(userSub.tier ?? userSub.plan);
      subStatus = userSub.status ?? 'active';
      periodEnd = userSub.current_period_end;
    } else {
      // 2. Check org-level active subscription for org members
      const orgSub = await db
        .prepare(
          `SELECT s.tier, s.plan, s.status, s.current_period_start, s.current_period_end
           FROM org_members om
           JOIN subscriptions s ON s.org_id = om.org_id
           WHERE om.user_id = ?1 AND s.status = 'active'
           ORDER BY s.created_at DESC LIMIT 1`,
        )
        .bind(userId)
        .first<RawOrgSubRow>();

      if (orgSub) {
        resolvedTier = normalizePlanToTier(orgSub.tier ?? orgSub.plan);
        subStatus = orgSub.status ?? 'active';
        periodEnd = orgSub.current_period_end;
      }
    }
  } catch (err) {
    logger.warn('[CustomerUsagePlan] Fallback to BASIC tier due to DB error', {
      userId,
      error: toError(err).message,
    });
  }

  const limits = getUnifiedTierLimits(resolvedTier);
  const isLifetime = limits.billingType === 'lifetime' || resolvedTier === 'MASTER';

  const plan: CustomerUsagePlan = {
    tier: resolvedTier,
    name: limits.name,
    price: limits.price,
    billingType: limits.billingType,
    status: subStatus,
  };

  const limit: CustomerUsageLimit = {
    mcuMonthly: limits.mcuMonthly,
    videoTemplates: limits.templates,
    campaignsPerMonth: limits.campaignsPerMonth,
    youtubeChannels: limits.youtubeChannels,
    aiCommands: limits.aiCommands,
  };

  const nextBillingEvent: NextBillingEvent = {
    date: isLifetime ? null : (periodEnd ?? fallbackEndIso),
    description: isLifetime
      ? 'Master Lifetime License — No recurring billing / Gói Master Trọn đời'
      : `Monthly renewal (${limits.name} Plan) / Gia hạn hàng tháng`,
    amount: isLifetime ? 0 : limits.price,
    isLifetime,
  };

  return { plan, limit, nextBillingEvent };
}

export function calculateOverageAndRemaining(
  mcuUsed: number,
  mcuMonthlyLimit: number,
): {
  percentUsed: number;
  remaining: CustomerUsageRemaining;
  overage: CustomerUsageOverage;
} {
  const percentUsed =
    mcuMonthlyLimit > 0
      ? Math.min(Math.round((mcuUsed / mcuMonthlyLimit) * 1000) / 10, 100)
      : 0;

  const mcuRemaining = Math.max(0, mcuMonthlyLimit - mcuUsed);
  const overageCredits = Math.max(0, mcuUsed - mcuMonthlyLimit);
  const pricePerCredit = TOPUP_PRICE_PER_MCU;
  const estimatedOverageCost = Math.round(overageCredits * pricePerCredit * 100) / 100;
  const isAccruing = overageCredits > 0;

  return {
    percentUsed,
    remaining: { mcuRemaining },
    overage: {
      overageCredits,
      pricePerCredit,
      estimatedOverageCost,
      isAccruing,
    },
  };
}
