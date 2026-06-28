-- Brand Kits: per-user video branding assets (logo watermark, intro/outro, colors)
CREATE TABLE IF NOT EXISTS brand_kits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  logo_r2_key TEXT,
  intro_r2_key TEXT,
  outro_r2_key TEXT,
  font_r2_key TEXT,
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#FFFFFF',
  logo_position TEXT DEFAULT 'bottom-right',
  logo_opacity REAL DEFAULT 0.8,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_kits_user_id ON brand_kits(user_id);
