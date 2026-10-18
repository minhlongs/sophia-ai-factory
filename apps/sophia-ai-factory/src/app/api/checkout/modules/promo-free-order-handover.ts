import { logger } from '@/seed/utils/logger-utility';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { recordRedemption } from '@/land/promo/promo-repo';
import { writeOrder } from '@/land/orders/pending-order-repo';
import { triggerAutoHandover } from '@/tree/handover/auto-handover';
import type { Tier } from '@/seed/types';
import type { PendingOrderPeriod } from '@/land/orders/pending-order-types';

export async function executeFreeOrderHandover(params: {
  userId: string;
  tier: Tier;
  period: PendingOrderPeriod;
  promoCode: string;
  customerEmail?: string;
  validation: NonNullable<Awaited<ReturnType<typeof validatePromoCode>>> & { valid: true };
  promoDiscountCents: number;
  promoTrialDays: number;
}): Promise<{ freeOrderId: string; handoverId: string | null; magicLink: string | null }> {
  const {
    userId,
    tier,
    period,
    promoCode,
    customerEmail,
    validation,
    promoDiscountCents,
    promoTrialDays,
  } = params;
  const freeOrderId = `sophia_${userId}_${Date.now()}`;

  await writeOrder({
    order_id: freeOrderId,
    user_id: userId,
    tier,
    period: period || 'monthly',
    payment_method: 'nowpayments',
    amount_usd_cents: 0,
    promo_code: promoCode,
    customer_email: customerEmail,
    invoice_url: undefined,
    status: 'completed',
  });

  const result = await triggerAutoHandover({
    paymentId: `promo_${promoCode}_${userId}_${Date.now()}`,
    userId,
    email: customerEmail ?? '',
    fullName: null,
    tier,
    agencyType: 'other',
    locale: 'vi',
    isFirstPurchase: true,
  });

  try {
    await recordRedemption({
      promoCodeId: validation.codeId,
      promoCode,
      userId,
      appliedToTier: tier,
      discountAppliedCents: promoDiscountCents,
      trialDaysGranted: promoTrialDays,
      status: 'redeemed',
      handoverId: result.handoverId ?? undefined,
    });
  } catch (redemptErr) {
    logger.warn('[Checkout/FREE] Redemption record failed (non-fatal)', {
      error: redemptErr instanceof Error ? redemptErr.message : String(redemptErr),
    });
  }

  return {
    freeOrderId,
    handoverId: result.handoverId ?? null,
    magicLink: result.magicLink ?? null,
  };
}
