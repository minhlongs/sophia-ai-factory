/**
 * POST /api/coupons/activate
 *
 * Activate 100%-discount coupon → bounded 30-day subscription tier + one-time MCU bonus.
 * Enforces:
 * - Explicit `PROMO_COUPON_CODES` (no hardcoded fallback coupons)
 * - `discountPercent === 100` (partial-discount coupons cannot grant $0 tier activation)
 * - Expiration check
 * - Atomic single-redemption per `(user_id, coupon_code)` in `coupon_redemptions` (409 on replay)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { toError } from '@/seed/utils/to-error';
import { getD1 } from '@/seed/db/client';
import { csrfForbiddenResponse, verifyCsrfToken } from '@/seed/security/csrf';
import { getCouponDefinitions } from '@/seed/config/coupons';
import {
  CouponAlreadyRedeemedError,
  CouponMaxUsesReachedError,
  TIER_MCU,
  VALID_TIERS,
  executeCouponActivationBatch,
} from './coupon-activation-db';

interface CouponActivateRequest {
  coupon?: string;
  tier?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyCsrfToken(request)) return csrfForbiddenResponse();

    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as CouponActivateRequest;
    const coupon = (body.coupon || '').trim().toUpperCase();
    const tier = (body.tier || 'BASIC').toUpperCase();

    const couponDef = getCouponDefinitions()[coupon];
    if (!couponDef) {
      return NextResponse.json({ success: false, error: 'Invalid coupon' }, { status: 404 });
    }

    if (couponDef.projects.length > 0 && !couponDef.projects.includes('sophia')) {
      return NextResponse.json({ success: false, error: 'Coupon not valid for Sophia' }, { status: 400 });
    }

    if (couponDef.expires && new Date() > new Date(couponDef.expires)) {
      return NextResponse.json({ success: false, error: 'Coupon expired' }, { status: 410 });
    }

    if (couponDef.discountPercent !== 100) {
      return NextResponse.json(
        { success: false, error: 'Partial-discount coupons require paid checkout' },
        { status: 400 },
      );
    }

    if (!VALID_TIERS.has(tier)) {
      return NextResponse.json({ success: false, error: 'Invalid tier' }, { status: 400 });
    }

    let d1: D1Database;
    try {
      const _d1 = await getD1();
      if (!_d1) throw new Error('D1 database binding not available');
      d1 = _d1;
    } catch {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
    }

    const mcuMonthly = TIER_MCU[tier];

    let activationResult: { currentPeriodEnd: string };
    try {
      activationResult = await executeCouponActivationBatch(d1, {
        userId: user.id,
        email: user.email,
        coupon,
        tier,
        mcuBonus: couponDef.mcuBonus,
        maxUses: couponDef.maxUses,
      });
    } catch (err) {
      if (err instanceof CouponAlreadyRedeemedError || err instanceof CouponMaxUsesReachedError) {
        return NextResponse.json({ success: false, error: err.message }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: 'Failed to add MCU credits' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tier,
      mcuMonthly,
      mcuBonus: couponDef.mcuBonus,
      currentPeriodEnd: activationResult.currentPeriodEnd,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: toError(e).message }, { status: 500 });
  }
}
