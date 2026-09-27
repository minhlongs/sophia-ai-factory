-- 0317_hectocorn_compute_grid_and_arbitrage_vault.sql
-- Gate 12: $25,000,000 MRR ($300M ARR, 100,000 Paid Customers)
-- Pillar 3: Hectocorn Multi-Region GPU Compute Grid & High-Frequency Institutional Arbitrage Vault

-- 1. Hectocorn Compute Nodes (Bare-Metal + Multi-Cloud GPU Grid)
CREATE TABLE IF NOT EXISTS hectocorn_compute_nodes (
  id TEXT PRIMARY KEY,
  cluster_name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK(provider_type IN ('BARE_METAL', 'LAMBDA_LABS', 'RUNPOD', 'COREWEAVE', 'ORACLE_CLOUD', 'AWS_NEURON')),
  region TEXT NOT NULL CHECK(region IN ('US_EAST', 'US_WEST', 'EU_CENTRAL', 'EU_WEST', 'AP_SOUTHEAST', 'AP_NORTHEAST', 'SA_EAST')),
  gpu_architecture TEXT NOT NULL CHECK(gpu_architecture IN ('NVIDIA_B200', 'NVIDIA_H100_SXM', 'NVIDIA_A100_80G', 'AMD_MI300X', 'APPLE_M3_ULTRA')),
  gpu_count INTEGER NOT NULL DEFAULT 8,
  total_vram_gb INTEGER NOT NULL DEFAULT 640,
  active_jobs_count INTEGER NOT NULL DEFAULT 0,
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 64,
  node_health_score REAL NOT NULL DEFAULT 1.0, -- 0.0 to 1.0
  network_egress_gbps REAL NOT NULL DEFAULT 100.0,
  status TEXT NOT NULL CHECK(status IN ('READY', 'BUSY', 'DRAINING', 'MAINTENANCE', 'OFFLINE')) DEFAULT 'READY',
  last_ping_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_hectocorn_nodes_region ON hectocorn_compute_nodes(region, status, gpu_architecture);

-- 2. Distributed Video Render Batches (100K Concurrent Pipelines)
CREATE TABLE IF NOT EXISTS distributed_render_batches (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL UNIQUE,
  total_renders INTEGER NOT NULL,
  completed_renders INTEGER NOT NULL DEFAULT 0,
  failed_renders INTEGER NOT NULL DEFAULT 0,
  allocated_nodes_count INTEGER NOT NULL DEFAULT 0,
  average_render_time_ms INTEGER NOT NULL DEFAULT 4200, -- 4.2s per 4K render
  p99_render_time_ms INTEGER NOT NULL DEFAULT 8900,
  status TEXT NOT NULL CHECK(status IN ('QUEUED', 'DISPATCHING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED')) DEFAULT 'QUEUED',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. High-Frequency Institutional Arbitrage Pools
CREATE TABLE IF NOT EXISTS hft_arbitrage_pools (
  id TEXT PRIMARY KEY,
  pool_name TEXT NOT NULL UNIQUE, -- e.g. TRIANGLE_USDT_USDC_USD, CORRIDOR_EUR_SGD_USD
  dex_router_address TEXT NOT NULL,
  cex_clearing_gateway TEXT NOT NULL,
  total_liquidity_cents INTEGER NOT NULL DEFAULT 1000000000, -- $10M pool liquidity
  rebalanced_volume_24h_cents INTEGER NOT NULL DEFAULT 0,
  arbitrage_yield_captured_cents INTEGER NOT NULL DEFAULT 0,
  customer_dividend_distributed_cents INTEGER NOT NULL DEFAULT 0,
  max_slippage_bps INTEGER NOT NULL DEFAULT 1, -- 1 bps = 0.01%
  is_circuit_breaker_active INTEGER NOT NULL DEFAULT 0 CHECK(is_circuit_breaker_active IN (0, 1)),
  last_arbitrage_execution_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 4. Seven-Nines SLA Tracking (99.99999% availability)
CREATE TABLE IF NOT EXISTS seven_nines_sla_events (
  id TEXT PRIMARY KEY,
  month_period TEXT NOT NULL, -- e.g. 2026-09
  total_seconds INTEGER NOT NULL DEFAULT 2592000,
  downtime_milliseconds INTEGER NOT NULL DEFAULT 0, -- Max allowed: 259.2ms per month
  uptime_percentage REAL NOT NULL DEFAULT 100.0,
  breach_status TEXT NOT NULL CHECK(breach_status IN ('HEALTHY', 'WARNING', 'BREACHED')) DEFAULT 'HEALTHY',
  penalties_escrow_cents INTEGER NOT NULL DEFAULT 0,
  last_evaluated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seven_nines_period ON seven_nines_sla_events(month_period);
