-- Migration 0437: Autonomous AGI Loop Control & Heartbeat Scheduler
-- Supports 24/7 CHÚA CHÙM Swarm, Deterministic FSM, Task Queue, DLQ, and Telemetry

-- 1. Autonomous Engine Singleton State
CREATE TABLE IF NOT EXISTS autonomous_loop_state (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  state TEXT NOT NULL DEFAULT 'IDLE' CHECK (state IN ('IDLE', 'RUNNING', 'PAUSED', 'RECOVERING', 'CIRCUIT_BROKEN')),
  current_cycle_id TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  consciousness_score INTEGER NOT NULL DEFAULT 100,
  daily_mcu_consumed REAL NOT NULL DEFAULT 0.0,
  monthly_mcu_consumed REAL NOT NULL DEFAULT 0.0,
  daily_spend_cents INTEGER NOT NULL DEFAULT 0,
  monthly_spend_cents INTEGER NOT NULL DEFAULT 0,
  last_heartbeat_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_autonomous_state_tenant
ON autonomous_loop_state (tenant_id, state);

-- Seed initial singleton state
INSERT OR IGNORE INTO autonomous_loop_state (
  id, tenant_id, state, current_cycle_id, consecutive_failures, last_error,
  consciousness_score, daily_mcu_consumed, monthly_mcu_consumed,
  daily_spend_cents, monthly_spend_cents, last_heartbeat_at, version, created_at, updated_at
) VALUES (
  'singleton_default', 'default', 'IDLE', NULL, 0, NULL,
  100, 0.0, 0.0, 0, 0, strftime('%s', 'now'), 1, strftime('%s', 'now'), strftime('%s', 'now')
);

-- 2. Autonomous Scheduled Tasks
CREATE TABLE IF NOT EXISTS autonomous_schedule_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  skill_name TEXT NOT NULL UNIQUE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'interval', 'event_driven')),
  schedule_expression TEXT,
  interval_seconds INTEGER,
  event_trigger TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  tier_requirement TEXT NOT NULL DEFAULT 'BASIC' CHECK (tier_requirement IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
  priority INTEGER NOT NULL DEFAULT 3,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER,
  run_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  lock_token TEXT,
  locked_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_autonomous_schedule_due 
ON autonomous_schedule_tasks (enabled, next_run_at, priority);

CREATE INDEX IF NOT EXISTS idx_autonomous_schedule_tenant
ON autonomous_schedule_tasks (tenant_id, enabled, next_run_at);

-- Seed 3 Core CHÚA CHÙM Skills from openclaw.json & HEARTBEAT.md
INSERT OR IGNORE INTO autonomous_schedule_tasks (
  id, tenant_id, skill_name, schedule_type, schedule_expression, interval_seconds,
  event_trigger, timezone, tier_requirement, priority, enabled,
  last_run_at, next_run_at, run_count, failure_count, created_at, updated_at
) VALUES 
  ('task_affiliate_scout', 'default', 'affiliate-scout', 'interval', NULL, 14400, NULL, 'UTC', 'PREMIUM', 3, 1, NULL, strftime('%s', 'now'), 0, 0, strftime('%s', 'now'), strftime('%s', 'now')),
  ('task_content_producer', 'default', 'content-producer', 'cron', '0 6 * * *', NULL, NULL, 'UTC', 'PREMIUM', 2, 1, NULL, strftime('%s', 'now'), 0, 0, strftime('%s', 'now'), strftime('%s', 'now')),
  ('task_auto_publisher', 'default', 'auto-publisher', 'event_driven', NULL, 300, 'video_ready', 'UTC', 'ENTERPRISE', 1, 1, NULL, strftime('%s', 'now'), 0, 0, strftime('%s', 'now'), strftime('%s', 'now'));

-- 3. Dead-Letter Task Queue (DLQ)
CREATE TABLE IF NOT EXISTS autonomous_dead_letter_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  task_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'dead' CHECK (status IN ('dead', 'retrying', 'resolved', 'purged')),
  first_failed_at INTEGER NOT NULL,
  last_failed_at INTEGER NOT NULL,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_autonomous_dlq_status
ON autonomous_dead_letter_queue (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autonomous_dlq_tenant
ON autonomous_dead_letter_queue (tenant_id, status, created_at DESC);

-- 4. Autonomous Cycle Audit & Telemetry Runs
CREATE TABLE IF NOT EXISTS autonomous_cycle_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  trigger_type TEXT NOT NULL,
  state_before TEXT NOT NULL,
  state_after TEXT NOT NULL,
  tasks_attempted INTEGER NOT NULL DEFAULT 0,
  tasks_succeeded INTEGER NOT NULL DEFAULT 0,
  tasks_failed INTEGER NOT NULL DEFAULT 0,
  mcu_consumed REAL NOT NULL DEFAULT 0.0,
  tokens_consumed INTEGER NOT NULL DEFAULT 0,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  consciousness_score INTEGER NOT NULL DEFAULT 100,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_autonomous_cycle_runs_created
ON autonomous_cycle_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autonomous_cycle_runs_tenant
ON autonomous_cycle_runs (tenant_id, created_at DESC);
