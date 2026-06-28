-- SOP Config Schema columns — no-code form support
-- Adds config_schema, config_defaults, setup_time_minutes, is_featured to sop_templates
-- Adds config_values to user_sop_installations
-- Also expands category enum to include 'sales' and 'social' via table recreation

-- Step 1: Add new columns
ALTER TABLE sop_templates ADD COLUMN config_schema TEXT;
ALTER TABLE sop_templates ADD COLUMN config_defaults TEXT;
ALTER TABLE sop_templates ADD COLUMN setup_time_minutes INTEGER NOT NULL DEFAULT 5;
ALTER TABLE sop_templates ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_sop_installations ADD COLUMN config_values TEXT;

-- Step 2: Expand category enum by recreating the table (SQLite cannot ALTER CHECK constraints)
-- Rename old table
ALTER TABLE sop_templates RENAME TO sop_templates_old;

-- Recreate with expanded category list
CREATE TABLE sop_templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('content','leads','email','analytics','proposals','crisis','sales','social')),
  agents_yaml TEXT NOT NULL,
  playbook_md TEXT NOT NULL,
  output_schema TEXT NOT NULL,
  config_schema TEXT,
  config_defaults TEXT,
  setup_time_minutes INTEGER NOT NULL DEFAULT 5,
  is_featured INTEGER NOT NULL DEFAULT 0,
  credits_per_run INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  is_official INTEGER NOT NULL DEFAULT 0,
  author_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Copy data from old table
INSERT INTO sop_templates
  SELECT id, slug, name_vi, name_en, description_vi, description_en,
         category, agents_yaml, playbook_md, output_schema,
         config_schema, config_defaults, setup_time_minutes, is_featured,
         credits_per_run, version, is_official, author_user_id,
         status, created_at, updated_at
  FROM sop_templates_old;

-- Drop old table
DROP TABLE sop_templates_old;

-- Restore indexes
CREATE INDEX IF NOT EXISTS idx_sop_templates_official ON sop_templates(is_official, status);
CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
CREATE INDEX IF NOT EXISTS idx_sop_templates_slug ON sop_templates(slug);
CREATE INDEX IF NOT EXISTS idx_sop_templates_featured ON sop_templates(is_featured, status);
