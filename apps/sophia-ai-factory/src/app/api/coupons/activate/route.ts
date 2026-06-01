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
import { addCredits } from '@/land/mcu/credits-repo';

interface CouponActivateRequest {
  coupon?: string;
  tier?: string;
}

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

function getD1(): D1Database | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as CouponActivateRequest;
    const coupon = (body.coupon || '').trim().toUpperCase();
    const tier = (body.tier || 'MASTER').toUpperCase();

    const couponDef = VALID_COUPONS[coupon];
    if (!couponDef) {
      return NextResponse.json({ success: false, error: 'Invalid coupon' });
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
    }

    const userId = user.id;
    const payload = { email: user.email }; // compat for org auto-create below
    const mcuMonthly = TIER_MCU[tier] || TIER_MCU.BASIC;

    // Find user's org — auto-create if missing (old accounts before signup fix)
    let orgRow = await d1.prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(userId).first<{ org_id: string }>();

    if (!orgRow) {
      const email = (payload.email as string) || 'user';
      const newOrgId = crypto.randomUUID();
      const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
      await d1.batch([
        d1.prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)').bind(newOrgId, email, slug),
        d1.prepare('INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)').bind(newOrgId, userId, 'owner'),
        d1.prepare('INSERT OR IGNORE INTO org_balances (org_id, balance, updated_at) VALUES (?, 50, datetime(\'now\'))').bind(newOrgId),
      ]);
      orgRow = { org_id: newOrgId };
    }

    // Check if subscription exists, then INSERT or UPDATE
    const existing = await d1.prepare('SELECT id FROM subscriptions WHERE org_id = ? LIMIT 1')
      .bind(orgRow.org_id).first();
    if (existing) {
      await d1.prepare("UPDATE subscriptions SET plan = ?, status = 'active', updated_at = datetime('now') WHERE org_id = ?")
        .bind(tier, orgRow.org_id).run();
    } else {
      await d1.prepare("INSERT INTO subscriptions (id, org_id, plan, status, created_at, updated_at) VALUES (?, ?, ?, 'active', datetime('now'), datetime('now'))")
        .bind(crypto.randomUUID(), orgRow.org_id, tier).run();
    }

    // Add MCU bonus
    await d1.prepare('UPDATE org_balances SET balance = balance + ?, updated_at = datetime(\'now\') WHERE org_id = ?')
      .bind(couponDef.mcuBonus, orgRow.org_id)
      .run();

    await addCredits(userId, couponDef.mcuBonus, 'Coupon Activation', { coupon });

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
