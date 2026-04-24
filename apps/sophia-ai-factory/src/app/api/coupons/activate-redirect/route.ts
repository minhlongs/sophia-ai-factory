/**
 * GET /api/coupons/activate-redirect?coupon=FREE50&tier=MASTER
 *
 * Browser-friendly coupon activation. User clicks link → activate → redirect dashboard.
 * Requires auth cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { toError } from '@/lib/utils/to-error';

// Direct D1 access for raw SQL (query builder may not support upsert)
function getD1Binding(): D1Database | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  const ctxSymbol = Symbol.for('__cloudflare-context__');
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  return null;
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

export async function GET(request: NextRequest) {
  const coupon = (request.nextUrl.searchParams.get('coupon') || '').toUpperCase();
  const tier = (request.nextUrl.searchParams.get('tier') || 'MASTER').toUpperCase();

  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.redirect(new URL(`/vi/login?coupon=${coupon}&tier=${tier}&free=1`, request.url));
  }

  const couponDef = VALID_COUPONS[coupon];
  if (!couponDef) {
    return NextResponse.redirect(new URL('/dashboard?error=invalid_coupon', request.url));
  }

  try {
    const d1 = getD1Binding();
    if (!d1) {
      return NextResponse.redirect(new URL('/dashboard?error=db_unavailable', request.url));
    }

    const userId = user.id;

    // Find user's org — auto-create if missing
    let orgRow = await d1.prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1').bind(userId).first<{ org_id: string }>();
    if (!orgRow) {
      const email = user.email || 'user';
      const newOrgId = crypto.randomUUID();
      const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
      await d1.batch([
        d1.prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)').bind(newOrgId, email, slug),
        d1.prepare('INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)').bind(newOrgId, userId, 'owner'),
        d1.prepare('INSERT OR IGNORE INTO org_balances (org_id, balance, updated_at) VALUES (?, 50, datetime(\'now\'))').bind(newOrgId),
      ]);
      orgRow = { org_id: newOrgId };
    }
    const orgId = orgRow.org_id;
    const mcuMonthly = TIER_MCU[tier] || TIER_MCU.BASIC;

    // Upsert subscription — D1 schema uses 'plan' column
    await d1.prepare(`INSERT INTO subscriptions (org_id, plan, status, created_at, updated_at)
      VALUES (?, ?, 'active', datetime('now'), datetime('now'))
      ON CONFLICT(org_id) DO UPDATE SET plan=?, status='active', updated_at=datetime('now')`)
      .bind(orgId, tier, tier)
      .run();

    // Add MCU bonus to org_balances
    await d1.prepare(`UPDATE org_balances SET balance = balance + ?, updated_at = datetime('now') WHERE org_id = ?`)
      .bind(couponDef.mcuBonus, orgId)
      .run();

    return NextResponse.redirect(new URL(`/dashboard?activated=${tier}&bonus=${couponDef.mcuBonus}`, request.url));
  } catch (e) {
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(toError(e).message)}`, request.url));
  }
}
