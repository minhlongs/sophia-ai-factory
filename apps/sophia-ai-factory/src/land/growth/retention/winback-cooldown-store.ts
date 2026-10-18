/**
 * Win-Back Cooldown Persistence & Audit Logger.
 *
 * Layer: land/growth/retention
 * @module land/growth/retention/winback-cooldown-store
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { WINBACK_COOLDOWN_MS } from './constants';

/**
 * Checks whether an anti-churn win-back outreach was dispatched within the cooldown window.
 */
export async function checkWinBackCooldown(
  userId: string,
  cooldownMs: number = WINBACK_COOLDOWN_MS,
): Promise<{ inCooldown: boolean; lastWinBackAt?: string }> {
  try {
    const db = await getD1();
    if (!db) return { inCooldown: false };

    const stmt = db.prepare(
      `SELECT created_at, payload FROM admin_audit_log
       WHERE target_user_id = ? AND action_type = 'anti_churn_win_back'
       ORDER BY created_at DESC LIMIT 1`,
    );
    const row = await stmt
      .bind(userId)
      .first<{ created_at: number; payload: string | null }>();

    if (!row) {
      return { inCooldown: false };
    }

    const lastTimestampMs =
      row.created_at > 10000000000 ? row.created_at : row.created_at * 1000;
    const elapsed = Date.now() - lastTimestampMs;

    return {
      inCooldown: elapsed < cooldownMs,
      lastWinBackAt: new Date(lastTimestampMs).toISOString(),
    };
  } catch (err) {
    logger.warn('[CustomerRetentionService] checkWinBackCooldown error', {
      userId,
      err: String(err),
    });
    return { inCooldown: false };
  }
}

/**
 * Records win-back outreach event to admin_audit_log for auditability & cooldown enforcement.
 */
export async function recordWinBackOutreach(
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getD1();
    if (!db) return;

    await db
      .prepare(
        `INSERT INTO admin_audit_log (id, actor_user_id, action_type, target_user_id, payload, created_at)
       VALUES (lower(hex(randomblob(16))), 'system_anti_churn_guardian', 'anti_churn_win_back', ?, ?, strftime('%s','now'))`,
      )
      .bind(userId, JSON.stringify(payload))
      .run();
  } catch (err) {
    logger.error('[CustomerRetentionService] recordWinBackOutreach error', {
      userId,
      err: String(err),
    });
  }
}
