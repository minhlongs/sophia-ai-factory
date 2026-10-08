-- Migration: 0466_growth_triad_v9
-- Description: Base schema for Growth Triad v9

CREATE TABLE IF NOT EXISTS growth_yield_routers (
    router_id TEXT PRIMARY KEY,
    health_status TEXT NOT NULL,
    active_nodes INTEGER NOT NULL DEFAULT 0,
    latency_ms REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS shadowban_telemetry (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    metadata_entropy REAL NOT NULL,
    post_timing_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS culture_index_scores (
    script_id TEXT PRIMARY KEY,
    regional_target TEXT NOT NULL,
    score REAL NOT NULL,
    culture_match TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
