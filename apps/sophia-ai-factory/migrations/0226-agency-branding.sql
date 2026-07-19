CREATE TABLE IF NOT EXISTS agency_branding (
  agency_id INTEGER PRIMARY KEY REFERENCES agency(id) ON DELETE CASCADE,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#8B5CF6',
  logo_url TEXT,
  custom_domain TEXT,
  display_name TEXT DEFAULT 'My Agency',
  tagline_vi TEXT DEFAULT 'Giải pháp AI Video tự động',
  tagline_en TEXT DEFAULT 'AI Video Automation Solution',
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_agency_branding_agency_id ON agency_branding(agency_id);
