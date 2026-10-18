/**
 * Customer Usage Plan & Overage Calculation.
 * Resolves subscription tier, allowance limits, overage economics, and billing events.
 *
 * @module land/billing/customer-usage-plan
 */

import { getUnifiedTierLimits } from '@/seed/config/tiers/unified-limits';
import { TOPUP_PRICE_PER_MCU } from '@/seed/config/tiers/tier-configs';
import { queryActiveCustomerSubscription } from './customer-subscription-query';
import type {
  CustomerUsagePlan,
  CustomerUsageLimit,
  NextBillingEvent,
  CustomerUsageRemaining,
  CustomerUsageOverage,
} from './customer-usage-types';

export async function resolveCustomerPlan(
  userId: string,
  fallbackEndIso: string,
): Promise<{
  plan: CustomerUsagePlan;
  limit: CustomerUsageLimit;
  nextBillingEvent: NextBillingEvent;
}> {
  const { resolvedTier, subStatus, periodEnd } =
    await queryActiveCustomerSubscription(userId);

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
