-- Migration 0468: Growth Triad v11 D1 Schema
-- Tables for Cross-Platform Arbitrage Decision Logs and Opportunistic Compute Jobs

CREATE TABLE IF NOT EXISTS growth_v11_arbitrage_logs (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL UNIQUE,
    video_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    primary_platform TEXT NOT NULL,
    syndication_platforms_json TEXT NOT NULL,
    scores_json TEXT NOT NULL,
    hook_mutations_json TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v11_arbitrage_video_id ON growth_v11_arbitrage_logs(video_id);
CREATE INDEX IF NOT EXISTS idx_v11_arbitrage_user_id ON growth_v11_arbitrage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_v11_arbitrage_status ON growth_v11_arbitrage_logs(status);
CREATE INDEX IF NOT EXISTS idx_v11_arbitrage_decision_id ON growth_v11_arbitrage_logs(decision_id);

CREATE TABLE IF NOT EXISTS growth_v11_compute_jobs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL UNIQUE,
    video_id TEXT NOT NULL,
    user_tier TEXT NOT NULL,
    velocity_score REAL NOT NULL,
    priority TEXT NOT NULL,
    target_model_tier TEXT NOT NULL,
    earliest_execution_sec INTEGER NOT NULL,
    latest_execution_sec INTEGER NOT NULL,
    is_off_peak INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd REAL NOT NULL,
    estimated_savings_usd REAL NOT NULL,
    discount_ratio REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v11_compute_job_id ON growth_v11_compute_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_v11_compute_video_id ON growth_v11_compute_jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_v11_compute_status ON growth_v11_compute_jobs(status);
CREATE INDEX IF NOT EXISTS idx_v11_compute_priority ON growth_v11_compute_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_v11_compute_execution_window ON growth_v11_compute_jobs(earliest_execution_sec, latest_execution_sec);
