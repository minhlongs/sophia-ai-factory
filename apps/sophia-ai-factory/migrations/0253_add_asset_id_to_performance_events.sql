-- Migration: 0253_add_asset_id_to_performance_events
-- Adds asset_id column referenced in INSERT but missing from original table.
-- Precedent: 0245_performance_events_columns.sql (same table, same pattern).

ALTER TABLE performance_events ADD COLUMN asset_id TEXT NOT NULL DEFAULT '';
