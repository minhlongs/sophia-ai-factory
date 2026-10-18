/**
 * Customer Retention Activity Aggregator & Query Engine.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/activity-aggregator
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { computeCustomerHealth } from './health-calculator';
import { fetchRawCustomerMetrics } from './metrics-loader';
import {
  checkWinBackCooldown,
  recordWinBackOutreach,
} from './winback-cooldown-store';
import type {
  ChurnRiskLevel,
  CustomerHealthMetrics,
} from './types';

export {
  fetchRawCustomerMetrics,
  checkWinBackCooldown,
  recordWinBackOutreach,
};

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
