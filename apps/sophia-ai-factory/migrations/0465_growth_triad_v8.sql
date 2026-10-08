-- Migration 0465: Growth Triad v8 D1 Schema
-- Tables for Audio Resonance Jobs, Community Bait Campaigns, and Subscriber Cohort LTV Snapshots

CREATE TABLE IF NOT EXISTS audio_resonance_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  audio_track_id TEXT NOT NULL,
  bpm REAL NOT NULL,
  resonance_score REAL NOT NULL,
  sync_quality TEXT NOT NULL,
  quantized_cuts_json TEXT NOT NULL,
  ducking_markers_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audio_resonance_user ON audio_resonance_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_resonance_track ON audio_resonance_jobs(audio_track_id);

CREATE TABLE IF NOT EXISTS community_bait_campaigns (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_topic TEXT NOT NULL,
  primary_hook_question TEXT NOT NULL,
  curiosity_gap_score REAL NOT NULL,
  estimated_velocity REAL NOT NULL,
  brand_safety_passed INTEGER NOT NULL DEFAULT 1,
  alternative_hooks_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_community_bait_user ON community_bait_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_community_bait_video ON community_bait_campaigns(video_id);

CREATE TABLE IF NOT EXISTS subscriber_cohort_ltv_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  cohort_month TEXT NOT NULL,
  initial_subscribers INTEGER NOT NULL,
  cumulative_ltv_usd REAL NOT NULL,
  hazard_peak_month INTEGER NOT NULL,
  recommended_action TEXT NOT NULL,
  survival_curve_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriber_cohort_user ON subscriber_cohort_ltv_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_cohort_month ON subscriber_cohort_ltv_snapshots(cohort_month);
