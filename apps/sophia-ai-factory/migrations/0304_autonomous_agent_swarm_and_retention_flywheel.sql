-- Migration 0304: Global Autonomous Enterprise Swarm & Self-Healing Edge Daemons
-- Milestone: GATE 8: $1,000,000 MRR (5,000 Paying Customers)
-- Cloudflare D1 SQLite standards: Millisecond Unix timestamps, strict CHECK constraints, and foreign key cascades.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. autonomous_swarm_nodes
-- Edge swarm registration, regional node health, roles, and load telemetry.
-- ============================================================================
CREATE TABLE IF NOT EXISTS autonomous_swarm_nodes (
  id TEXT PRIMARY KEY, -- e.g. 'node_apac_coordinator_01', 'node_us_healer_01'
  node_name TEXT NOT NULL,
  region TEXT NOT NULL CHECK(region IN ('apac', 'us', 'eu', 'global')),
  role TEXT NOT NULL CHECK(role IN ('sales_qualifier', 'retention_flywheel', 'edge_healer', 'coordinator', 'general_worker')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'degraded', 'isolated', 'draining', 'offline')),
  endpoint_url TEXT,
  last_heartbeat_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  cpu_load_pct REAL NOT NULL DEFAULT 0.0 CHECK(cpu_load_pct >= 0.0 AND cpu_load_pct <= 100.0),
  memory_load_pct REAL NOT NULL DEFAULT 0.0 CHECK(memory_load_pct >= 0.0 AND memory_load_pct <= 100.0),
  active_tasks INTEGER NOT NULL DEFAULT 0 CHECK(active_tasks >= 0),
  max_concurrency INTEGER NOT NULL DEFAULT 50 CHECK(max_concurrency > 0),
  is_healthy INTEGER NOT NULL DEFAULT 1 CHECK(is_healthy IN (0, 1)),
  capabilities_json TEXT NOT NULL DEFAULT '[]', -- JSON array of supported capability tags
  metadata_json TEXT NOT NULL DEFAULT '{}',
  registered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_asn_role_status ON autonomous_swarm_nodes(role, status);
CREATE INDEX IF NOT EXISTS idx_asn_region ON autonomous_swarm_nodes(region, status);
CREATE INDEX IF NOT EXISTS idx_asn_heartbeat ON autonomous_swarm_nodes(last_heartbeat_at);

-- ============================================================================
-- 2. customer_health_metrics
-- Real-time customer telemetry, engagement rates, error rates, and churn risk.
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_health_metrics (
  id TEXT PRIMARY KEY, -- e.g. 'chm_usr_12345_202609'
  customer_id TEXT NOT NULL, -- references user.id or organization.id
  org_id TEXT, -- optional enterprise organization reference
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  active_agents_count INTEGER NOT NULL DEFAULT 0 CHECK(active_agents_count >= 0),
  video_generation_count INTEGER NOT NULL DEFAULT 0 CHECK(video_generation_count >= 0),
  api_request_count INTEGER NOT NULL DEFAULT 0 CHECK(api_request_count >= 0),
  api_error_count INTEGER NOT NULL DEFAULT 0 CHECK(api_error_count >= 0),
  api_error_rate REAL NOT NULL DEFAULT 0.0 CHECK(api_error_rate >= 0.0 AND api_error_rate <= 1.0),
  login_frequency_7d INTEGER NOT NULL DEFAULT 0 CHECK(login_frequency_7d >= 0),
  mcu_consumption_rate REAL NOT NULL DEFAULT 0.0,
  nps_score INTEGER CHECK(nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10)),
  churn_risk_score REAL NOT NULL DEFAULT 0.0 CHECK(churn_risk_score >= 0.0 AND churn_risk_score <= 1.0),
  health_tier TEXT NOT NULL DEFAULT 'green' CHECK(health_tier IN ('green', 'yellow', 'red', 'critical')),
  trend_direction TEXT NOT NULL DEFAULT 'stable' CHECK(trend_direction IN ('improving', 'stable', 'declining', 'rapid_drop')),
  risk_factors_json TEXT NOT NULL DEFAULT '[]', -- array of identified risk factors
  last_activity_at INTEGER,
  evaluated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_chm_customer ON customer_health_metrics(customer_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chm_churn_tier ON customer_health_metrics(health_tier, churn_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_chm_evaluated ON customer_health_metrics(evaluated_at);

-- ============================================================================
-- 3. swarm_intervention_events
-- Automated & autonomous interventions triggered to avert customer churn.
-- ============================================================================
CREATE TABLE IF NOT EXISTS swarm_intervention_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  trigger_metric_id TEXT REFERENCES customer_health_metrics(id) ON DELETE SET NULL,
  swarm_node_id TEXT REFERENCES autonomous_swarm_nodes(id) ON DELETE SET NULL,
  intervention_type TEXT NOT NULL CHECK(intervention_type IN (
    'bonus_credits', 'onboarding_guide', 'cs_escalation', 'discount_offer', 'feature_reengagement', 'automated_health_check'
  )),
  status TEXT NOT NULL DEFAULT 'triggered' CHECK(status IN (
    'triggered', 'in_progress', 'applied', 'acknowledged', 'failed', 'rejected'
  )),
  payload_json TEXT NOT NULL DEFAULT '{}', -- action specific payload (e.g. credits amount, guide slug)
  outcome_impact TEXT CHECK(outcome_impact IS NULL OR outcome_impact IN ('churn_prevented', 'no_response', 'upgraded', 'unresolved')),
  churn_risk_before REAL NOT NULL CHECK(churn_risk_before >= 0.0 AND churn_risk_before <= 1.0),
  churn_risk_after REAL CHECK(churn_risk_after IS NULL OR (churn_risk_after >= 0.0 AND churn_risk_after <= 1.0)),
  resolved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_sie_customer ON swarm_intervention_events(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sie_status ON swarm_intervention_events(status, intervention_type);
CREATE INDEX IF NOT EXISTS idx_sie_node ON swarm_intervention_events(swarm_node_id);

-- ============================================================================
-- 4. edge_healing_incidents
-- Self-healing incident journal: circuit trips, reroutes, and node quarantines.
-- ============================================================================
CREATE TABLE IF NOT EXISTS edge_healing_incidents (
  id TEXT PRIMARY KEY,
  incident_code TEXT NOT NULL UNIQUE, -- e.g. 'INC-HEAL-2026-0926-001'
  node_id TEXT NOT NULL REFERENCES autonomous_swarm_nodes(id) ON DELETE CASCADE,
  target_region TEXT NOT NULL CHECK(target_region IN ('apac', 'us', 'eu', 'global')),
  healing_action TEXT NOT NULL CHECK(healing_action IN (
    'circuit_breaker_trip', 'route_reroute', 'degraded_node_isolation', 'daemon_restart', 'capacity_shedding', 'rate_limit_throttle'
  )),
  trigger_reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high', 'critical')),
  previous_state TEXT NOT NULL,
  remediated_state TEXT NOT NULL,
  failover_target_node_id TEXT REFERENCES autonomous_swarm_nodes(id) ON DELETE SET NULL,
  execution_duration_ms INTEGER NOT NULL DEFAULT 0,
  automated_recovery INTEGER NOT NULL DEFAULT 1 CHECK(automated_recovery IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'executed' CHECK(status IN ('investigating', 'executed', 'recovered', 'failed', 'escalated_to_ops')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  recovered_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_ehi_node ON edge_healing_incidents(node_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ehi_action_status ON edge_healing_incidents(healing_action, status);
CREATE INDEX IF NOT EXISTS idx_ehi_detected ON edge_healing_incidents(detected_at DESC);

-- ============================================================================
-- 5. Seed Canonical Baseline Autonomous Swarm Nodes
-- ============================================================================
INSERT OR IGNORE INTO autonomous_swarm_nodes (
  id, node_name, region, role, status, endpoint_url, cpu_load_pct, memory_load_pct, max_concurrency, is_healthy, capabilities_json
) VALUES
(
  'node_apac_coordinator_01',
  'APAC Primary Swarm Coordinator',
  'apac',
  'coordinator',
  'active',
  'https://apac-swarm.sophia.agencyos.network',
  12.5,
  28.0,
  100,
  1,
  '["coordination", "task_dispatch", "cluster_topology", "leader_election"]'
),
(
  'node_apac_sales_01',
  'APAC Autonomous Sales Qualifier Bot',
  'apac',
  'sales_qualifier',
  'active',
  'https://apac-sales.sophia.agencyos.network',
  15.0,
  35.2,
  50,
  1,
  '["bant_scoring", "deal_qualification", "demo_provisioning", "outreach_generation"]'
),
(
  'node_apac_flywheel_01',
  'APAC Customer Retention Flywheel Daemon',
  'apac',
  'retention_flywheel',
  'active',
  'https://apac-flywheel.sophia.agencyos.network',
  20.1,
  42.5,
  80,
  1,
  '["churn_scoring", "health_metrics", "credit_injection", "onboarding_dispatch"]'
),
(
  'node_apac_healer_01',
  'APAC Edge Self-Healing Arbiter',
  'apac',
  'edge_healer',
  'active',
  'https://apac-healer.sophia.agencyos.network',
  8.4,
  22.1,
  60,
  1,
  '["circuit_breaker", "dynamic_reroute", "node_isolation", "telemetry_probe"]'
),
(
  'node_us_sales_01',
  'US Autonomous Sales Qualifier Bot',
  'us',
  'sales_qualifier',
  'active',
  'https://us-sales.sophia.agencyos.network',
  14.2,
  32.0,
  50,
  1,
  '["bant_scoring", "deal_qualification", "demo_provisioning"]'
),
(
  'node_us_healer_01',
  'US Edge Self-Healing Arbiter',
  'us',
  'edge_healer',
  'active',
  'https://us-healer.sophia.agencyos.network',
  9.0,
  24.5,
  60,
  1,
  '["circuit_breaker", "dynamic_reroute", "node_isolation"]'
),
(
  'node_eu_healer_01',
  'EU Edge Self-Healing Arbiter',
  'eu',
  'edge_healer',
  'active',
  'https://eu-healer.sophia.agencyos.network',
  10.2,
  25.0,
  60,
  1,
  '["circuit_breaker", "dynamic_reroute", "node_isolation"]'
);
