/**
 * POST /api/coupons/activate
 *
 * After login with coupon, upgrade user's subscription tier.
 * Requires auth cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import { verifyJwt } from '@/lib/db/auth-verify';

const VALID_COUPONS: Record<string, { tier: string; mcuBonus: number }> = {
  FREE50: { tier: 'MASTER', mcuBonus: 1000 },
  LAUNCH25: { tier: 'PREMIUM', mcuBonus: 500 },
};

const TIER_MCU: Record<string, number> = {
  BASIC: 1000,
  PREMIUM: 5000,
  MASTER: 100000,
};

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
      || request.headers.get('authorization')?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const payload = await verifyJwt(token);
    if (!payload?.sub) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const coupon = (body.coupon || '').trim().toUpperCase();
    const requestedTier = (body.tier || '').toUpperCase();

    const couponDef = VALID_COUPONS[coupon];
    if (!couponDef) {
      return NextResponse.json({ success: false, error: 'Invalid coupon' });
    }

    const tier = requestedTier || couponDef.tier;
    const mcuMonthly = TIER_MCU[tier] || TIER_MCU.BASIC;

    const db = await getD1Client();
    const userId = payload.sub as string;

    // Find user's org
    const { data: member } = await db.from('org_members').select('org_id').eq('user_id', userId).single();
    if (!member) {
      return NextResponse.json({ success: false, error: 'No organization found' });
    }
    const orgId = (member as Record<string, string>).org_id;

    // Upsert subscription
    await db.from('subscriptions').upsert({
      org_id: orgId,
      tier_name: tier,
      status: 'active',
      mcu_monthly: mcuMonthly,
      coupon_code: coupon,
      activated_at: new Date().toISOString(),
    });

    // Add MCU bonus
    await db.rpc('credit_mcu_balance', {
      p_org_id: orgId,
      p_amount: couponDef.mcuBonus,
      p_subscription_id: `coupon:${coupon}:${tier}`,
    });

    return NextResponse.json({
      success: true,
      tier,
      mcuMonthly,
      mcuBonus: couponDef.mcuBonus,
      message: `Upgraded to ${tier} with ${couponDef.mcuBonus} bonus MCU!`,
    });
  } catch (e) {
    return NextResponse.json({
      success: false,
      error: (e as Error).message,
    }, { status: 500 });
  }
}
