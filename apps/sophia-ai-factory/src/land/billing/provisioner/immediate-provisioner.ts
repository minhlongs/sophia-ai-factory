import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';
import { calculateProRataCredit } from './credit-calculator';
import type { ProvisionResult, ProvisionTierChangeParams, SubscriptionRow } from './types';

export async function handleImmediateProvision(
  db: D1Database,
  sub: SubscriptionRow,
  params: ProvisionTierChangeParams,
  eventType: string,
  now: string
): Promise<ProvisionResult> {
  const { userId, orgId, currentTier, targetTier } = params;

  let creditCents = 0;
  const currentPrice = UNIFIED_TIERS[currentTier].priceInCents;
  creditCents = calculateProRataCredit(
    currentPrice,
    sub.current_period_start,
    sub.current_period_end
  );

  const newPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let settingsUpdate: string | null = null;
  if (creditCents > 0) {
    const settingsRow = await db
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?1')
      .bind(userId)
      .first<{ settings: string | null }>();

    let settings: Record<string, unknown> = {};
    try {
      if (settingsRow?.settings) {
        settings = JSON.parse(settingsRow.settings) as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }

    const existingCredit = (settings.account_credit_cents as number) ?? 0;
    settings.account_credit_cents = existingCredit + creditCents;
    settings.last_credit_reason = `pro_rata_downgrade_${currentTier}_to_${targetTier}`;
    settings.last_credit_at = Math.floor(Date.now() / 1000);
    delete settings.tier_change_request;
    settingsUpdate = JSON.stringify(settings);
  }

  const stmts = [
    db
      .prepare(
        'UPDATE subscriptions SET plan = ?1, current_period_start = ?2, current_period_end = ?3, updated_at = ?4 WHERE org_id = ?5'
      )
      .bind(targetTier.toLowerCase(), now, newPeriodEnd, now, orgId),
    db
      .prepare('UPDATE organizations SET plan = ?1, updated_at = ?2 WHERE id = ?3')
      .bind(targetTier.toLowerCase(), now, orgId),
    db
      .prepare(
        `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type)
         VALUES (?1, ?2, ?3, ?4, ?5)`
      )
      .bind(userId, orgId, currentTier, targetTier, eventType),
  ];

  if (settingsUpdate) {
    stmts.push(
      db
        .prepare('UPDATE user_profiles SET settings = ?1, updated_at = ?2 WHERE user_id = ?3')
        .bind(settingsUpdate, now, userId)
    );
  } else {
    const settingsRow = await db
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?1')
      .bind(userId)
      .first<{ settings: string | null }>();

    let settings: Record<string, unknown> = {};
    try {
      if (settingsRow?.settings) {
        settings = JSON.parse(settingsRow.settings) as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }

    if (settings.tier_change_request) {
      delete settings.tier_change_request;
      stmts.push(
        db
          .prepare('UPDATE user_profiles SET settings = ?1, updated_at = ?2 WHERE user_id = ?3')
          .bind(JSON.stringify(settings), now, userId)
      );
    }
  }

  await db.batch(stmts);

  logger.info('[TierProvisioner] Immediate tier change provisioned', {
    userId,
    orgId,
    from: currentTier,
    to: targetTier,
    creditCents,
    eventType,
  });

  return { success: true, creditCents: creditCents || undefined };
}
