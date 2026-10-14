/**
 * Promo Redeem Free Core Business Processor
 *
 * Layer: app/api/promo/redeem-free/service
 */

import { NextResponse } from 'next/server';
import { applyPromoCode } from '@/land/promo/promo-applier';
import { validatePromoCode } from '@/land/promo/promo-validator';
import { getD1 } from '@/seed/db/client';
import { createCustomerUser } from '@/tree/handover/handover-account-setup';
import { logger } from '@/seed/utils/logger-utility';
import { redeemFreeSchema } from './types';
import { findOrResolveUser } from './user-resolver';
import { dispatchHandoverNotifications } from './handover-dispatcher';

export async function processRedeemFreeRequest(request: Request): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
    const parsed = redeemFreeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { code, email, fullName, agencyType, tier, locale } = parsed.data;

    const preCheck = await validatePromoCode(code, { tier });
    if (!preCheck.valid) {
      return NextResponse.json({ error: 'invalid_code', reason: preCheck.reason }, { status: 400 });
    }

    if (preCheck.discountType !== 'free_trial' && preCheck.discountType !== 'free_full') {
      return NextResponse.json(
        { error: 'Code requires payment. Use checkout flow.' },
        { status: 400 }
      );
    }

    const resolved = await findOrResolveUser(request, email);
    let userId = resolved.userId;

    if (userId && !resolved.sessionEmailVerified) {
      return NextResponse.json(
        { error: 'email_not_verified', hint: 'Please verify your email before redeeming the FREE100 code.' },
        { status: 403 }
      );
    }

    if (!userId) {
      try {
        const _db = await getD1();
        if (!_db) {
          throw new Error('D1 unavailable');
        }
        const db = _db;
        const resolvedName = fullName?.trim() || email.split('@')[0];
        userId = await createCustomerUser(db, email, resolvedName);
        logger.info('[RedeemFree] Auto-created customer user', { userId, email });
      } catch (err) {
        logger.error('[RedeemFree] Auto-create user failed', err instanceof Error ? err : undefined);
        return NextResponse.json(
          { error: 'user_create_failed', hint: 'Email may already exist. Try logging in first.' },
          { status: 500 }
        );
      }
    }

    const result = await applyPromoCode({
      code,
      userId,
      email,
      fullName,
      agencyType,
      tier: tier ?? preCheck.appliesToTier ?? 'BASIC',
      locale: locale ?? 'vi',
    });

    logger.info('[RedeemFree] Promo redeemed', { code, userId, redemptionId: result.redemptionId });

    if (result.magicLink) {
      dispatchHandoverNotifications({
        userId,
        email,
        fullName,
        magicLink: result.magicLink,
        locale,
        tier,
        fallbackTier: preCheck.appliesToTier ?? undefined,
      });
    }

    return NextResponse.json({
      success: true,
      redemptionId: result.redemptionId,
      magicLink: result.magicLink,
      handoverId: result.handoverId,
      trialDaysGranted: result.trialDaysGranted,
      handoverError: result.handoverId && !result.magicLink ? 'activation_link_failed' : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Redemption failed';
    logger.error('[RedeemFree] Error', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
