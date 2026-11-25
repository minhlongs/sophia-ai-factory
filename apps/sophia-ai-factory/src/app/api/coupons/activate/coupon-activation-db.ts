/**
 * Coupon Activation D1 Batch Helper
 *
 * Enforces:
 * - Atomic one-time redemption per `(user_id, coupon_code)` in `coupon_redemptions`
 * - Optional global `maxUses` check
 * - Bounded 30-day `current_period_end` (never `NULL` forever)
 * - No downgrade of higher active subscription periods/tiers
 *
 * @module app/api/coupons/activate/coupon-activation-db
 */

import { resolveOrgId } from '@/seed/auth/resolve-org-id';

export const TIER_MCU: Record<string, number> = {
  BASIC: 1000,
  PREMIUM: 5000,
  ENTERPRISE: 20000,
  MASTER: 100000,
};

export const VALID_TIERS = new Set(Object.keys(TIER_MCU));
const COUPON_ACTIVATION_REASON = 'Coupon Activation';
const NEW_ORG_STARTER_BALANCE = 50;
const COUPON_PERIOD_DAYS = 30;

export class CouponAlreadyRedeemedError extends Error {
  constructor(message = 'Coupon already redeemed') {
    super(message);
    this.name = 'CouponAlreadyRedeemedError';
  }
}

export class CouponMaxUsesReachedError extends Error {
  constructor(message = 'Coupon maximum redemptions reached') {
    super(message);
    this.name = 'CouponMaxUsesReachedError';
  }
}

function isUniqueRedemptionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed: coupon_redemptions|SQLITE_CONSTRAINT_UNIQUE/i.test(msg);
}

export async function executeCouponActivationBatch(
  d1: D1Database,
  params: {
    userId: string;
    email?: string | null;
    coupon: string;
    tier: string;
    mcuBonus: number;
    maxUses?: number;
  },
): Promise<{ currentPeriodEnd: string }> {
  const { userId, email: rawEmail, coupon, tier, mcuBonus, maxUses = 9999 } = params;

  const existingRedemption = await d1
    .prepare('SELECT id FROM coupon_redemptions WHERE user_id = ? AND coupon_code = ? LIMIT 1')
    .bind(userId, coupon)
    .first<{ id: number }>();

  if (existingRedemption) {
    throw new CouponAlreadyRedeemedError();
  }

  if (maxUses < 9999) {
    const countRow = await d1
      .prepare('SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE coupon_code = ?')
      .bind(coupon)
      .first<{ cnt: number }>();
    if ((countRow?.cnt ?? 0) >= maxUses) {
      throw new CouponMaxUsesReachedError();
    }
  }

  let orgId = await resolveOrgId(userId, d1);

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const periodEndIso = new Date(nowMs + COUPON_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const statements: D1PreparedStatement[] = [
    d1
      .prepare(
        'INSERT INTO coupon_redemptions (coupon_code, user_id, redeemed_at) VALUES (?, ?, ?)',
      )
      .bind(coupon, userId, Math.floor(nowMs / 1000)),
  ];

  let orgBalanceDelta = mcuBonus;

  if (!orgId) {
    const email = rawEmail || 'user';
    const newOrgId = crypto.randomUUID();
    const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase();
    orgBalanceDelta += NEW_ORG_STARTER_BALANCE;
    statements.push(
      d1.prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)').bind(newOrgId, email, slug),
      d1.prepare('INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)').bind(newOrgId, userId, 'owner'),
    );
    orgId = newOrgId;
  }

  const existing = await d1
    .prepare('SELECT id, current_period_end FROM subscriptions WHERE org_id = ? LIMIT 1')
    .bind(orgId)
    .first<{ id: string; current_period_end?: string | null }>();

  const effectivePeriodEnd =
    existing?.current_period_end && existing.current_period_end > periodEndIso
      ? existing.current_period_end
      : periodEndIso;

  if (existing) {
    statements.push(
      d1
        .prepare(
          `UPDATE subscriptions
           SET plan = ?, tier = ?, status = 'active', current_period_end = ?, updated_at = ?
           WHERE org_id = ?`,
        )
        .bind(tier, tier, effectivePeriodEnd, nowIso, orgId),
    );
  } else {
    statements.push(
      d1
        .prepare(
          `INSERT INTO subscriptions (id, org_id, user_id, plan, tier, status, current_period_start, current_period_end, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), orgId, userId, tier, tier, nowIso, effectivePeriodEnd, nowIso, nowIso),
    );
  }

  statements.push(
    d1
      .prepare(
        `INSERT INTO org_balances (org_id, balance, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(org_id) DO UPDATE SET
           balance = balance + excluded.balance,
           updated_at = datetime('now')`,
      )
      .bind(orgId, orgBalanceDelta),
    d1
      .prepare(
        `INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
         VALUES (?, ?, ?, strftime('%s','now'))
         ON CONFLICT(user_id) DO UPDATE SET
           credits_remaining = credits_remaining + excluded.credits_remaining,
           credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
           updated_at = strftime('%s','now')`,
      )
      .bind(userId, mcuBonus, mcuBonus),
    d1
      .prepare(
        `INSERT INTO mcu_transactions (user_id, delta, reason, payment_reference, metadata)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        userId,
        mcuBonus,
        COUPON_ACTIVATION_REASON,
        `coupon_activate_${userId}_${coupon}`,
        JSON.stringify({ coupon, tier, currentPeriodEnd: effectivePeriodEnd }),
      ),
  );

  try {
    await d1.batch(statements);
  } catch (err) {
    if (isUniqueRedemptionError(err)) {
      throw new CouponAlreadyRedeemedError();
    }
    throw err;
  }

  return { currentPeriodEnd: effectivePeriodEnd };
}
