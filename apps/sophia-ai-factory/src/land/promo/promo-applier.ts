/**
 * Promo code apply logic.
 * Handles all discount types, fires auto-handover for free tiers.
 * @module lib/promo/promo-applier
 */

import { validatePromoCode } from './promo-validator';
import { incrementAndRecord, setUserTrialExpiry } from './promo-repo';
import { triggerAutoHandover } from '@/tree/handover/auto-handover';
import { logger } from '@/seed/utils/logger-utility';
import type { ApplyOptions, ApplyResult, RedemptionStatus } from './promo-types';
import { computePromoPricing, normalizeTier } from './promo-applier-helpers';

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
  const {
    originalAmountCents,
    discountedAmountCents,
    discountAppliedCents,
    trialDaysGranted,
  } = computePromoPricing({
    effectiveTier,
    paymentAmountCents,
    discountType,
    discountValue,
  });

  let handoverId: string | null = null;
  let magicLink: string | null = null;

  // For free tiers, fire auto-handover immediately.
  // Saga: handover MUST succeed before recording the redemption. If it fails,
  // throw so the caller can retry without polluting promo_codes.used_count.
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
      logger.error('[PromoApplier] Auto-handover failed for free tier', err instanceof Error ? err : new Error(String(err)), {
        code,
        userId,
      });
      throw new Error(`Promo redemption failed: handover could not be created. Please try again.`);
    }

    // Set trial expiry for free_trial (only after successful handover)
    if (discountType === 'free_trial' && trialDaysGranted > 0) {
      const trialEndsAt = Math.floor(Date.now() / 1000) + trialDaysGranted * 86400;
      await setUserTrialExpiry(userId, trialEndsAt);
    }
  }

  const redemptionStatus: RedemptionStatus =
    discountType === 'percent_off' || discountType === 'fixed_off' ? 'reserved' : 'redeemed';

  // Atomic: increment used_count + insert redemption row via D1 batch
  const redemption = await incrementAndRecord({
    codeId,
    promoCode: code,
    userId,
    email,
    appliedToTier: effectiveTier,
    appliedToSku: sku,
    discountAppliedCents,
    trialDaysGranted,
    handoverId: handoverId ?? undefined,
    status: redemptionStatus,
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
