/**
 * @file db-models.ts
 * @description Database row interfaces for edge GPU mesh tables.
 * @layer seed
 */

export interface GpuComputeNodeDbRow {
  id: string;
  node_id: string;
  region: string;
  provider: string;
  gpu_model: string;
  gpu_count: number;
  vram_gb_per_gpu: number;
  total_vram_gb: number;
  status: string;
  current_load_pct: number;
  active_render_jobs: number;
  max_concurrency: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  spot_price_cents_per_hour: number;
  on_demand_price_cents_per_hour: number;
  supported_codecs_json: string;
  max_resolution: string;
  health_score: number;
  is_healthy: number;
  total_renders_completed: number;
  total_render_seconds: number;
  last_heartbeat_at: number;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

export interface VideoRenderDispatchDbRow {
  id: string;
  dispatch_id: string;
  tenant_id: string;
  job_id: string;
  node_id: string;
  video_resolution: string;
  video_duration_seconds: number;
  frame_count: number;
  codec: string;
  status: string;
  priority_score: number;
  spot_pricing_applied: number;
  cost_cents: number;
  queue_wait_ms: number;
  render_duration_ms: number | null;
  egress_bytes: number;
  sla_target_ms: number;
  sla_breached: number;
  reroute_count: number;
  failover_history_json: string;
  error_message: string | null;
  dispatched_at: number;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SlaPenaltyEscrowDbRow {
  id: string;
  escrow_id: string;
  tenant_id: string;
  contract_id: string;
  period_month: string;
  target_sla_pct: number;
  actual_uptime_pct: number;
  total_period_seconds: number;
  allowed_downtime_seconds: number;
  downtime_seconds: number;
  error_budget_consumed_seconds: number;
  error_budget_remaining_seconds: number;
  escrow_funded_cents: number;
  penalty_claimed_cents: number;
  escrow_balance_cents: number;
  breach_tier: string;
  penalty_pct: number;
  escrow_status: string;
  last_breach_timestamp: number | null;
  audit_hash: string;
  created_at: number;
  updated_at: number;
}
