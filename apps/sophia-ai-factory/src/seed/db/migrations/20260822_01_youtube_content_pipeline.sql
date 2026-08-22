-- Migration 20260822_01: YouTube Content Pipeline
-- Phase 2: Pipeline Integration — autonomous YouTube content pipeline schema.
-- Tables: channel configs, content calendar, generated strategies/scripts/SEO,
-- learning snapshots + recommendations.

-- ---------------------------------------------------------------------------
-- 1. youtube_channel_configs — per-channel objective/audience/pillars/cadence
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youtube_channel_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL,
  content_pillars TEXT NOT NULL,
  cadence TEXT NOT NULL,
  posts_per_week INTEGER NOT NULL DEFAULT 3,
  guardrails TEXT,
  content_buffer_days INTEGER NOT NULL DEFAULT 3,
  autonomy_level INTEGER NOT NULL DEFAULT 2,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_ycc_user ON youtube_channel_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_ycc_channel ON youtube_channel_configs(channel_id);
CREATE INDEX IF NOT EXISTS idx_ycc_active ON youtube_channel_configs(is_active);

-- ---------------------------------------------------------------------------
-- 2. youtube_content_calendar — scheduled content slots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youtube_content_calendar (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  channel_config_id TEXT,
  title TEXT NOT NULL,
  topic TEXT,
  content_type TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_at TEXT NOT NULL,
  strategy_id TEXT,
  script_id TEXT,
  seo_id TEXT,
  production_id TEXT,
  published_video_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ycc_cal_user ON youtube_content_calendar(user_id);
CREATE INDEX IF NOT EXISTS idx_ycc_cal_status ON youtube_content_calendar(status);
CREATE INDEX IF NOT EXISTS idx_ycc_cal_scheduled ON youtube_content_calendar(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ycc_cal_strategy ON youtube_content_calendar(strategy_id);
CREATE INDEX IF NOT EXISTS idx_ycc_cal_script ON youtube_content_calendar(script_id);

-- ---------------------------------------------------------------------------
-- 3. youtube_content_strategies — generated strategies per channel
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youtube_content_strategies (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  channel_config_id TEXT,
  topic TEXT NOT NULL,
  angle TEXT,
  target_audience TEXT,
  content_type TEXT,
  keywords TEXT,
  estimated_views INTEGER DEFAULT 0,
  best_publish_time TEXT,
  competitor_analysis TEXT,
  source TEXT NOT NULL DEFAULT 'template',
  status TEXT NOT NULL DEFAULT 'generated',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ycc_strat_user ON youtube_content_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_ycc_strat_channel ON youtube_content_strategies(channel_config_id);

-- ---------------------------------------------------------------------------
-- 4. youtube_scripts — generated scripts per video
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youtube_scripts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  strategy_id TEXT,
  title TEXT NOT NULL,
  full_script TEXT,
  hook TEXT,
  introduction TEXT,
  main_content TEXT,
  conclusion TEXT,
  call_to_action TEXT,
  duration TEXT,
  tone TEXT,
  pacing TEXT,
  keywords TEXT,
  claims TEXT,
  status TEXT NOT NULL DEFAULT 'generated',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ycc_script_user ON youtube_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_ycc_script_strategy ON youtube_scripts(strategy_id);

-- ---------------------------------------------------------------------------
-- 5. youtube_seo_data — SEO metadata per video
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youtube_seo_data (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  script_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  hashtags TEXT,
  chapters TEXT,
  seo_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generated',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ycc_seo_user ON youtube_seo_data(user_id);
CREATE INDEX IF NOT EXISTS idx_ycc_seo_script ON youtube_seo_data(script_id);

-- ---------------------------------------------------------------------------
-- 6. youtube_learning_snapshots — per-video performance captures
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youtube_learning_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  production_id TEXT,
  measurement_window TEXT NOT NULL,
  published_at TEXT,
  metrics TEXT NOT NULL,
  content_attributes TEXT,
  baseline TEXT,
  deltas TEXT,
  confidence TEXT DEFAULT 'low',
  simulated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(video_id, measurement_window)
);

CREATE INDEX IF NOT EXISTS idx_ycc_snap_user ON youtube_learning_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_ycc_snap_video ON youtube_learning_snapshots(video_id);
CREATE INDEX IF NOT EXISTS idx_ycc_snap_window ON youtube_learning_snapshots(measurement_window);

-- ---------------------------------------------------------------------------
-- 7. youtube_learning_recommendations — pending/approved/rejected learnings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youtube_learning_recommendations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT,
  evidence TEXT,
  proposed_change TEXT,
  confidence TEXT DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TEXT,
  rejected_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ycc_rec_user ON youtube_learning_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ycc_rec_status ON youtube_learning_recommendations(status);

-- ---------------------------------------------------------------------------
-- 8. youtube_pipeline_checkpoints — per-stage recovery checkpoints for the
--    autonomous content pipeline (strategy/script/seo/thumbnail/quality_review).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS youtube_pipeline_checkpoints (
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  artifact TEXT,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  attempt INTEGER,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (job_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_ycc_chk_job ON youtube_pipeline_checkpoints(job_id);
CREATE INDEX IF NOT EXISTS idx_ycc_chk_stage ON youtube_pipeline_checkpoints(stage);