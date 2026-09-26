/** @vitest-environment node */

/**
 * Unit Test Suite: Multi-Cloud Edge Traffic Router & Sub-30ms Failover Engine
 *
 * Validates:
 * 1. Standard edge routing selects lowest-latency Cloudflare Workers primary in matching geographic zone
 * 2. Fallback edge routing when primary is degraded
 * 3. GPU video burst routing dispatches compute-heavy workloads to GCP Cloud Run GPU nodes
 * 4. Autonomous sub-30ms failover execution, state update, and audit log persistence
 * 5. Byzantine split-brain quorum arbitration with latency tie-breakers
 * 6. Multicloud cluster topology aggregation
 * 7. Error handling when no healthy regions are available
 *
 * @module tree/multicloud/__tests__/multicloud-router.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import {
  resolveOptimalEdgeRoute,
  executeSub30msFailover,
  arbitrateSplitBrainPartition,
  getMulticloudTopology,
} from '../multicloud-router';
import type { MulticloudEdgeRegion } from '@/seed/types/multicloud-mesh';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Multi-Cloud Router & Failover Engine — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS multicloud_edge_regions (
        id TEXT PRIMARY KEY,
        region_code TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL CHECK(provider IN ('cloudflare', 'aws', 'gcp', 'hybrid')),
        tier_role TEXT NOT NULL CHECK(tier_role IN ('primary_edge', 'fallback_edge', 'gpu_burst_node', 'storage_mesh_gateway')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'degraded', 'failing', 'draining', 'offline')),
        endpoint_url TEXT NOT NULL,
        geographic_zone TEXT NOT NULL CHECK(geographic_zone IN ('apac', 'nam', 'emea', 'latam', 'global')),
        latitude REAL,
        longitude REAL,
        p95_latency_ms REAL NOT NULL DEFAULT 15.0 CHECK(p95_latency_ms >= 0.0),
        p99_latency_ms REAL NOT NULL DEFAULT 25.0 CHECK(p99_latency_ms >= 0.0),
        health_score REAL NOT NULL DEFAULT 1.0 CHECK(health_score >= 0.0 AND health_score <= 1.0),
        consecutive_health_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_health_failures >= 0),
        is_healthy INTEGER NOT NULL DEFAULT 1 CHECK(is_healthy IN (0, 1)),
        active_requests INTEGER NOT NULL DEFAULT 0 CHECK(active_requests >= 0),
        max_concurrency INTEGER NOT NULL DEFAULT 5000 CHECK(max_concurrency > 0),
        gpu_capacity_total INTEGER NOT NULL DEFAULT 0 CHECK(gpu_capacity_total >= 0),
        gpu_capacity_allocated INTEGER NOT NULL DEFAULT 0 CHECK(gpu_capacity_allocated >= 0),
        cost_per_m_requests_cents INTEGER NOT NULL DEFAULT 15,
        egress_cost_per_gb_cents INTEGER NOT NULL DEFAULT 0,
        last_heartbeat_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        capabilities_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        registered_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE TABLE IF NOT EXISTS cloud_failover_audit_log (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        incident_code TEXT NOT NULL UNIQUE,
        origin_region_id TEXT NOT NULL,
        destination_region_id TEXT NOT NULL,
        trigger_reason TEXT NOT NULL,
        detection_latency_ms REAL NOT NULL,
        failover_duration_ms REAL NOT NULL,
        is_sub_30ms INTEGER NOT NULL DEFAULT 1,
        traffic_shift_pct REAL NOT NULL DEFAULT 100.0,
        requests_diverted INTEGER NOT NULL DEFAULT 0,
        error_rate_before REAL NOT NULL DEFAULT 0.0,
        error_rate_after REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'executed',
        actor_type TEXT NOT NULL DEFAULT 'autonomous_sentinel',
        telemetry_snapshot_json TEXT NOT NULL DEFAULT '{}',
        occurred_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );

      INSERT INTO multicloud_edge_regions (
        id, region_code, provider, tier_role, status, endpoint_url, geographic_zone,
        latitude, longitude, p95_latency_ms, p99_latency_ms, health_score, is_healthy,
        max_concurrency, gpu_capacity_total, gpu_capacity_allocated
      ) VALUES
      (
        'region_cf_primary_apac', 'cf-sin', 'cloudflare', 'primary_edge', 'active',
        'https://apac-edge.sophia.agencyos.network', 'apac', 1.3521, 103.8198, 12.4, 18.2, 1.0, 1, 10000, 0, 0
      ),
      (
        'region_cf_primary_nam', 'cf-iad', 'cloudflare', 'primary_edge', 'active',
        'https://nam-edge.sophia.agencyos.network', 'nam', 39.0438, -77.4874, 11.8, 17.5, 1.0, 1, 10000, 0, 0
      ),
      (
        'region_aws_fallback_nam', 'aws-us-east-1', 'aws', 'fallback_edge', 'active',
        'https://aws-edge-nam.sophia.agencyos.network', 'nam', 38.9339, -77.1773, 24.5, 35.2, 1.0, 1, 5000, 0, 0
      ),
      (
        'region_gcp_burst_nam', 'gcp-us-central1', 'gcp', 'gpu_burst_node', 'active',
        'https://gcp-gpu-nam.sophia.agencyos.network', 'nam', 41.8781, -93.0977, 32.0, 45.0, 1.0, 1, 1000, 64, 8
      ),
      (
        'region_gcp_burst_apac', 'gcp-asia-southeast1', 'gcp', 'gpu_burst_node', 'active',
        'https://gcp-gpu-apac.sophia.agencyos.network', 'apac', 1.3521, 103.8198, 34.5, 48.0, 1.0, 1, 1000, 32, 4
      );
    `);

    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('Route Resolution', () => {
    it('selects lowest-latency Cloudflare Workers primary in matching geographic zone', async () => {
      const decision = await resolveOptimalEdgeRoute(db, {
        geographicZone: 'apac',
        workloadType: 'standard_edge_api',
      });

      expect(decision.selectedRegionId).toBe('region_cf_primary_apac');
      expect(decision.regionCode).toBe('cf-sin');
      expect(decision.provider).toBe('cloudflare');
      expect(decision.tierRole).toBe('primary_edge');
      expect(decision.isGpuBurst).toBe(false);
      expect(decision.isFallback).toBe(false);
      expect(decision.estimatedLatencyMs).toBe(12.4);
      expect(decision.targetEndpointUrl).toBe('https://apac-edge.sophia.agencyos.network');
    });

    it('selects fallback edge when primary edge in the zone is degraded', async () => {
      // Degrade CF primary in NAM
      rawDb.exec("UPDATE multicloud_edge_regions SET status = 'degraded', is_healthy = 0 WHERE id = 'region_cf_primary_nam'");

      const decision = await resolveOptimalEdgeRoute(db, {
        geographicZone: 'nam',
        workloadType: 'standard_edge_api',
      });

      expect(decision.selectedRegionId).toBe('region_aws_fallback_nam');
      expect(decision.provider).toBe('aws');
      expect(decision.tierRole).toBe('fallback_edge');
      expect(decision.isFallback).toBe(true);
      expect(decision.isGpuBurst).toBe(false);
    });

    it('routes compute-heavy video burst workloads to GCP Cloud Run GPU nodes', async () => {
      const decision = await resolveOptimalEdgeRoute(db, {
        geographicZone: 'nam',
        workloadType: 'video_generation_burst',
        requiredGpuUnits: 8,
      });

      expect(decision.selectedRegionId).toBe('region_gcp_burst_nam');
      expect(decision.regionCode).toBe('gcp-us-central1');
      expect(decision.provider).toBe('gcp');
      expect(decision.tierRole).toBe('gpu_burst_node');
      expect(decision.isGpuBurst).toBe(true);
      expect(decision.routingReason).toContain('GPU video burst node');
    });

    it('throws descriptive error if no healthy regions are available', async () => {
      rawDb.exec("UPDATE multicloud_edge_regions SET status = 'offline', is_healthy = 0");

      await expect(
        resolveOptimalEdgeRoute(db, {
          geographicZone: 'apac',
          workloadType: 'standard_edge_api',
        })
      ).rejects.toThrow('NO_HEALTHY_REGIONS');
    });
  });

  describe('Sub-30ms Traffic Failover', () => {
    it('executes deterministic failover under 30ms and logs to audit table', async () => {
      const result = await executeSub30msFailover(db, {
        originRegionId: 'region_cf_primary_nam',
        triggerReason: 'p95_latency_spike',
        errorRateBefore: 0.065,
        requestsDiverted: 1200,
        telemetrySnapshot: { p95_latency_ms: 128.4, cpu_load_pct: 92.5 },
      });

      expect(result.incidentCode).toMatch(/^FO-\d{8}-[A-F0-9]{6}$/);
      expect(result.originRegionId).toBe('region_cf_primary_nam');
      expect(result.destinationRegionId).toBe('region_aws_fallback_nam');
      expect(result.failoverDurationMs).toBeLessThan(30.0);
      expect(result.isSub30ms).toBe(true);
      expect(result.status).toBe('executed');

      // Verify DB record
      const stmt = rawDb.prepare('SELECT * FROM cloud_failover_audit_log WHERE incident_code = ?');
      const row = stmt.get(result.incidentCode) as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.trigger_reason).toBe('p95_latency_spike');
      expect(row.is_sub_30ms).toBe(1);
      expect(Number(row.requests_diverted)).toBe(1200);

      // Verify origin region marked degraded
      const regStmt = rawDb.prepare("SELECT status, is_healthy FROM multicloud_edge_regions WHERE id = 'region_cf_primary_nam'");
      const reg = regStmt.get() as { status: string; is_healthy: number };
      expect(reg.status).toBe('degraded');
      expect(reg.is_healthy).toBe(0);
    });

    it('throws error when no healthy destination can be found for failover', async () => {
      rawDb.exec("UPDATE multicloud_edge_regions SET status = 'offline', is_healthy = 0 WHERE id != 'region_cf_primary_nam'");

      await expect(
        executeSub30msFailover(db, {
          originRegionId: 'region_cf_primary_nam',
          triggerReason: 'health_check_timeout',
        })
      ).rejects.toThrow('FAILOVER_UNAVAILABLE');
    });
  });

  describe('Byzantine Split-Brain Partition Arbitration', () => {
    const baseNode = (id: string, isHealthy: boolean, p95: number, health: number): MulticloudEdgeRegion => ({
      id,
      regionCode: id,
      provider: 'cloudflare',
      tierRole: 'primary_edge',
      status: isHealthy ? 'active' : 'degraded',
      endpointUrl: `https://${id}.example.com`,
      geographicZone: 'apac',
      latitude: null,
      longitude: null,
      p95LatencyMs: p95,
      p99LatencyMs: p95 * 1.5,
      healthScore: health,
      consecutiveHealthFailures: 0,
      isHealthy,
      activeRequests: 0,
      maxConcurrency: 1000,
      gpuCapacityTotal: 0,
      gpuCapacityAllocated: 0,
      costPerMRequestsCents: 15,
      egressCostPerGbCents: 0,
      lastHeartbeatAt: Date.now(),
      capabilities: [],
      metadata: {},
      registeredAt: Date.now(),
      updatedAt: Date.now(),
    });

    it('elects partition with majority healthy nodes', () => {
      const partA = [baseNode('n1', true, 15, 1.0), baseNode('n2', true, 18, 1.0), baseNode('n3', true, 20, 1.0)];
      const partB = [baseNode('n4', true, 12, 1.0), baseNode('n5', true, 14, 1.0)];

      const decision = arbitrateSplitBrainPartition(partA, partB);
      expect(decision.winningPartition).toBe('A');
      expect(decision.quorumCount).toBe(3);
      expect(decision.reason).toContain('Quorum majority');
    });

    it('uses lower average p95 latency as tie-breaker when node counts are equal', () => {
      const partA = [baseNode('n1', true, 25.0, 1.0), baseNode('n2', true, 30.0, 1.0)]; // avg 27.5ms
      const partB = [baseNode('n3', true, 15.0, 1.0), baseNode('n4', true, 18.0, 1.0)]; // avg 16.5ms

      const decision = arbitrateSplitBrainPartition(partA, partB);
      expect(decision.winningPartition).toBe('B');
      expect(decision.quorumCount).toBe(2);
      expect(decision.reason).toContain('Lower average p95 latency');
    });

    it('uses higher average health score when latency is identical', () => {
      const partA = [baseNode('n1', true, 20.0, 0.95)];
      const partB = [baseNode('n2', true, 20.0, 0.85)];

      const decision = arbitrateSplitBrainPartition(partA, partB);
      expect(decision.winningPartition).toBe('A');
      expect(decision.reason).toContain('Higher health score');
    });
  });

  describe('Topology Aggregation', () => {
    it('aggregates total regions, active counts, and regional breakdown', async () => {
      const topology = await getMulticloudTopology(db);

      expect(topology.totalRegions).toBe(5);
      expect(topology.activeRegionsCount).toBe(5);
      expect(topology.degradedRegionsCount).toBe(0);
      expect(topology.primaryEdgeRegionId).toBe('region_cf_primary_nam'); // lowest p95
      expect(topology.regionalBreakdown.apac).toBe(2);
      expect(topology.regionalBreakdown.nam).toBe(3);
    });
  });
});
