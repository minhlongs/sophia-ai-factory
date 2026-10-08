-- Migration 0455: Viral Expansion and Multilingual Dubbing Lineages
-- Tracks audio sound pairings and cross-border video dubbing lineages.

CREATE TABLE IF NOT EXISTS viral_sound_catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  bpm INTEGER NOT NULL,
  audio_url TEXT NOT NULL,
  virality_index REAL NOT NULL DEFAULT 80.0,
  copyright_tier TEXT NOT NULL DEFAULT 'ROYALTY_FREE_SAFE',
  recommended_ducking_db REAL NOT NULL DEFAULT -14.0,
  platform_tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS video_dubbing_lineages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_video_job_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  translated_title TEXT NOT NULL,
  translated_script TEXT NOT NULL,
  audio_duration_seconds REAL NOT NULL,
  pacing_multiplier REAL NOT NULL DEFAULT 1.0,
  localized_cta_text TEXT NOT NULL,
  target_affiliate_network TEXT NOT NULL,
  lip_sync_status TEXT NOT NULL DEFAULT 'QUEUED',
  dubbed_video_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dubbing_user_parent
  ON video_dubbing_lineages (user_id, parent_video_job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dubbing_locale_status
  ON video_dubbing_lineages (locale, lip_sync_status);
