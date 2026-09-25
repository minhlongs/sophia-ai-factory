/**
 * Global Multi-Region Failover Mesh Router Unit Tests
 *
 * Validates:
 * - Deterministic latency-aware routing across APAC, US, and EU
 * - Primary healthy region selection (hop 0)
 * - Cascading fallback upon degradation or high latency (>1500ms SLA ceiling)
 * - Circuit breaker integration (OPEN prevents routing to region)
 * - Best-effort fallback when all preferred regions are degraded
 * - Circuit breaker trip and reset operations
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import {
  resolveOptimalRegion,
  getRegionsHealth,
  getRegionHealth,
  updateRegionHealthTelemetry,
  tripCircuitBreaker,
  resetCircuitBreaker,
} from '@/tree/gpu-mesh/multi-region-router';
import type { EnterpriseGpuReservation } from '@/seed/types/gpu-mesh';

function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS gpu_mesh_region_health (
      region TEXT PRIMARY KEY,
      health_status TEXT NOT NULL DEFAULT 'healthy',
      p95_latency_ms INTEGER NOT NULL DEFAULT 200,
      error_rate_pct REAL NOT NULL DEFAULT 0.0,
      active_reservations INTEGER NOT NULL DEFAULT 0,
      available_capacity_pct REAL NOT NULL DEFAULT 100.0,
      circuit_breaker_state TEXT NOT NULL DEFAULT 'CLOSED',
      last_probe_at INTEGER NOT NULL,
      probe_details TEXT DEFAULT '{}',
      updated_at INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...vals: unknown[]) {
          bound = vals;
          return this;
        },
        async run(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...params);
          return {
            success: true,
            meta: { changes: res.changes, duration: 1 },
            changes: res.changes,
            lastInsertRowid: res.lastInsertRowid,
          };
        },
        async all(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...params);
          return {
            results,
            meta: { changes: 0, duration: 1 },
          };
        },
        async first(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...params);
          return row ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

describe('Global Multi-Region Failover Mesh Router', () => {
  let db: D1Database;
  const NOW = 1760000000;

  const baseReservation: EnterpriseGpuReservation = {
    id: 'res_ent_apac',
    orgId: 'org_apac_1',
    laneId: 'lane_apac_1',
    primaryRegion: 'apac',
    fallbackRegions: ['us', 'eu'],
    reservedUnits: 5,
    concurrencyLimit: 20,
    mcuMonthlyAllocation: 100000,
    mcuConsumed: 1000,
    priorityScore: 300,
    status: 'active',
    slaUptimeTarget: 0.999,
    slaP95LatencyMs: 1500,
    slaDegradationWindowSecs: 900,
    slaRefundPct: 10,
    allocatedProviders: ['fal', 'runpod'],
    activeFrom: NOW - 1000,
    activeUntil: NOW + 100000,
    metadata: {},
    createdAt: NOW,
    updatedAt: NOW,
  };

  beforeEach(async () => {
    db = createTestD1();

    // Seed default healthy regions
    await db
      .prepare(
        `INSERT INTO gpu_mesh_region_health (
          region, health_status, p95_latency_ms, error_rate_pct,
          active_reservations, available_capacity_pct, circuit_breaker_state,
          last_probe_at, updated_at
        ) VALUES
          ('apac', 'healthy', 220, 0.0, 2, 95.0, 'CLOSED', ?, ?),
          ('us', 'healthy', 180, 0.0, 1, 98.0, 'CLOSED', ?, ?),
          ('eu', 'healthy', 210, 0.0, 1, 97.0, 'CLOSED', ?, ?)`,
      )
      .bind(NOW, NOW, NOW, NOW, NOW, NOW)
      .run();
  });

  describe('Route Resolution & Fallbacks', () => {
    it('selects primary healthy region with 0 failover hops', async () => {
      const route = await resolveOptimalRegion(db, baseReservation);

      expect(route.selectedRegion).toBe('apac');
      expect(route.isFailover).toBe(false);
      expect(route.failoverHops).toBe(0);
      expect(route.reason).toBe('PRIMARY_HEALTHY');
      expect(route.circuitBreakerState).toBe('CLOSED');
      expect(route.p95LatencyMs).toBe(220);
    });

    it('fails over to US when primary APAC is unhealthy', async () => {
      await db
        .prepare("UPDATE gpu_mesh_region_health SET health_status = 'unhealthy' WHERE region = 'apac'")
        .run();

      const route = await resolveOptimalRegion(db, baseReservation);

      expect(route.selectedRegion).toBe('us');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(1);
      expect(route.reason).toBe('FAILOVER_FROM_APAC');
      expect(route.p95LatencyMs).toBe(180);
    });

    it('fails over to EU when APAC is unhealthy and US circuit breaker is OPEN', async () => {
      await db
        .prepare("UPDATE gpu_mesh_region_health SET health_status = 'unhealthy' WHERE region = 'apac'")
        .run();
      await db
        .prepare("UPDATE gpu_mesh_region_health SET circuit_breaker_state = 'OPEN' WHERE region = 'us'")
        .run();

      const route = await resolveOptimalRegion(db, baseReservation);

      expect(route.selectedRegion).toBe('eu');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(2);
      expect(route.reason).toBe('FAILOVER_FROM_APAC');
      expect(route.p95LatencyMs).toBe(210);
    });

    it('fails over when primary latency breaches SLA ceiling (e.g. 1800ms > 1500ms)', async () => {
      await db
        .prepare('UPDATE gpu_mesh_region_health SET p95_latency_ms = 1800 WHERE region = ?')
        .bind('apac')
        .run();

      const route = await resolveOptimalRegion(db, baseReservation);

      expect(route.selectedRegion).toBe('us');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(1);
    });

    it('selects best-effort fallback when all regions are degraded', async () => {
      // Degrade all regions, with EU having lowest error rate
      await db
        .prepare("UPDATE gpu_mesh_region_health SET health_status = 'unhealthy', error_rate_pct = 80.0 WHERE region = 'apac'")
        .run();
      await db
        .prepare("UPDATE gpu_mesh_region_health SET health_status = 'unhealthy', error_rate_pct = 60.0 WHERE region = 'us'")
        .run();
      await db
        .prepare("UPDATE gpu_mesh_region_health SET health_status = 'unhealthy', error_rate_pct = 40.0 WHERE region = 'eu'")
        .run();

      const route = await resolveOptimalRegion(db, baseReservation);

      expect(route.selectedRegion).toBe('eu');
      expect(route.isFailover).toBe(true);
      expect(route.reason).toBe('ALL_REGIONS_DEGRADED_BEST_EFFORT');
    });
  });

  describe('Circuit Breaker Operations & Telemetry', () => {
    it('trips circuit breaker to OPEN upon failure', async () => {
      const tripped = await tripCircuitBreaker(db, 'apac', 'Downstream GPU node timeout spike');
      expect(tripped).toBe(true);

      const health = await getRegionHealth(db, 'apac');
      expect(health?.circuitBreakerState).toBe('OPEN');
      expect(health?.healthStatus).toBe('unhealthy');
    });

    it('resets circuit breaker back to CLOSED', async () => {
      await tripCircuitBreaker(db, 'apac', 'Temporary failure');
      const reset = await resetCircuitBreaker(db, 'apac');
      expect(reset).toBe(true);

      const health = await getRegionHealth(db, 'apac');
      expect(health?.circuitBreakerState).toBe('CLOSED');
      expect(health?.healthStatus).toBe('healthy');
      expect(health?.errorRatePct).toBe(0.0);
    });

    it('automatically transitions circuit breaker based on telemetry update', async () => {
      const now = NOW;

      // Telemetry update with 60% error rate -> trips OPEN
      const severeUpdate = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 60.0,
        p95LatencyMs: 2800,
        probeTimestamp: now,
      });

      expect(severeUpdate.circuitBreakerState).toBe('OPEN');
      expect(severeUpdate.healthStatus).toBe('unhealthy');

      // Before cooldown elapses (e.g. 100s < 300s): remains OPEN
      const earlyProbe = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 0.0,
        p95LatencyMs: 190,
        probeTimestamp: now + 100,
      });
      expect(earlyProbe.circuitBreakerState).toBe('OPEN');

      // After cooldown elapses (301s >= 300s): enters HALF_OPEN (1st success)
      const halfOpenProbe = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 0.0,
        p95LatencyMs: 190,
        probeTimestamp: now + 301,
      });
      expect(halfOpenProbe.circuitBreakerState).toBe('HALF_OPEN');

      // Second successful probe in HALF_OPEN (2nd success)
      const secondSuccessProbe = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 0.0,
        p95LatencyMs: 190,
        probeTimestamp: now + 310,
      });
      expect(secondSuccessProbe.circuitBreakerState).toBe('HALF_OPEN');

      // Third successful probe in HALF_OPEN (3rd success) -> closes to CLOSED
      const recoveredUpdate = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 0.0,
        p95LatencyMs: 190,
        probeTimestamp: now + 320,
      });

      expect(recoveredUpdate.circuitBreakerState).toBe('CLOSED');
      expect(recoveredUpdate.healthStatus).toBe('healthy');
    });

    it('returns all regions health list', async () => {
      const allHealth = await getRegionsHealth(db);
      expect(allHealth).toHaveLength(3);
      const regions = allHealth.map((h) => h.region).sort();
      expect(regions).toEqual(['apac', 'eu', 'us']);
    });
  });
});
