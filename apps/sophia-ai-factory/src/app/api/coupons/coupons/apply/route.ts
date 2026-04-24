/**
 * POST /api/coupons/apply
 *
 * Validate coupon codes and return discount info.
 * Self-contained — no external API calls needed.
 */

import { NextRequest, NextResponse } from 'next/server';

const COUPONS: Record<string, {
  discountPercent: number;
  maxUses: number;
  expires: string | null;
  projects: string[];
}> = {
  FREE50: {
    discountPercent: 100,
    maxUses: 9999,
    expires: null,
    projects: ['sophia', 'mekongmind'],
  },
  LAUNCH25: {
    discountPercent: 25,
    maxUses: 100,
    expires: '2026-12-31',
    projects: ['sophia', 'mekongmind'],
  },
};

const PRICING: Record<string, number> = {
  BASIC: 199,
  PREMIUM: 399,
  MASTER: 799,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = (body.code || '').trim().toUpperCase();
    const tier = (body.tier || 'BASIC').toUpperCase();
    const project = body.project || 'sophia';

    const coupon = COUPONS[code];
    if (!coupon) {
      return NextResponse.json({
        success: false,
        discountPercent: 0,
        originalPrice: 0,
        finalPrice: 0,
        error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn.',
      });
    }

    if (!coupon.projects.includes(project)) {
      return NextResponse.json({
        success: false,
        error: 'Mã không áp dụng cho sản phẩm này.',
      });
    }

    if (coupon.expires && new Date() > new Date(coupon.expires)) {
      return NextResponse.json({
        success: false,
        error: 'Mã giảm giá đã hết hạn.',
      });
    }

    const original = PRICING[tier] || 199;
    const finalPrice = Math.max(0, Math.floor(original * (100 - coupon.discountPercent) / 100));

    return NextResponse.json({
      success: true,
      discountPercent: coupon.discountPercent,
      originalPrice: original,
      finalPrice,
      error: '',
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Server error',
    }, { status: 500 });
  }
}
