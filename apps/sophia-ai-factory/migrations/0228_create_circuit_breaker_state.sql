-- Circuit breaker state persistence for 4-state machine
-- Tracks external service health: CLOSED → DEGRADED → OPEN → HALF_OPEN

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  service TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'CLOSED',
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TEXT,
  cooldown_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for LRU eviction: find oldest entries by updated_at
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_updated
ON circuit_breaker_state(updated_at);

-- Index for cooldown queries: find services still in cooldown
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_cooldown
ON circuit_breaker_state(cooldown_until)
WHERE cooldown_until IS NOT NULL;
