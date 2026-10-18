import { logger } from '@/seed/utils/logger-utility';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { recordRedemption } from '@/land/promo/promo-repo';
import { calculateDiscount, type DiscountCalcResult } from '@/land/promo/promo-discount-calculator';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import { executeFreeOrderHandover } from './promo-free-order-handover';

export { executeFreeOrderHandover };

export interface PromoReservationResult {
  promoDiscountCents: number;
  promoTrialDays: number;
  calc: DiscountCalcResult;
  validation?: Awaited<ReturnType<typeof validatePromoCode>> | null;
}

export async function processPromoReservation(params: {
  promoCode?: string;
  userId: string;
  tier: Tier;
}): Promise<PromoReservationResult> {
  const { promoCode, userId, tier } = params;
  let promoDiscountCents = 0;
  let promoTrialDays = 0;
  let validation: Awaited<ReturnType<typeof validatePromoCode>> | null = null;
  let calc: DiscountCalcResult = { isFreeOrder: false, discountCents: 0, trialDays: 0, finalAmountCents: 0 };

  if (promoCode) {
    try {
      validation = await validatePromoCode(promoCode, { userId, tier });
      if (validation.valid) {
        const tierConfig = UNIFIED_TIERS[tier];
        const baseCents = tierConfig ? tierConfig.price * 100 : 0;
        calc = calculateDiscount({
          discountType: validation.discountType,
          discountValue: validation.discountValue,
          originalAmountCents: baseCents,
        });
        promoDiscountCents = calc.discountCents;
        promoTrialDays = calc.trialDays;

        await recordRedemption({
          promoCodeId: validation.codeId,
          promoCode,
          userId,
          appliedToTier: tier,
          discountAppliedCents: promoDiscountCents,
          trialDaysGranted: promoTrialDays,
          status: 'reserved',
        });

        logger.info('[Checkout] Promo reserved', {
          promoCode,
          userId,
          tier,
          discountCents: promoDiscountCents,
          trialDays: promoTrialDays,
          discountType: validation.discountType,
        });
      } else {
        logger.warn('[Checkout] Invalid promo code ignored', {
          promoCode,
          reason: validation.reason,
        });
      }
    } catch (promoErr) {
      logger.warn('[Checkout] Promo reservation failed (non-fatal)', {
        promoCode,
        error: promoErr instanceof Error ? promoErr.message : String(promoErr),
      });
    }
  }

  return { promoDiscountCents, promoTrialDays, calc, validation };
}
