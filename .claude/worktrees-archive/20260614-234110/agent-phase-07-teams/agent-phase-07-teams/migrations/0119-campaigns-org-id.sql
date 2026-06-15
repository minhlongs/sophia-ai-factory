-- 0119-campaigns-org-id.sql
-- V-1.3: Add org_id to campaigns for multi-tenant scoping.
-- Strategy: nullable column + trigger auto-populates from org_members on INSERT.
-- Existing 30 rows backfilled via org_members (all users confirmed to have org membership).

-- Step 1: Add column (nullable; trigger fills it, never blocks insert)
ALTER TABLE campaigns ADD COLUMN org_id TEXT;

-- Step 2: Backfill existing rows from org_members
UPDATE campaigns
SET org_id = (
  SELECT om.org_id
  FROM org_members om
  WHERE om.user_id = campaigns.user_id
  ORDER BY om.created_at ASC
  LIMIT 1
)
WHERE org_id IS NULL;

-- Step 3: Index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_campaigns_org_created
  ON campaigns(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_org_user
  ON campaigns(org_id, user_id);

-- Step 4: Trigger to auto-populate org_id on new INSERTs.
-- AFTER INSERT + WHEN NEW.org_id IS NULL → only fires when caller didn't supply org_id.
CREATE TRIGGER IF NOT EXISTS trg_campaigns_set_org_id
AFTER INSERT ON campaigns
WHEN NEW.org_id IS NULL
BEGIN
  UPDATE campaigns
  SET org_id = (
    SELECT om.org_id
    FROM org_members om
    WHERE om.user_id = NEW.user_id
    ORDER BY om.created_at ASC
    LIMIT 1
  )
  WHERE id = NEW.id;
END;
