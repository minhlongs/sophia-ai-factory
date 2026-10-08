-- Migration 0464: Growth Triad v7 Tables
-- Dynamic Sponsorship Valuation, Saliency Re-Framer & Thumbnail Gaze Matrix

CREATE TABLE IF NOT EXISTS sponsorship_rate_cards (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  niche TEXT NOT NULL,
  expected_30d_views INTEGER NOT NULL,
  engagement_rate REAL NOT NULL,
  tier1_audience_pct REAL NOT NULL,
  effective_cpm_usd REAL NOT NULL,
  dedicated_usd REAL NOT NULL,
  midroll_usd REAL NOT NULL,
  preroll_usd REAL NOT NULL,
  pitch_subject TEXT,
  pitch_body TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_channel ON sponsorship_rate_cards(channel_id);
CREATE INDEX IF NOT EXISTS idx_sponsorship_niche ON sponsorship_rate_cards(niche);

CREATE TABLE IF NOT EXISTS reframe_render_jobs (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  source_aspect TEXT NOT NULL DEFAULT '16:9',
  target_aspect TEXT NOT NULL DEFAULT '9:16',
  jitter_score REAL NOT NULL,
  crop_windows_json TEXT NOT NULL,
  kinetic_tokens_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reframe_video ON reframe_render_jobs(video_id);

CREATE TABLE IF NOT EXISTS thumbnail_gaze_analyses (
  id TEXT PRIMARY KEY,
  thumbnail_id TEXT NOT NULL,
  luminance_contrast REAL NOT NULL,
  face_prominence REAL NOT NULL,
  color_saturation REAL NOT NULL,
  rule_of_thirds REAL NOT NULL,
  saliency_score REAL NOT NULL,
  predicted_ctr_pct REAL NOT NULL,
  gaze_grade TEXT NOT NULL,
  recommendations_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thumbnail_gaze_thumb ON thumbnail_gaze_analyses(thumbnail_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_gaze_grade ON thumbnail_gaze_analyses(gaze_grade);
