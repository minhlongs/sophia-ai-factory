-- Migration: voices table for XTTS v2 voice cloning
-- Phase 07: Voice + TTS Service

CREATE TABLE IF NOT EXISTS voices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  ref_audio_r2_key TEXT NOT NULL,
  consent_given_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voices_tenant_created ON voices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voices_tenant_user ON voices(tenant_id, user_id);
