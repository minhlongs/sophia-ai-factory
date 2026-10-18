/**
 * Land Layer: Growth Triad v13 Shapley Touchpoint D1 Writer
 * Persists attributed Shapley touchpoints into D1 idempotently.
 * Layer: land/growth-v13 | Max LOC: < 135 | Zero :any
 * @module land/growth-v13/shapley-touchpoint-writer
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { TouchpointRecord } from '@/seed/types/growth-triad-v13';

export async function insertShapleyTouchpoint(
  userId: string,
  conversionId: string,
  touchpoint: TouchpointRecord,
  order: number,
  shapleyWeight: number,
  attributedRevenueUsd: number
): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for insertShapleyTouchpoint');
    return false;
  }
  const now = Date.now();
  const id = `shapley_${conversionId}_${order}`;

  try {
    const res = await db
      .prepare(
        `INSERT INTO growth_shapley_touchpoints (
          id, user_id, conversion_id, video_manifest_id, channel_id,
          platform, touchpoint_order, shapley_weight, attributed_revenue_usd,
          mcu_cost_usd, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .bind(
        id,
        userId,
        conversionId,
        touchpoint.videoManifestId,
        touchpoint.channelId,
        touchpoint.platform,
        order,
        shapleyWeight,
        attributedRevenueUsd,
        touchpoint.mcuCostUsd,
        now
      )
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('Failed to insert Shapley touchpoint', { conversionId, error: err });
    return false;
  }
}
