-- Align campaign_checkpoints columns with code expectations
-- Code uses: step, completed_at, metadata
-- D1 has: step_name, created_at, payload
ALTER TABLE campaign_checkpoints RENAME COLUMN step_name TO step;
ALTER TABLE campaign_checkpoints RENAME COLUMN payload TO metadata;
ALTER TABLE campaign_checkpoints RENAME COLUMN created_at TO completed_at;
