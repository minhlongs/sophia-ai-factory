-- SLO Burn Rate Tracking Table
-- Stores monthly burn-rate calculations for each SLO
-- Run: npx wrangler d1 execute sophia-raas-db --file=src/seed/db/migrations/0039_slo_burn.sql --remote

CREATE TABLE IF NOT EXISTS slo_burn (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slo_name TEXT NOT NULL,                    -- e.g., 'availability', 'api_latency_p95'
  year_month TEXT NOT NULL,                  -- 'YYYY-MM' format, e.g., '2026-08'
  window_start TEXT NOT NULL,                -- ISO timestamp, window start (inclusive)
  window_end TEXT NOT NULL,                  -- ISO timestamp, window end (exclusive)

  -- SLO configuration
  target_value REAL NOT NULL,                -- SLO target (e.g., 0.995 for 99.5%)
  target_operator TEXT NOT NULL,             -- 'gte' or 'lte'

  -- Measured values
  total_requests INTEGER NOT NULL DEFAULT 0,
  good_requests INTEGER NOT NULL DEFAULT 0,
  bad_requests INTEGER NOT NULL DEFAULT 0,
  measured_value REAL,                       -- Actual measured value (e.g., 0.997)

  -- Error budget
  error_budget REAL,                         -- (1 - target) * total for availability
  error_budget_consumed REAL,                -- bad_requests for availability
  burn_rate REAL,                            -- error_budget_consumed / error_budget

  -- Alert state
  alert_level TEXT,                          -- 'info', 'warning', 'critical', 'emergency'
  alert_fired_at TEXT,                       -- ISO timestamp when alert fired
  alert_acknowledged_at TEXT,                -- ISO timestamp when acknowledged

  -- Metadata
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT,                             -- JSON: {p50, p95, p99, sample_count, ...}

  UNIQUE(slo_name, year_month)
);

CREATE INDEX IF NOT EXISTS idx_slo_burn_slo_month ON slo_burn(slo_name, year_month);
CREATE INDEX IF NOT EXISTS idx_slo_burn_computed ON slo_burn(computed_at);
CREATE INDEX IF NOT EXISTS idx_slo_burn_alert ON slo_burn(alert_level) WHERE alert_level IS NOT NULL;

-- View for current month burn-rate dashboard
CREATE VIEW IF NOT EXISTS v_slo_current_month AS
SELECT
  slo_name,
  year_month,
  target_value,
  measured_value,
  burn_rate,
  alert_level,
  alert_fired_at,
  computed_at,
  metadata
FROM slo_burn
WHERE year_month = strftime('%Y-%m', 'now')
ORDER BY slo_name;