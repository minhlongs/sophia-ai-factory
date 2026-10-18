/**
 * @file dubbing-row-mappers.ts
 * @description Row interfaces and mappers for Multilingual Dubbing Lineages and Viral Sound Catalog
 * @layer tree
 */

import type {
  LocalizedLineageRecord,
  ViralSoundTrack,
  SupportedDubLocale,
} from '@/seed/types/viral-expansion-types';

export interface DubbingRow {
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

export interface ViralSoundRow {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  audio_url: string;
  virality_index: number;
  copyright_tier: string;
  recommended_ducking_db: number;
  platform_tags: string;
}

export function mapRowToRecord(row: DubbingRow): LocalizedLineageRecord {
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

export function mapSoundRowToTrack(row: ViralSoundRow): ViralSoundTrack {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    bpm: row.bpm,
    audioUrl: row.audio_url,
    viralityIndex: row.virality_index,
    copyrightTier: row.copyright_tier as ViralSoundTrack['copyrightTier'],
    recommendedDuckingDb: row.recommended_ducking_db,
    platformTags: JSON.parse(row.platform_tags || '[]'),
  };
}
