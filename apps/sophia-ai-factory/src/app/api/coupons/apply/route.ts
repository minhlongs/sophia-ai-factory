/**
 * POST /api/coupons/apply
 *
 * Validate coupon codes and return discount info.
 * Requires authentication. Checks D1 coupon_redemptions for per-user reuse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { createServerClient } from '@/lib/db/client';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger-utility';

const applySchema = z.object({
  code: z.string().optional(),
  tier: z.string().optional(),
  project: z.string().optional(),
});

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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = applySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const { data } = parsed;
    const code = (data.code || '').trim().toUpperCase();
    const tier = (data.tier || 'BASIC').toUpperCase();
    const project = data.project || 'sophia';

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
      return NextResponse.json({ success: false, error: 'Mã không áp dụng cho sản phẩm này.' });
    }

    if (coupon.expires && new Date() > new Date(coupon.expires)) {
      return NextResponse.json({ success: false, error: 'Mã giảm giá đã hết hạn.' });
    }

    // Check per-user redemption in D1
    const db = createServerClient();
    const existing = await db
      .prepare('SELECT id FROM coupon_redemptions WHERE user_id = ? AND coupon_code = ? LIMIT 1')
      .bind(user.id, code)
      .first<{ id: number }>();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Bạn đã sử dụng mã giảm giá này rồi.' },
        { status: 409 },
      );
    }

    // Check global usage count vs maxUses
    if (coupon.maxUses < 9999) {
      const usageRow = await db
        .prepare('SELECT COUNT(*) as cnt FROM coupon_redemptions WHERE coupon_code = ?')
        .bind(code)
        .first<{ cnt: number }>();
      if (usageRow && usageRow.cnt >= coupon.maxUses) {
        return NextResponse.json(
          { success: false, error: 'Mã giảm giá đã hết lượt sử dụng.' },
          { status: 409 },
        );
      }
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
  } catch (err) {
    logger.error('[coupons/apply] error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
