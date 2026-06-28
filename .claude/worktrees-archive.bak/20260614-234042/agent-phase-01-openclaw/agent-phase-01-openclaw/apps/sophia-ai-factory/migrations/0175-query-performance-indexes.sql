-- Composite indexes for common unbounded query patterns identified in audit 260607
-- Covers: webhook_endpoints, webhook_attempts, signals_events, error_log,
--         engine_missions, raas_licenses, sop_templates, thumbnail_variants

-- Webhook endpoints: WHERE tenant_id + ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant_created
  ON webhook_endpoints(tenant_id, created_at DESC);

-- Webhook attempts: WHERE endpoint_id + ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_webhook_attempts_endpoint_created
  ON webhook_attempts(endpoint_id, created_at DESC);

-- Signals events: WHERE event_type + ts >= (used in llm-trace-stats, agent-health-resolver)
CREATE INDEX IF NOT EXISTS idx_signals_events_type_ts
  ON signals_events(event_type, ts DESC);

-- Error log: WHERE ts > datetime('now', '-24 hours') GROUP BY fingerprint
CREATE INDEX IF NOT EXISTS idx_error_log_ts
  ON error_log(ts DESC);

-- Engine missions: WHERE status IN ('pending','running') + created_at < cutoff
CREATE INDEX IF NOT EXISTS idx_engine_missions_status_created
  ON engine_missions(status, created_at);

-- RaaS licenses: WHERE user_id + ORDER BY created_at DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_raas_licenses_user_created
  ON raas_licenses(user_id, created_at DESC);

-- SOP templates: WHERE is_official + status + ORDER BY created_at (catalog queries)
CREATE INDEX IF NOT EXISTS idx_sop_templates_official_status_created
  ON sop_templates(is_official, status, created_at DESC);

-- Thumbnail variants: WHERE video_id + ORDER BY variant_index
CREATE INDEX IF NOT EXISTS idx_thumbnail_variants_video_idx
  ON thumbnail_variants(video_id, variant_index);
