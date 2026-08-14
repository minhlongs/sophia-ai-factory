/**
 * OpenClaw Bridge: callRedeemFree100 — promo code redemption with auto-customer creation.
 * @module land/openclaw-telegram/openclaw-bridge-redeem
 */

import { getD1 } from '@/seed/db/client';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { applyPromoCode } from '@/land/promo/promo-applier';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Database as _D1Database } from '@cloudflare/workers-types';

export interface RedeemFree100Input {
  code: string;
  email: string;
  fullName?: string;
  tier?: string;
  locale?: string;
}

export interface RedeemFree100Result {
  success: boolean;
  magicLink?: string;
  handoverId?: string;
  error?: string;
}

export async function callRedeemFree100(input: RedeemFree100Input): Promise<RedeemFree100Result> {
  try {
    const preCheck = await validatePromoCode(input.code);

    if (!preCheck.valid) {
      return { success: false, error: preCheck.reason ?? 'invalid_code' };
    }

    // Paid promo (percent_off/fixed_off) requires checkout flow, not free100 redemption.
    if (preCheck.discountType && !preCheck.discountType.startsWith('free')) {
      return { success: false, error: 'payment_required' };
    }

    const d1 = getD1();
    if (!d1) throw new Error('D1 database binding not available');

    // Check if user already exists
    const existingUser = await d1
      .prepare('SELECT id FROM user WHERE email = ?1')
      .bind(input.email)
      .first<{ id: string }>();

    const userId = existingUser?.id ?? null;
    if (!userId) {
      return { success: false, error: 'Failed to create or find user' };
    }

    const result = await applyPromoCode({
      code: input.code,
      userId,
      email: input.email,
      tier: input.tier ?? preCheck.appliesToTier ?? 'MASTER',
      locale: input.locale ?? 'vi',
    });

    return {
      success: true,
      magicLink: result.magicLink ?? undefined,
      handoverId: result.handoverId ?? undefined,
    };
  } catch (err) {
    logger.error('[openclaw-bridge] redeem-free failed', err instanceof Error ? err : undefined);
    return { success: false, error: err instanceof Error ? err.message : 'redeem_failed' };
  }
}
