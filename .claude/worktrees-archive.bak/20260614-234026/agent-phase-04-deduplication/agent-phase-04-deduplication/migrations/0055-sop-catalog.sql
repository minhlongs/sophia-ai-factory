-- SOP Templates Catalog
-- Standard Operating Procedures marketplace: official playbooks + community-published templates

CREATE TABLE IF NOT EXISTS sop_templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('content','leads','email','analytics','proposals','crisis')),
  agents_yaml TEXT NOT NULL,
  playbook_md TEXT NOT NULL,
  output_schema TEXT NOT NULL,
  credits_per_run INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  is_official INTEGER NOT NULL DEFAULT 0,
  author_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sop_templates_official ON sop_templates(is_official, status);
CREATE INDEX IF NOT EXISTS idx_sop_templates_category ON sop_templates(category);
CREATE INDEX IF NOT EXISTS idx_sop_templates_slug ON sop_templates(slug);
