-- 0320_exaflop_compute_matrix_and_orbital_relay.sql
-- Gate 13: $50,000,000 MRR ($600M ARR, 200,000 Paid Customers)
-- Pillar 3: ExaFLOP Hyper-Scale Planetary Compute Matrix & Autonomous Deep-Space Relay (Eight-Nines SLA)

-- 1. ExaFLOP Compute Clusters
CREATE TABLE IF NOT EXISTS exaflop_compute_clusters (
  id TEXT PRIMARY KEY,
  cluster_ref TEXT NOT NULL UNIQUE,
  architecture_class TEXT NOT NULL CHECK(architecture_class IN ('BLACKWELL_B200_NVL72', 'GRACE_HOPPER_GH200', 'AMD_MI300X_POD', 'APPLE_SILICON_M_MAX_MESH')),
  total_flops_exa REAL NOT NULL, -- e.g. 1.25 ExaFLOPs
  active_gpus_count INTEGER NOT NULL DEFAULT 16384,
  thermal_efficiency_percentage REAL NOT NULL DEFAULT 94.5,
  pue_score REAL NOT NULL DEFAULT 1.08, -- Power Usage Effectiveness
  network_backplane_tbps REAL NOT NULL DEFAULT 800.0,
  cluster_status TEXT NOT NULL CHECK(cluster_status IN ('OPTIMAL', 'DEGRADED', 'THERMAL_THROTTLED', 'DRAINING', 'OFFLINE')) DEFAULT 'OPTIMAL',
  datacenter_location TEXT NOT NULL CHECK(datacenter_location IN ('ICELAND_GEOTHERMAL', 'NORWAY_FJORDS', 'SINGAPORE_UNDERWATER', 'TEXAS_SOLAR', 'ORBITAL_L2_RELAY')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_exaflop_clusters_status ON exaflop_compute_clusters(cluster_status, architecture_class);

-- 2. Planetary Workload Batches (250,000 Concurrent Pipelines)
CREATE TABLE IF NOT EXISTS planetary_workload_batches (
  id TEXT PRIMARY KEY,
  batch_uuid TEXT NOT NULL UNIQUE,
  total_jobs INTEGER NOT NULL,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs INTEGER NOT NULL DEFAULT 0,
  allocated_clusters_count INTEGER NOT NULL DEFAULT 1,
  total_compute_exaflops_consumed REAL NOT NULL DEFAULT 0.0,
  dispatch_latency_ms REAL NOT NULL DEFAULT 0.45, -- sub-millisecond scheduling
  batch_status TEXT NOT NULL CHECK(batch_status IN ('QUEUED', 'SCHEDULED', 'STREAMING', 'COMPLETED', 'FAILED')) DEFAULT 'QUEUED',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 3. Orbital Deep-Space Relay Nodes
CREATE TABLE IF NOT EXISTS orbital_relay_nodes (
  id TEXT PRIMARY KEY,
  satellite_designation TEXT NOT NULL UNIQUE, -- e.g. SOPHIA_RELAY_LEO_01, SOPHIA_LAGRANGE_L2
  constellation_orbit TEXT NOT NULL CHECK(constellation_orbit IN ('LEO_SUN_SYNCHRONOUS', 'MEO_EQUATORIAL', 'GEO_STATIONARY', 'EARTH_MOON_L2')),
  laser_link_capacity_gbps REAL NOT NULL DEFAULT 1000.0, -- 1 Tbps optical crosslink
  relativistic_delay_compensation_ms REAL NOT NULL DEFAULT 4.2,
  buffer_storage_tb REAL NOT NULL DEFAULT 500.0,
  doppler_shift_hz REAL NOT NULL DEFAULT 0.0,
  node_health_status TEXT NOT NULL CHECK(node_health_status IN ('ALIGNED', 'ACQUIRING_LOCK', 'ECLIPSE_BATTERY_MODE', 'MAINTENANCE')) DEFAULT 'ALIGNED',
  last_laser_handshake_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 4. Eight-Nines SLA Records (99.999999% Availability: max 25.92 ms monthly downtime)
CREATE TABLE IF NOT EXISTS eight_nines_sla_records (
  id TEXT PRIMARY KEY,
  period_identifier TEXT NOT NULL UNIQUE, -- e.g. 2026-09-GATE13
  total_target_seconds INTEGER NOT NULL DEFAULT 2592000, -- 30 days
  recorded_downtime_ms REAL NOT NULL DEFAULT 0.0,
  availability_percentage REAL NOT NULL DEFAULT 99.999999,
  sla_breached INTEGER NOT NULL DEFAULT 0 CHECK(sla_breached IN (0, 1)),
  byzantine_quorum_signatures INTEGER NOT NULL DEFAULT 16,
  audit_merkle_root TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
