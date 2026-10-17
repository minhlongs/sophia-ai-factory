/**
 * Promo trial expiry & redemption queries
 * @module land/promo/repo/promo-trial-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { RedemptionRow } from './types';

export async function listRedemptionsByCode(
  codeId: string,
  limit = 50,
  offset = 0,
): Promise<RedemptionRow[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const { results } = await db
    .prepare(
      `SELECT * FROM promo_code_redemptions
       WHERE promo_code_id = ?1
       ORDER BY redeemed_at DESC
       LIMIT ?2 OFFSET ?3`,
    )
    .bind(codeId, limit, offset)
    .all<RedemptionRow>();
  return results ?? [];
}

export async function setUserTrialExpiry(
  userId: string,
  trialEndsAt: number,
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const nowSec = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `UPDATE subscriptions SET trial_ends_at = ?1, updated_at = ?2 WHERE user_id = ?3`,
      )
      .bind(trialEndsAt, nowSec, userId)
      .run();
  } catch (err) {
    logger.warn('[PromoRepo] setUserTrialExpiry failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getExpiredTrialUsers(
  nowSec: number,
): Promise<{ user_id: string; email: string | null }[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const { results } = await db
    .prepare(
      `SELECT s.user_id, u.email
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.trial_ends_at IS NOT NULL
         AND s.trial_ends_at <= ?1
         AND s.status = 'active'
       LIMIT 100`,
    )
    .bind(nowSec)
    .all<{ user_id: string; email: string | null }>();
  return results ?? [];
}
