/**
 * Customer Raw Metrics Loader & D1 Query Engine.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/metrics-loader
 */

import { getD1 } from '@/seed/db/client';
import { getBalance } from '@/tree/mcu/credits-repo';
import { logger } from '@/seed/utils/logger-utility';
import {
  resolveLastActiveTimestamp,
  resolveRenderJobCounts,
} from './activity-resolvers';
import type { RawCustomerActivityMetrics } from './types';

interface D1UserRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: string | null;
}

interface D1CountRow {
  cnt: number;
}

/**
 * Fetches raw telemetry metrics for a specific user from D1.
 */
export async function fetchRawCustomerMetrics(
  userId: string,
): Promise<RawCustomerActivityMetrics | null> {
  const db = await getD1();
  if (!db) {
    logger.warn('[CustomerRetentionService] D1 binding unavailable');
    return null;
  }

  try {
    const userRow = await db
      .prepare('SELECT id, email, name, createdAt FROM "user" WHERE id = ?')
      .bind(userId)
      .first<D1UserRow>();

    if (!userRow) return null;

    const nowMs = Date.now();
    const window30dSec = Math.floor((nowMs - 30 * 86400000) / 1000);
    const lastActiveMs = await resolveLastActiveTimestamp(
      db,
      userId,
      userRow.createdAt,
    );

    const daysSinceLastActive = lastActiveMs
      ? Math.max(0, Math.floor((nowMs - lastActiveMs) / (86400 * 1000)))
      : 45;

    let videosCreated30d = 0;
    try {
      const videoRow = await db
        .prepare(
          'SELECT COUNT(*) as cnt FROM videos WHERE user_id = ? AND created_at >= ?',
        )
        .bind(userId, window30dSec)
        .first<D1CountRow>();
      videosCreated30d = videoRow?.cnt ?? 0;
    } catch {
      // Non-fatal
    }

    const balance = await getBalance(userId);
    const creditsRemaining = balance.credits_remaining;
    const creditsPurchased = balance.credits_total_purchased;
    const { completedJobs, failedJobs } = await resolveRenderJobCounts(
      db,
      userId,
    );

    const totalJobs = completedJobs + failedJobs;
    const renderSuccessRate = totalJobs > 0 ? completedJobs / totalJobs : 1.0;

    return {
      userId,
      userEmail: userRow.email,
      userName: userRow.name,
      lastActiveAt: lastActiveMs ? new Date(lastActiveMs).toISOString() : null,
      daysSinceLastActive,
      videosCreated30d,
      creditsRemaining,
      creditsPurchased,
      totalJobs,
      completedJobs,
      failedJobs,
      renderSuccessRate,
    };
  } catch (err) {
    logger.error(
      '[CustomerRetentionService] fetchRawCustomerMetrics failed',
      { userId, err: String(err) },
    );
    return null;
  }
}
