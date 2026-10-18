/**
 * Coupon Activation D1 Batch Helper
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

export async function executeCouponActivationBatch(
  d1: D1Database,
  params: {
    userId: string;
    email?: string | null;
    coupon: string;
    tier: string;
    mcuBonus: number;
  },
): Promise<void> {
  const { userId, email: rawEmail, coupon, tier, mcuBonus } = params;
  let orgId = await resolveOrgId(userId, d1);

  const statements: D1PreparedStatement[] = [];
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
    .prepare('SELECT id FROM subscriptions WHERE org_id = ? LIMIT 1')
    .bind(orgId)
    .first();

  if (existing) {
    statements.push(
      d1
        .prepare("UPDATE subscriptions SET plan = ?, status = 'active', updated_at = datetime('now') WHERE org_id = ?")
        .bind(tier, orgId),
    );
  } else {
    statements.push(
      d1
        .prepare("INSERT INTO subscriptions (id, org_id, plan, status, created_at, updated_at) VALUES (?, ?, ?, 'active', datetime('now'), datetime('now'))")
        .bind(crypto.randomUUID(), orgId, tier),
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
        `INSERT INTO mcu_transactions (user_id, delta, reason, metadata)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(userId, mcuBonus, COUPON_ACTIVATION_REASON, JSON.stringify({ coupon })),
  );

  await d1.batch(statements);
}
