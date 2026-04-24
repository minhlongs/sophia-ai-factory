/**
 * GET /api/coupons/activate-redirect?coupon=FREE50&tier=MASTER
 *
 * Browser-friendly coupon activation. User clicks link → activate → redirect dashboard.
 * Requires auth cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import { verifyJwt } from '@/lib/db/auth-verify';

const VALID_COUPONS: Record<string, { mcuBonus: number }> = {
  FREE50: { mcuBonus: 1000 },
  LAUNCH25: { mcuBonus: 500 },
};

const TIER_MCU: Record<string, number> = {
  BASIC: 1000,
  PREMIUM: 5000,
  ENTERPRISE: 20000,
  MASTER: 100000,
};

export async function GET(request: NextRequest) {
  const coupon = (request.nextUrl.searchParams.get('coupon') || '').toUpperCase();
  const tier = (request.nextUrl.searchParams.get('tier') || 'MASTER').toUpperCase();

  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL(`/vi/login?coupon=${coupon}&tier=${tier}&free=1`, request.url));
  }

  const payload = await verifyJwt(token);
  if (!payload?.sub) {
    return NextResponse.redirect(new URL(`/vi/login?coupon=${coupon}&tier=${tier}&free=1`, request.url));
  }

  const couponDef = VALID_COUPONS[coupon];
  if (!couponDef) {
    return NextResponse.redirect(new URL('/dashboard?error=invalid_coupon', request.url));
  }

  try {
    const db = await getD1Client();
    const userId = payload.sub as string;

    const { data: member } = await db.from('org_members').select('org_id').eq('user_id', userId).single();
    if (!member) {
      return NextResponse.redirect(new URL('/dashboard?error=no_org', request.url));
    }
    const orgId = (member as Record<string, string>).org_id;

    const mcuMonthly = TIER_MCU[tier] || TIER_MCU.BASIC;

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

    return NextResponse.redirect(new URL(`/dashboard?activated=${tier}&bonus=${couponDef.mcuBonus}`, request.url));
  } catch (e) {
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent((e as Error).message)}`, request.url));
  }
}
