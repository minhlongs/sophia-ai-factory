-- Agent Factory schema
-- Phase 01: Seed — CEO + Developer agent infrastructure
-- Tables: agent_teams, agents, agent_tasks, agent_logs

CREATE TABLE IF NOT EXISTS agent_teams (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT UNIQUE NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL DEFAULT 'My AI Company',
  config TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  team_id TEXT NOT NULL REFERENCES agent_teams(id),
  role TEXT NOT NULL CHECK (role IN ('CEO','Developer')),
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'openai/gpt-4o-mini',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agents_team ON agents(team_id);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id),
  agent_id TEXT NOT NULL REFERENCES agents(id),
  input TEXT NOT NULL,
  output TEXT,
  status TEXT DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed')),
  error_message TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_org_status ON agent_tasks(org_id, status);

CREATE TABLE IF NOT EXISTS agent_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  task_id TEXT NOT NULL REFERENCES agent_tasks(id),
  action TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_logs_task ON agent_logs(task_id);
