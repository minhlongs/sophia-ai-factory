-- Sophia AI Factory D1 Schema Migration
-- Replaces Supabase PostgreSQL with Cloudflare D1 (SQLite)
-- DB binding: sophia-raas-db

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_missions_org_id ON missions(org_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_created_at ON missions(created_at);
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_key_hash ON raas_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_org_id ON raas_api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_raas_api_usage_api_key_id ON raas_api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org_id ON transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_org_id ON usage_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
