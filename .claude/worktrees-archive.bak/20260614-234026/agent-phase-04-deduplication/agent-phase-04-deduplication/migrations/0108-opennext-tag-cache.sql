-- Migration 0108: OpenNext d1NextTagCache table
-- Phase 5 G11 — wire @opennextjs/cloudflare's `d1NextTagCache` adapter so
-- `revalidateTag()` and `revalidatePath()` actually invalidate cached pages
-- instead of being no-ops (prior: `tagCache: "dummy"`).
--
-- Schema source: @opennextjs/cloudflare 1.19.5 d1-next-tag-cache.ts.
-- IMPORTANT: this migration is tightly coupled to the adapter implementation.
-- A package bump to >=1.20 MUST re-verify column shapes before commit.
--
-- Binding name: NEXT_TAG_CACHE_D1 (configured in wrangler.toml; aliased to
-- the existing sophia-raas-db database to avoid a separate D1 instance).
--
-- Indexes: NONE — the `UNIQUE(tag)` constraint creates an implicit index on
-- `tag` (the only field the adapter filters/sorts by per source review).
-- Explicit indexes on `tag` or `revalidatedAt` are write-amplification with
-- zero query benefit.
--
-- Table is initialized empty; OpenNext writes rows on every revalidateTag
-- call. Adapter degrades gracefully (swallows DB errors) if the table is
-- missing — `revalidateTag` simply reverts to no-op behavior.

CREATE TABLE IF NOT EXISTS revalidations (
  tag TEXT NOT NULL,
  revalidatedAt INTEGER NOT NULL,
  stale INTEGER NOT NULL,
  expire INTEGER,
  UNIQUE (tag) ON CONFLICT REPLACE
);
