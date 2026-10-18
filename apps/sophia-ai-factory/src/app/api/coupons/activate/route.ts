/**
 * POST /api/coupons/activate
 *
 * Activate coupon → upgrade subscription tier + MCU bonus.
 * Uses raw D1 SQL (query builder upsert doesn't work).
 * Requires auth cookie or Bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { toError } from '@/seed/utils/to-error';
import { getD1 } from '@/seed/db/client';
import { csrfForbiddenResponse, verifyCsrfToken } from '@/seed/security/csrf';
import { getActivateCoupons } from '@/seed/config/coupons';
import {
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
    const tier = (body.tier || 'MASTER').toUpperCase();

    const couponDef = getActivateCoupons()[coupon];
    if (!couponDef) {
      return NextResponse.json({ success: false, error: 'Invalid coupon' });
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

    try {
      await executeCouponActivationBatch(d1, {
        userId: user.id,
        email: user.email,
        coupon,
        tier,
        mcuBonus: couponDef.mcuBonus,
      });
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to add MCU credits' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tier,
      mcuMonthly,
      mcuBonus: couponDef.mcuBonus,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: toError(e).message }, { status: 500 });
  }
}
