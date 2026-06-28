CREATE TABLE IF NOT EXISTS thumbnail_variants (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  video_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  strategy TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  is_selected INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS marketplace_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  creator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  template_config TEXT NOT NULL,
  preview_r2_key TEXT,
  price_cents INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  rating REAL DEFAULT 0.0,
  rating_count INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);
