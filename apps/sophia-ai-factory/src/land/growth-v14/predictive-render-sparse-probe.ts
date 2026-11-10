/**
 * Server-side D1 sparse-data telemetry probe for Predictive Render scheduling.
 *
 * When a caller omits `sparseData`, queries D1 `affiliate_conversions`,
 * deduplicated `video_analytics`, and `"user"` account age so sparse channels
 * cannot bypass Track B's Sparse-Data Hold simply by omitting client input.
 *
 * @module land/growth-v14/predictive-render-sparse-probe
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';
import type { SparseDataGateInput } from '@/tree/growth/sparse-data-growth-guard';

const logger = createLogger('predictive-render-sparse-probe');
const MS_PER_DAY = 86_400_000;

const FAIL_CLOSED_SPARSE_INPUT: SparseDataGateInput = {
  monthlyVerifiedConversions: 0,
  variantImpressions: [],
  accountAgeDays: 0,
};

function parseAccountAgeDays(rawCreatedAt: unknown, nowMs: number): number {
  if (rawCreatedAt === null || rawCreatedAt === undefined) return 0;
  let createdMs = Number.NaN;
  if (typeof rawCreatedAt === 'number' && Number.isFinite(rawCreatedAt)) {
    createdMs = rawCreatedAt < 1e12 ? rawCreatedAt * 1000 : rawCreatedAt;
  } else if (typeof rawCreatedAt === 'string') {
    const trimmed = rawCreatedAt.trim();
    const asNumber = Number(trimmed);
    if (trimmed.length > 0 && Number.isFinite(asNumber)) {
      createdMs = asNumber < 1e12 ? asNumber * 1000 : asNumber;
    } else {
      createdMs = Date.parse(trimmed);
    }
  }
  if (!Number.isFinite(createdMs) || createdMs <= 0) return 0;
  return Math.max(0, Math.floor((nowMs - createdMs) / MS_PER_DAY));
}

export async function probeUserSparseDataFromD1(
  userId: string,
  dbOverride?: D1Database | null,
  tenantId?: string,
): Promise<SparseDataGateInput | undefined> {
  const hasAmbientTestDb = Boolean((globalThis as Record<string, unknown>).__D1_DB);
  const isUnconfiguredTestEnv =
    (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') &&
    dbOverride === undefined &&
    !hasAmbientTestDb;
  if (isUnconfiguredTestEnv) {
    return undefined;
  }

  const db = dbOverride !== undefined ? dbOverride : await getD1();
  if (!db) {
    return FAIL_CLOSED_SPARSE_INPUT;
  }

  const effectiveTenantId = tenantId?.trim() || userId;
  try {
    const convRow = await db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM affiliate_conversions WHERE user_id = ?1 AND event_type = 'SALE' AND payout_status IN ('pending_clearance', 'available', 'paid') AND created_at >= datetime('now', '-30 days')",
      )
      .bind(userId)
      .first<{ cnt: number }>();

    const impRes = await db
      .prepare(
        `WITH latest_va AS (
           SELECT video_id, COALESCE(impressions, views, 0) AS reach,
                  ROW_NUMBER() OVER (PARTITION BY video_id, platform ORDER BY date DESC) AS rn
             FROM video_analytics
            WHERE user_id = ?1 OR user_id = ?2
         )
         SELECT COALESCE(SUM(reach), 0) AS impressions
           FROM latest_va
          WHERE rn = 1
          GROUP BY video_id`,
      )
      .bind(userId, effectiveTenantId)
      .all<{ impressions: number }>();

    const userRow = await db
      .prepare('SELECT createdAt FROM "user" WHERE id = ?1 LIMIT 1')
      .bind(userId)
      .first<{ createdAt: string | number | null }>();

    const variantImpressions = (impRes.results ?? []).map((row) =>
      Math.max(0, Math.floor(Number(row.impressions) || 0)),
    );

    return {
      monthlyVerifiedConversions: Math.max(0, Math.floor(Number(convRow?.cnt) || 0)),
      variantImpressions,
      accountAgeDays: parseAccountAgeDays(userRow?.createdAt, Date.now()),
    };
  } catch (err: unknown) {
    logger.warn('Failed to probe D1 sparse-data telemetry; failing closed', {
      userId,
      errorMessage: err instanceof Error ? err.message : 'unknown_d1_error',
    });
    return FAIL_CLOSED_SPARSE_INPUT;
  }
}
