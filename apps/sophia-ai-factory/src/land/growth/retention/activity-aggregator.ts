/**
 * Customer Retention Activity Aggregator & Query Engine.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/activity-aggregator
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { WINBACK_COOLDOWN_MS } from './constants';
import { computeCustomerHealth } from './health-calculator';
import { fetchRawCustomerMetrics } from './metrics-loader';
import type {
  ChurnRiskLevel,
  CustomerHealthMetrics,
} from './types';

export { fetchRawCustomerMetrics };

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

/**
 * Gets computed health metrics for a single customer.
 */
export async function getCustomerHealthMetrics(
  userId: string,
): Promise<CustomerHealthMetrics | null> {
  const raw = await fetchRawCustomerMetrics(userId);
  if (!raw) return null;

  const metrics = computeCustomerHealth(raw);
  const cooldown = await checkWinBackCooldown(userId);
  metrics.inCooldown = cooldown.inCooldown;
  metrics.lastWinBackAt = cooldown.lastWinBackAt;

  return metrics;
}

/**
 * Lists health metrics for all monitored customers with filtering options.
 */
export async function listAllCustomerHealthMetrics(options?: {
  minScore?: number;
  maxScore?: number;
  riskLevel?: ChurnRiskLevel;
  limit?: number;
}): Promise<CustomerHealthMetrics[]> {
  const db = await getD1();
  if (!db) return [];

  const limit = options?.limit ?? 50;

  try {
    const users = await db
      .prepare('SELECT id FROM "user" ORDER BY createdAt DESC LIMIT ?')
      .bind(limit * 2)
      .all<{ id: string }>();

    if (!users.results || users.results.length === 0) {
      return [];
    }

    const list: CustomerHealthMetrics[] = [];
    for (const u of users.results) {
      const metric = await getCustomerHealthMetrics(u.id);
      if (!metric) continue;

      if (options?.riskLevel && metric.status !== options.riskLevel) {
        continue;
      }
      if (
        options?.minScore !== undefined &&
        metric.totalHealthScore < options.minScore
      ) {
        continue;
      }
      if (
        options?.maxScore !== undefined &&
        metric.totalHealthScore > options.maxScore
      ) {
        continue;
      }

      list.push(metric);
      if (list.length >= limit) break;
    }

    // Sort most critical risk first
    return list.sort((a, b) => a.totalHealthScore - b.totalHealthScore);
  } catch (err) {
    logger.error(
      '[CustomerRetentionService] listAllCustomerHealthMetrics failed',
      { err: String(err) },
    );
    return [];
  }
}
