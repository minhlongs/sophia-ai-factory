-- Migration 0214: SOP installs for Marketplace
--
-- Tracks which users have installed which SOP listings.
-- Each install has a unique license_id for activation tracking.
-- Commission tracking enables creator payout reconciliation.

CREATE TABLE IF NOT EXISTS sop_installs (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  license_id TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL,
  commission_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','uninstalled')),
  installed_at INTEGER NOT NULL,
  uninstalled_at INTEGER,
  FOREIGN KEY (listing_id) REFERENCES sop_listings(id),
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS idx_sop_installs_listing_id ON sop_installs(listing_id);
CREATE INDEX IF NOT EXISTS idx_sop_installs_user_id ON sop_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_sop_installs_license_id ON sop_installs(license_id);
CREATE INDEX IF NOT EXISTS idx_sop_installs_status ON sop_installs(status);
CREATE INDEX IF NOT EXISTS idx_sop_installs_user_status ON sop_installs(user_id, status);

-- Verify
SELECT '0214: OK' AS migration_status FROM sop_installs LIMIT 1;
