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

const VALID_TIERS = new Set(Object.keys(TIER_MCU));
const COUPON_ACTIVATION_REASON = 'Coupon Activation';
const NEW_ORG_STARTER_BALANCE = 50;

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

    const couponDef = VALID_COUPONS[coupon];
    if (!couponDef) {
      return NextResponse.json({ success: false, error: 'Invalid coupon' });
    }
    if (!VALID_TIERS.has(tier)) {
      return NextResponse.json({ success: false, error: 'Invalid tier' }, { status: 400 });
    }

    let d1: D1Database;
    try {
      const _d1 = getD1();
      if (!_d1) throw new Error('D1 database binding not available');
      d1 = _d1;
    } catch {
      return NextResponse.json({ success: false, error: 'Database unavailable' }, { status: 500 });
    }

    const userId = user.id;
    const payload = { email: user.email }; // compat for org auto-create below
    const mcuMonthly = TIER_MCU[tier];

    // Find user's org — auto-create if missing (old accounts before signup fix)
    let orgRow = await d1.prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(userId).first<{ org_id: string }>();

    const statements: D1PreparedStatement[] = [];
    let orgBalanceDelta = couponDef.mcuBonus;

    if (!orgRow) {
      const email = (payload.email as string) || 'user';
      const newOrgId = crypto.randomUUID();
      const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
      orgBalanceDelta += NEW_ORG_STARTER_BALANCE;
      statements.push(
        d1.prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)').bind(newOrgId, email, slug),
        d1.prepare('INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)').bind(newOrgId, userId, 'owner'),
      );
      orgRow = { org_id: newOrgId };
    }

    // Check if subscription exists, then INSERT or UPDATE
    const existing = await d1.prepare('SELECT id FROM subscriptions WHERE org_id = ? LIMIT 1')
      .bind(orgRow.org_id).first();
    if (existing) {
      statements.push(
        d1.prepare("UPDATE subscriptions SET plan = ?, status = 'active', updated_at = datetime('now') WHERE org_id = ?")
          .bind(tier, orgRow.org_id),
      );
    } else {
      statements.push(
        d1.prepare("INSERT INTO subscriptions (id, org_id, plan, status, created_at, updated_at) VALUES (?, ?, ?, 'active', datetime('now'), datetime('now'))")
          .bind(crypto.randomUUID(), orgRow.org_id, tier),
      );
    }

    statements.push(
      d1.prepare(
        `INSERT INTO org_balances (org_id, balance, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(org_id) DO UPDATE SET
           balance = balance + excluded.balance,
           updated_at = datetime('now')`,
      ).bind(orgRow.org_id, orgBalanceDelta),
      d1.prepare(
        `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
         VALUES (?, ?, ?, strftime('%s','now'))
         ON CONFLICT(user_id) DO UPDATE SET
           credits_remaining = credits_remaining + excluded.credits_remaining,
           credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
           updated_at = strftime('%s','now')`,
      ).bind(userId, couponDef.mcuBonus, couponDef.mcuBonus),
      d1.prepare(
        `INSERT INTO mcu_transactions (user_id, delta, reason, metadata)
         VALUES (?, ?, ?, ?)`,
      ).bind(userId, couponDef.mcuBonus, COUPON_ACTIVATION_REASON, JSON.stringify({ coupon })),
    );

    try {
      await d1.batch(statements);
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
