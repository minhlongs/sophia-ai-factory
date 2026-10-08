/**
 * @file dubbing-store.ts
 * @description Cloudflare D1 storage for Multilingual Dubbing Lineages and Viral Sound Catalog
 * @layer tree
 */

import { createServerClient } from '@/seed/db/client';
import type {
  LocalizedLineageRecord,
  ViralSoundTrack,
  SupportedDubLocale,
} from '@/seed/types/viral-expansion-types';

interface DubbingRow {
  id: string;
  user_id: string;
  parent_video_job_id: string;
  locale: string;
  translated_title: string;
  translated_script: string;
  audio_duration_seconds: number;
  pacing_multiplier: number;
  localized_cta_text: string;
  target_affiliate_network: string;
  lip_sync_status: string;
  dubbed_video_url: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToRecord(row: DubbingRow): LocalizedLineageRecord {
  return {
    id: row.id,
    userId: row.user_id,
    parentVideoJobId: row.parent_video_job_id,
    locale: row.locale as SupportedDubLocale,
    translatedTitle: row.translated_title,
    translatedScript: row.translated_script,
    audioDurationSeconds: row.audio_duration_seconds,
    pacingMultiplier: row.pacing_multiplier,
    localizedCtaText: row.localized_cta_text,
    targetAffiliateNetwork: row.target_affiliate_network,
    lipSyncStatus: row.lip_sync_status as LocalizedLineageRecord['lipSyncStatus'],
    dubbedVideoUrl: row.dubbed_video_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
    .all<{
      id: string;
      title: string;
      artist: string;
      bpm: number;
      audio_url: string;
      virality_index: number;
      copyright_tier: string;
      recommended_ducking_db: number;
      platform_tags: string;
    }>();

  return (result.results || []).map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    bpm: row.bpm,
    audioUrl: row.audio_url,
    viralityIndex: row.virality_index,
    copyrightTier: row.copyright_tier as ViralSoundTrack['copyrightTier'],
    recommendedDuckingDb: row.recommended_ducking_db,
    platformTags: JSON.parse(row.platform_tags || '[]'),
  }));
}
