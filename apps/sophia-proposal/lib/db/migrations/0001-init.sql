-- Sophia RaaS D1 Schema Migration
-- Replaces Supabase PostgreSQL with Cloudflare D1 (SQLite)

-- Users & Auth
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  email_verified INTEGER DEFAULT 0,
  magic_link_token TEXT,
  magic_link_expires_at TEXT,
  last_sign_in_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  plan TEXT DEFAULT 'free',
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(org_id, user_id)
);

-- Billing & Balance
CREATE TABLE IF NOT EXISTS org_balances (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT UNIQUE NOT NULL REFERENCES organizations(id),
  balance REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  polar_subscription_id TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_settings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT UNIQUE NOT NULL REFERENCES organizations(id),
  billing_email TEXT,
  tax_id TEXT,
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Missions (OpenClaw PEV Engine)
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  command TEXT NOT NULL,
  params TEXT DEFAULT '{}',
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'queued',
  result TEXT,
  error_message TEXT,
  mcu_cost REAL DEFAULT 0,
  mcu_reserved REAL DEFAULT 0,
  webhook_url TEXT,
  parent_mission_id TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mission_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  command TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  mcu_cost REAL DEFAULT 0,
  params_schema TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mission_dependencies (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mission_id TEXT NOT NULL REFERENCES missions(id),
  depends_on_mission_id TEXT NOT NULL REFERENCES missions(id),
  dependency_type TEXT DEFAULT 'sequential',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mission_retries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mission_id TEXT NOT NULL REFERENCES missions(id),
  attempt_number INTEGER NOT NULL,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  scheduled_for TEXT NOT NULL,
  executed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- RaaS API
CREATE TABLE IF NOT EXISTS raas_api_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions TEXT DEFAULT '["missions:create","missions:read"]',
  rate_limit_per_minute INTEGER DEFAULT 60,
  is_active INTEGER DEFAULT 1,
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS raas_api_usage (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  api_key_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  mcu_consumed REAL DEFAULT 0,
  response_time_ms INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS raas_webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mission_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  payload TEXT,
  status_code INTEGER,
  attempt_number INTEGER DEFAULT 1,
  delivered_at TEXT,
  next_retry_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Proposals & Video
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'draft',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- CRM
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT,
  name TEXT,
  company TEXT,
  phone TEXT,
  source TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  contact_id TEXT REFERENCES contacts(id),
  title TEXT NOT NULL,
  value REAL DEFAULT 0,
  stage TEXT DEFAULT 'lead',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crm_settings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT UNIQUE NOT NULL REFERENCES organizations(id),
  hubspot_access_token TEXT,
  hubspot_refresh_token TEXT,
  sync_enabled INTEGER DEFAULT 0,
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crm_sync_status (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  last_synced_at TEXT,
  status TEXT DEFAULT 'idle',
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Onboarding
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  user_id TEXT,
  step TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  data TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onboarding_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onboarding_milestones (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  milestone TEXT NOT NULL,
  achieved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS onboarding_calls (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  scheduled_at TEXT,
  completed_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pilot_onboarding (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  stage TEXT DEFAULT 'intake',
  checklist TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Referral & Affiliate
CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  user_id TEXT,
  code TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  max_uses INTEGER,
  reward_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referral_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  referral_code_id TEXT NOT NULL,
  referred_org_id TEXT,
  event_type TEXT NOT NULL,
  amount REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliate_programs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  commission_rate REAL,
  status TEXT DEFAULT 'active',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliate_content (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  program_id TEXT REFERENCES affiliate_programs(id),
  title TEXT,
  content TEXT,
  type TEXT DEFAULT 'post',
  status TEXT DEFAULT 'draft',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  program_id TEXT,
  content_id TEXT,
  url TEXT,
  referrer TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  program_id TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Feedback & Surveys
CREATE TABLE IF NOT EXISTS customer_feedback (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  user_id TEXT,
  type TEXT DEFAULT 'general',
  rating INTEGER,
  message TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  scheduled_for TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_missions_org_id ON missions(org_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_created_at ON missions(created_at);
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_key_hash ON raas_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_org_id ON raas_api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_raas_api_usage_api_key_id ON raas_api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org_id ON transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_org_id ON usage_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org_id ON proposals(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_org_id ON affiliate_clicks(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
