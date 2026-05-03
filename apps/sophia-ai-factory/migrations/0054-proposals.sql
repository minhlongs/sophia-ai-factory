-- Proposals enhancements: add mission_id + niche columns
-- proposals table already exists; these are additive ALTER TABLE statements

ALTER TABLE proposals ADD COLUMN mission_id TEXT;
ALTER TABLE proposals ADD COLUMN niche TEXT;

CREATE INDEX IF NOT EXISTS proposals_user_idx ON proposals(user_id, created_at);
