-- Migration: Growth Triad v10 - Core Attribution Ledger

CREATE TABLE IF NOT EXISTS video_analytics (
    id TEXT PRIMARY KEY, /* KSUID */
    video_id TEXT NOT NULL, /* references videos(id) */
    views INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    revenue_generated REAL NOT NULL DEFAULT 0.0,
    metadata TEXT, /* JSON constraints */
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_video_analytics_video_id ON video_analytics(video_id);

CREATE TABLE IF NOT EXISTS attribution_ledger (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    source_platform TEXT NOT NULL, /* e.g., tiktok, youtube */
    conversion_value REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'PENDING', /* PENDING, VERIFIED, REJECTED */
    attributed_at INTEGER NOT NULL,
    metadata TEXT, /* JSON constraints */
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_attribution_ledger_org_id ON attribution_ledger(organization_id);
CREATE INDEX IF NOT EXISTS idx_attribution_ledger_video_id ON attribution_ledger(video_id);
CREATE INDEX IF NOT EXISTS idx_attribution_ledger_status ON attribution_ledger(status);
