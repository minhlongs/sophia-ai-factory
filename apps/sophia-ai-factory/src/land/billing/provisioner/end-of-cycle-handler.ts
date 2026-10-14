import { logger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';
import type { ProvisionResult, ProvisionTierChangeParams, SubscriptionRow } from './types';

export async function handleEndOfCycleChange(
  db: D1Database,
  sub: SubscriptionRow,
  params: ProvisionTierChangeParams,
  eventType: string,
  now: string
): Promise<ProvisionResult> {
  const { userId, orgId, currentTier, targetTier } = params;

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

  settings.tier_change_request = {
    target_tier: targetTier,
    timing: 'end_of_cycle',
    requested_at: Math.floor(Date.now() / 1000),
    from_tier: currentTier,
  };

  await db.batch([
    db
      .prepare('UPDATE user_profiles SET settings = ?1, updated_at = ?2 WHERE user_id = ?3')
      .bind(JSON.stringify(settings), now, userId),
    db
      .prepare(
        `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type)
         VALUES (?1, ?2, ?3, ?4, ?5)`
      )
      .bind(userId, orgId, currentTier, targetTier, `pending_${eventType}`),
  ]);

  logger.info('[TierProvisioner] End-of-cycle change scheduled', {
    userId,
    currentTier,
    targetTier,
  });

  return { success: true, effectiveAt: sub.current_period_end };
}
