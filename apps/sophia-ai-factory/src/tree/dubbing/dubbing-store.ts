/**
 * @file dubbing-store.ts
 * @description Cloudflare D1 storage for Multilingual Dubbing Lineages and Viral Sound Catalog
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import type {
  LocalizedLineageRecord,
  ViralSoundTrack,
} from '@/seed/types/viral-expansion-types';
import {
  type DubbingRow,
  type ViralSoundRow,
  mapRowToRecord,
  mapSoundRowToTrack,
} from './dubbing-row-mappers';

export async function insertDubbingLineage(
  record: Omit<LocalizedLineageRecord, 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const db = createServerClient();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO video_dubbing_lineages (
        id, user_id, parent_video_job_id, locale, translated_title,
        translated_script, audio_duration_seconds, pacing_multiplier,
        localized_cta_text, target_affiliate_network, lip_sync_status,
        dubbed_video_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      record.id,
      record.userId,
      record.parentVideoJobId,
      record.locale,
      record.translatedTitle,
      record.translatedScript,
      record.audioDurationSeconds,
      record.pacingMultiplier,
      record.localizedCtaText,
      record.targetAffiliateNetwork,
      record.lipSyncStatus,
      record.dubbedVideoUrl || null,
      now,
      now
    )
    .run();
}

export async function listUserDubbingLineages(
  userId: string,
  limit: number = 50,
): Promise<LocalizedLineageRecord[]> {
  const db = createServerClient();
  const result = await db
    .prepare(
      `SELECT * FROM video_dubbing_lineages
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(userId, limit)
    .all<DubbingRow>();

  return (result.results || []).map(mapRowToRecord);
}

export async function listViralSounds(limit: number = 20): Promise<ViralSoundTrack[]> {
  const db = createServerClient();
  const result = await db
    .prepare(
      `SELECT * FROM viral_sound_catalog
       ORDER BY virality_index DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<ViralSoundRow>();

  return (result.results || []).map(mapSoundRowToTrack);
}
