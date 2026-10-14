/**
 * Database storage helper for trend detection records.
 */

import { createServerClient } from '@/seed/db/client';
import type { TrendDetectionRecord } from './detect-types';

export async function insertDetection(record: TrendDetectionRecord): Promise<number> {
  const db = createServerClient().unwrap();
  const { meta } = await db
    .prepare(
      `INSERT OR REPLACE INTO trend_detections
       (id, workspace_id, topic, channel, momentum, forecast, evidence_ids, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.workspaceId,
      record.topic,
      record.channel,
      record.momentum,
      JSON.stringify(record.forecast),
      JSON.stringify(record.evidenceIds),
      record.detectedAt,
    )
    .run();
  return meta?.changes ?? 0;
}
