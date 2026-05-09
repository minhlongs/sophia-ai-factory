-- Migration 0091: Composite indexes for hot multi-column queries
-- Wave 11 G2 Performance Audit (F-PC-8)
--
-- Analysis source: Grep of src/ for WHERE x = ? AND y = ? patterns + usage-rollup-engine.ts
-- All indexes use IF NOT EXISTS — safe to re-apply.

-- INDEX 1: usage_events(user_id, license_nonce, created_at)
-- Serves: checkQuota in usage-rollup-engine.ts:
--   WHERE user_id = ? AND license_nonce = ? AND created_at >= ? (AND < ?)
-- Called 3× per request (hourly/daily/monthly windows). Without composite index:
-- D1 does SCAN on ~all rows for the user. With index: SEARCH to narrow ts range directly.
CREATE INDEX IF NOT EXISTS idx_usage_events_user_nonce_ts
  ON usage_events(user_id, license_nonce, created_at);

-- INDEX 2: usage_events(user_id, created_at)
-- Serves: usage export / listing queries in export.ts and dashboard/page.tsx:
--   WHERE user_id = ? AND created_at >= ? [AND <= ?]
-- Also serves realtime-alert-dispatcher-event-handler.ts aggregation:
--   SUM(credits_used) WHERE user_id = ? AND license_nonce = ? AND created_at >= ?
-- (Covered by INDEX 1 above, but kept for single-column license_nonce-agnostic queries)
CREATE INDEX IF NOT EXISTS idx_usage_events_user_ts
  ON usage_events(user_id, created_at);

-- INDEX 3: engine_missions(user_id, status, created_at)
-- Serves: mission listing queries filtered by user + status + time order:
--   WHERE user_id = ? AND status = ? ORDER BY created_at DESC
-- Existing index engine_missions_user_idx covers (user_id, created_at) but not status filter.
-- New composite allows SQLite to narrow by status without post-filter table scan.
CREATE INDEX IF NOT EXISTS idx_engine_missions_user_status_ts
  ON engine_missions(user_id, status, created_at);

-- INDEX 4: customer_handovers(customer_user_id, status)
-- Serves: auto-handover.ts + handover-status-sync/route.ts:
--   WHERE customer_user_id = ? ORDER BY created_at DESC
--   WHERE status = 'pending' (admin listing)
-- Existing indexes: customer_handovers_user_idx(customer_user_id), customer_handovers_status_idx(status).
-- Composite adds filter by both simultaneously for dashboard queries joining user+status.
CREATE INDEX IF NOT EXISTS idx_customer_handovers_user_status
  ON customer_handovers(customer_user_id, status);

-- INDEX 5: raas_user_api_keys(owner_id, revoked_at, created_at)
-- Serves: API key listing for a user filtered to active keys:
--   WHERE owner_id = ? AND revoked_at IS NULL [ORDER BY created_at DESC]
-- Existing idx_raas_user_api_keys_owner_active is (owner_id, key_id) WHERE revoked_at IS NULL.
-- New index covers ORDER BY created_at which is needed for paginated key listing.
CREATE INDEX IF NOT EXISTS idx_raas_user_api_keys_owner_revoked_ts
  ON raas_user_api_keys(owner_id, revoked_at, created_at);

-- INDEX 6: publishing_jobs(tenant_id, status, scheduled_at)
-- Serves: publish queue polling:
--   WHERE tenant_id = ? AND status = 'scheduled' ORDER BY scheduled_at ASC
-- Existing idx_pub_jobs_status_sched covers (status, scheduled_at) globally.
-- Composite narrows to tenant first — critical for multi-tenant scale.
CREATE INDEX IF NOT EXISTS idx_publishing_jobs_tenant_status_sched
  ON publishing_jobs(tenant_id, status, scheduled_at);

-- INDEX 7: subscriptions(user_id, status)
-- Serves: get-user-tier.ts hot path (called on every authenticated request):
--   WHERE user_id = ? AND status = 'active'
-- This is the most frequently called query in the entire app.
-- Existing schema has no composite index on subscriptions for user_id+status.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

-- INDEX 8: signals_events(event_type, ts) for cron/local-mode-health route
-- Serves: WHERE event_type='local_mode_unhealthy' AND actor=? AND ts > ?
-- Also: WHERE event_type = 'llm_call_trace' AND ts >= ?
CREATE INDEX IF NOT EXISTS idx_signals_events_type_ts
  ON signals_events(event_type, ts);
