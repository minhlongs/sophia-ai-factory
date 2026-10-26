-- Migration 0481: AI Video 2026-2027 Model Radar & CEX Market Pulse Cache
-- Supports Unified BYOK Video Router (fal.ai / Replicate / HeyGen) and Dual-Niche CEX/SaaS Engine

CREATE TABLE IF NOT EXISTS ai_video_model_radar (
  model_id TEXT PRIMARY KEY,
  aggregator TEXT NOT NULL CHECK (aggregator IN ('fal-ai', 'replicate', 'heygen', 'elevenlabs')),
  scene_task TEXT NOT NULL CHECK (scene_task IN ('HOOK_CINEMATIC_3S', 'BROLL_TECH_LOOP', 'AVATAR_TALKING_HEAD', 'FFMPEG_COMPOSE')),
  display_name TEXT NOT NULL,
  motion_fidelity REAL NOT NULL DEFAULT 0.90,
  prompt_adherence REAL NOT NULL DEFAULT 0.90,
  avg_latency_sec REAL NOT NULL DEFAULT 25.0,
  cost_per_sec_usd REAL NOT NULL DEFAULT 0.05,
  composite_score REAL NOT NULL DEFAULT 0.85,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_video_model_radar_task_score
  ON ai_video_model_radar(scene_task, is_active, composite_score DESC);

CREATE TABLE IF NOT EXISTS affiliate_market_pulse_cache (
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('binance', 'bybit', 'okx', 'bitget')),
  spot_price_usd REAL NOT NULL,
  change_24h_pct REAL NOT NULL,
  funding_rate_pct REAL NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (symbol, exchange)
);

INSERT OR IGNORE INTO ai_video_model_radar (
  model_id, aggregator, scene_task, display_name,
  motion_fidelity, prompt_adherence, avg_latency_sec, cost_per_sec_usd, composite_score, is_active, updated_at
) VALUES
  ('fal-ai/kling-video/v2.1/master/text-to-video', 'fal-ai', 'HOOK_CINEMATIC_3S', 'Kling 2.1 Master (Fal)', 0.96, 0.95, 22.0, 0.045, 0.942, 1, 1761480000000),
  ('fal-ai/veo3/fast', 'fal-ai', 'HOOK_CINEMATIC_3S', 'Google Veo 3 Fast (Fal)', 0.95, 0.96, 18.0, 0.050, 0.940, 1, 1761480000000),
  ('wan-video/wan-2.2-t2v-14b', 'replicate', 'HOOK_CINEMATIC_3S', 'Wan 2.2 14B (Replicate)', 0.91, 0.90, 28.0, 0.025, 0.895, 1, 1761480000000),
  ('fal-ai/wan-v2.2-a14b/text-to-video', 'fal-ai', 'BROLL_TECH_LOOP', 'Wan 2.2 A14B Loop (Fal)', 0.92, 0.91, 16.0, 0.020, 0.928, 1, 1761480000000),
  ('heygen/avatar-v3-lipsync', 'heygen', 'AVATAR_TALKING_HEAD', 'HeyGen Avatar V3 LipSync', 0.97, 0.98, 24.0, 0.060, 0.955, 1, 1761480000000),
  ('fal-ai/ffmpeg-api/compose', 'fal-ai', 'FFMPEG_COMPOSE', 'Fal Serverless FFmpeg Compose', 1.00, 1.00, 6.0, 0.010, 0.990, 1, 1761480000000),
  ('replicate/ffmpeg-compose', 'replicate', 'FFMPEG_COMPOSE', 'Replicate Serverless FFmpeg', 1.00, 1.00, 9.0, 0.012, 0.965, 1, 1761480000000);
