-- 0120-campaigns-org-id-enforce-not-null.sql
-- C-6 (safe variant): Enforce campaigns.org_id NOT NULL via trigger-based CHECK.
--
-- Pre-flight verified 2026-05-22: 30/30 rows have org_id populated (0 NULL).
-- Table-rebuild ALTER would re-write the entire table; trigger-based enforcement
-- gives the same invariant guarantee with zero downtime and no FK risk.
--
-- Strategy:
--   1. AFTER INSERT trigger from 0119 already auto-populates org_id from org_members.
--   2. This migration adds a BEFORE UPDATE trigger to reject NULL writes.
--   3. Also adds a deferred AFTER INSERT validator (post auto-populate) — if the
--      org_members lookup fails (user with zero memberships, theoretically impossible
--      under current invariants), the row is rolled back via RAISE(ABORT).

CREATE TRIGGER IF NOT EXISTS trg_campaigns_reject_null_org_update
BEFORE UPDATE OF org_id ON campaigns
WHEN NEW.org_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'campaigns.org_id cannot be NULL');
END;

CREATE TRIGGER IF NOT EXISTS trg_campaigns_assert_org_after_insert
AFTER INSERT ON campaigns
WHEN (SELECT org_id FROM campaigns WHERE id = NEW.id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'campaigns.org_id failed to auto-populate (user has no org_members row)');
END;
