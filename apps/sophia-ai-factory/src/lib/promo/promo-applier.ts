/**
 * Promo code apply logic.
 * Handles all discount types, fires auto-handover for free tiers.
 * @module lib/promo/promo-applier
 */

import { validatePromoCode } from './promo-validator';
import { incrementUsedCount, recordRedemption, setUserTrialExpiry } from './promo-repo';
import { triggerAutoHandover } from '@/lib/handover/auto-handover';
import { logger } from '@/lib/utils/logger-utility';
import type { ApplyOptions, ApplyResult } from './promo-types';
import type { Tier } from '@/types';

/** Tier price map in cents (used for fixed_off / percent_off calculations). */
const TIER_PRICE_CENTS: Record<string, number> = {
  BASIC: 19900,
  PREMIUM: 39900,
  ENTERPRISE: 79900,
  MASTER: 499900,
};

const VALID_TIERS = new Set<string>(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']);

function normalizeTier(tier: string | undefined): Tier {
  const upper = (tier ?? 'BASIC').toUpperCase();
  return (VALID_TIERS.has(upper) ? upper : 'BASIC') as Tier;
}

/**
 * Apply a promo code for a user.
 * - free_full / free_trial: fires triggerAutoHandover immediately (no payment needed)
 * - percent_off / fixed_off: calculates discounted amount, records reserved redemption
 */
export async function applyPromoCode(opts: ApplyOptions): Promise<ApplyResult> {
  const { code, userId, email, tier, sku, paymentAmountCents, locale = 'vi', fullName, agencyType } = opts;

  const validation = await validatePromoCode(code, { userId, tier, sku });

  if (!validation.valid) {
    throw new Error(`Promo code invalid: ${validation.reason}`);
  }

  const { codeId, discountType, discountValue, appliesToTier } = validation;
  const effectiveTier = normalizeTier(appliesToTier ?? tier);

  const originalAmountCents = paymentAmountCents ?? TIER_PRICE_CENTS[effectiveTier] ?? 0;
  let discountedAmountCents = originalAmountCents;
  let trialDaysGranted = 0;

  if (discountType === 'percent_off') {
    const discount = Math.round(originalAmountCents * discountValue / 100);
    discountedAmountCents = Math.max(0, originalAmountCents - discount);
  } else if (discountType === 'fixed_off') {
    discountedAmountCents = Math.max(0, originalAmountCents - discountValue);
  } else if (discountType === 'free_trial') {
    trialDaysGranted = discountValue;
    discountedAmountCents = 0;
  } else if (discountType === 'free_full') {
    discountedAmountCents = 0;
  }

  const discountAppliedCents = originalAmountCents - discountedAmountCents;

  // Increment usage count
  await incrementUsedCount(codeId);

  let handoverId: string | null = null;
  let magicLink: string | null = null;

  // For free tiers, fire auto-handover immediately
  if (discountType === 'free_trial' || discountType === 'free_full') {
    const promoPaymentId = `promo_${code.toUpperCase()}_${userId}_${Date.now()}`;

    try {
      const result = await triggerAutoHandover({
        paymentId: promoPaymentId,
        userId,
        email: email ?? '',
        fullName: fullName ?? null,
        tier: effectiveTier,
        agencyType: (agencyType as Parameters<typeof triggerAutoHandover>[0]['agencyType']) ?? 'other',
        locale,
        isFirstPurchase: true,
      });

      handoverId = result.handoverId;
      magicLink = result.magicLink;
    } catch (err) {
      logger.warn('[PromoApplier] Auto-handover failed (non-fatal)', {
        code,
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Set trial expiry for free_trial
    if (discountType === 'free_trial' && trialDaysGranted > 0) {
      const trialEndsAt = Math.floor(Date.now() / 1000) + trialDaysGranted * 86400;
      await setUserTrialExpiry(userId, trialEndsAt);
    }
  }

  // Record redemption
  const redemption = await recordRedemption({
    promoCcodeId: codeId,
    promoCode: code,
    userId,
    email,
    appliedToTier: effectiveTier,
    appliedToSku: sku,
    discountAppliedCents,
    trialDaysGranted,
    handoverId: handoverId ?? undefined,
    status: (discountType === 'percent_off' || discountType === 'fixed_off') ? 'reserved' : 'redeemed',
  });

  logger.info('[PromoApplier] Code applied', {
    code,
    userId,
    discountType,
    discountedAmountCents,
    trialDaysGranted,
    redemptionId: redemption.id,
    handoverId,
  });

  return {
    discountedAmountCents,
    originalAmountCents,
    trialDaysGranted,
    redemptionId: redemption.id,
    handoverId,
    magicLink,
  };
}
