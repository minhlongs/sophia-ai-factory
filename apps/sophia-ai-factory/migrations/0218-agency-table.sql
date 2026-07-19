CREATE TABLE agency (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'starter' CHECK(tier IN ('starter','growth','enterprise')),
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT,
  owner_user_id INTEGER NOT NULL,
  billing_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','cancelled')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_agency_slug ON agency(slug);
CREATE INDEX idx_agency_owner ON agency(owner_user_id);
