import type { D1Database } from '@cloudflare/workers-types';
import type { Tier } from '@/seed/types';
import type { SubscriptionRow } from './types';

export async function fetchActiveSubscription(
  d1: D1Database,
  orgId: string,
): Promise<SubscriptionRow | null> {
  return d1
    .prepare(
      "SELECT id, org_id, plan, status, current_period_start, current_period_end FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1",
    )
    .bind(orgId)
    .first<SubscriptionRow>();
}

export async function persistScheduledDowngrade(params: {
  d1: D1Database;
  userId: string;
  orgId: string;
  currentTier: Tier;
  targetTier: Tier;
  proratedAmount: number;
  now: string;
}): Promise<void> {
  const { d1, userId, orgId, currentTier, targetTier, proratedAmount, now } = params;

  const settingsRow = await d1
    .prepare('SELECT settings FROM user_profiles WHERE user_id = ?')
    .bind(userId)
    .first<{ settings: string | null }>();

  let settings: Record<string, unknown> = {};
  try {
    if (settingsRow?.settings) settings = JSON.parse(settingsRow.settings) as Record<string, unknown>;
  } catch {
    // ignore parse errors
  }

  settings.tier_change_request = {
    target_tier: targetTier,
    timing: 'end_of_cycle',
    requested_at: Math.floor(Date.now() / 1000),
    from_tier: currentTier,
  };

  if (proratedAmount > 0) {
    const existingCredit = (settings.account_credit_cents as number) ?? 0;
    settings.account_credit_cents = existingCredit + proratedAmount;
    settings.last_credit_reason = `pro_rata_downgrade_${currentTier}_to_${targetTier}`;
    settings.last_credit_at = Math.floor(Date.now() / 1000);
  }

  await d1.batch([
    d1
      .prepare('UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE org_id = ?')
      .bind(now, orgId),
    d1
      .prepare(
        `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(userId, orgId, currentTier, targetTier, 'pending_downgrade'),
    d1
      .prepare('UPDATE user_profiles SET settings = ?, updated_at = ? WHERE user_id = ?')
      .bind(JSON.stringify(settings), now, userId),
  ]);
}
