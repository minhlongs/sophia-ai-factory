CREATE TABLE sub_tenant (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER,
  owner_user_id INTEGER NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_subtenant_agency ON sub_tenant(agency_id);
CREATE INDEX idx_subtenant_owner ON sub_tenant(owner_user_id);
