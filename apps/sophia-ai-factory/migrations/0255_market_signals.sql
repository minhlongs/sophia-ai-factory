-- Migration: 0255_market_signals
-- Phase 2: Creative Intelligence — market signal ingestion storage.
-- Mirrors the canonical MarketSignal domain type
-- (src/seed/types/creative-domain.ts). Fully additive.

CREATE TABLE IF NOT EXISTS market_signals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trend', 'competitor', 'audience', 'search', 'content', 'market')),
  source TEXT NOT NULL,             -- provider name (youtube, google-trends-rss, ...)
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',  -- JSON payload
  confidence REAL NOT NULL DEFAULT 0,        -- 0..1
  relevance_score REAL NOT NULL DEFAULT 0,   -- 0..1
  expires_at INTEGER,               -- ms epoch, NULL = never expires
  consumed INTEGER NOT NULL DEFAULT 0,       -- 0 = fresh, 1 = consumed by trend detector
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_market_signals_workspace_type
  ON market_signals(workspace_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_signals_consumed
  ON market_signals(consumed, expires_at);
