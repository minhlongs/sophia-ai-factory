-- Migration: 0245_performance_events_columns
-- Adds columns referenced in INSERT but missing from original table

ALTER TABLE performance_events ADD COLUMN count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE performance_events ADD COLUMN value_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE performance_events ADD COLUMN raw_data TEXT;