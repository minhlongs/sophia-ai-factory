-- Migration 0080: Add quality scoring columns to discovered_affiliates
-- score: composite 0..1 quality score (NULL = not yet scored)
-- score_breakdown: JSON object with per-component scores

ALTER TABLE discovered_affiliates ADD COLUMN score REAL;
ALTER TABLE discovered_affiliates ADD COLUMN score_breakdown TEXT;

CREATE INDEX IF NOT EXISTS idx_aff_score ON discovered_affiliates(score DESC) WHERE score IS NOT NULL;
