/**
 * Empirical Challenger Test Suite: Milestone 3 Failover Mesh & SLA Degradation Adversarial Harness
 *
 * Independent empirical stress testing of:
 * 1. Multi-Region Latency Routing:
 *    - APAC healthy (0 hops, PRIMARY_HEALTHY)
 *    - APAC degraded (>1500ms SLA ceiling) -> failover to US (1 hop)
 *    - APAC & US degraded -> cascading failover to EU (2 hops)
 *    - All regions degraded -> deterministic best-effort fallback to lowest error rate
 *    - Circuit breaker OPEN regions excluded from candidate routing and best-effort prioritization
 * 2. Regional Circuit Breaker State Machine:
 *    - Trip to OPEN on failure rate >= 50%
 *    - Trip to OPEN on P95 latency > 2500ms
 *    - Strict candidate routing exclusion while OPEN
 *    - Manual / programmatic reset drill back to CLOSED (0% error rate, healthy)
 *    - Adversarial probe: OPEN -> HALF_OPEN transition and cooldown period (300s) enforcement
 *    - Adversarial probe: Consecutive successes requirement before closing
 * 3. Automated SLA Degradation Monitor & Sliding Window SLI Breaches:
 *    - 15-minute sliding window boundary filtering (older jobs excluded)
 *    - Availability breach (< 99.9% uptime target)
 *    - Latency P95 breach (> 1500ms ceiling)
 *    - Cascading failover breach (>= 20% jobs with 2+ hops)
 *    - Idle window handling (zero division protection)
 * 4. Dual-Rail Compensation & Cron Disbursement Stress:
 *    - Dry-run mode non-mutation guarantee
 *    - MCU credit deduction in enterprise reservation and audit logging
 *    - Adversarial probe: USDT refund rail ledger entry and refund_ledger_id verification
 *    - Adversarial probe: Overlapping sliding window scan idempotency and duplicate disbursement
 *
 * @vitest-environment node
 * @module __tests__/integration/enterprise/m3-adversarial-challenger.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import type {
  EnterpriseGpuReservation,
  GpuMeshRegion,
  CircuitBreakerState,
  RegionHealthStatus,
  SlaDegradationIncident,
  SlaDegradationIncidentRow,
} from '@/seed/types/gpu-mesh';
import {
  GPU_MESH_SLA_CONFIG,
  GPU_MESH_CIRCUIT_BREAKER_CONFIG,
} from '@/seed/config/gpu-mesh';
import {
  resolveOptimalRegion,
  getRegionsHealth,
  getRegionHealth,
  updateRegionHealthTelemetry,
  tripCircuitBreaker,
  resetCircuitBreaker,
} from '@/tree/gpu-mesh/multi-region-router';
import {
  calculateP95Latency,
  calculateAvailability,
  calculateSlaCompensation,
  measureReservationSli,
  evaluateSlaDegradation,
} from '@/tree/sla/sla-degradation-calculator';
import {
  runSlaRefundMonitorScan,
  processSingleIncident,
} from '@/forest/jobs/sla-refund-monitor-cron';

function createAdversarialD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enterprise_gpu_reservations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      deal_id TEXT,
      contract_id TEXT,
      lane_id TEXT NOT NULL UNIQUE,
      primary_region TEXT NOT NULL DEFAULT 'apac',
      fallback_regions TEXT NOT NULL DEFAULT '["us", "eu"]',
      reserved_units INTEGER NOT NULL DEFAULT 5,
      concurrency_limit INTEGER NOT NULL DEFAULT 20,
      mcu_monthly_allocation INTEGER NOT NULL DEFAULT 100000,
      mcu_consumed INTEGER NOT NULL DEFAULT 0,
      priority_score INTEGER NOT NULL DEFAULT 300,
      status TEXT NOT NULL DEFAULT 'active',
      sla_uptime_target REAL NOT NULL DEFAULT 0.999,
      sla_p95_latency_ms INTEGER NOT NULL DEFAULT 1500,
      sla_degradation_window_secs INTEGER NOT NULL DEFAULT 900,
      sla_refund_pct REAL NOT NULL DEFAULT 10.0,
      allocated_providers TEXT NOT NULL DEFAULT '["fal", "runpod", "mekong"]',
      active_from INTEGER NOT NULL,
      active_until INTEGER NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS video_render_jobs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      subaccount_id TEXT,
      lane TEXT NOT NULL DEFAULT 'priority',
      priority_score INTEGER NOT NULL DEFAULT 300,
      status TEXT NOT NULL DEFAULT 'completed',
      tier TEXT NOT NULL,
      payload TEXT NOT NULL,
      result_url TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      leased_by TEXT,
      leased_until INTEGER,
      provider TEXT,
      dlq_reason TEXT,
      reservation_id TEXT,
      target_region TEXT DEFAULT 'apac',
      executed_region TEXT,
      failover_hops INTEGER DEFAULT 0,
      execution_latency_ms INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sla_degradation_incidents (
      id TEXT PRIMARY KEY,
      reservation_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      breach_type TEXT NOT NULL,
      region TEXT NOT NULL,
      target_threshold REAL NOT NULL,
      measured_value REAL NOT NULL,
      started_at INTEGER NOT NULL,
      resolved_at INTEGER,
      duration_seconds INTEGER,
      impacted_jobs_count INTEGER NOT NULL DEFAULT 0,
      credit_amount_cents INTEGER NOT NULL DEFAULT 0,
      compensation_rail TEXT NOT NULL DEFAULT 'MCU_CREDIT',
      refund_status TEXT NOT NULL DEFAULT 'pending',
      refund_ledger_id TEXT,
      detected_by TEXT NOT NULL,
      resolution_notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcu_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refund_ledger (
      id TEXT PRIMARY KEY,
      refund_request_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      purchase_id TEXT NOT NULL,
      payment_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      tier_before TEXT NOT NULL DEFAULT 'BASIC',
      tier_after TEXT NOT NULL DEFAULT 'BASIC',
      mcu_clawed_back INTEGER NOT NULL DEFAULT 0,
      tx_hash TEXT,
      created_at INTEGER NOT NULL
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

describe('Empirical Challenger: M3 Failover Mesh & SLA Monitor Adversarial Suite', () => {
  let db: D1Database;
  const NOW = 1760000000;
  const ORG_ID = 'org_challenger_ent';
  const RESERVATION_ID = 'res_challenger_m3';

  const defaultReservation: EnterpriseGpuReservation = {
    id: RESERVATION_ID,
    orgId: ORG_ID,
    laneId: 'lane_challenger_01',
    primaryRegion: 'apac',
    fallbackRegions: ['us', 'eu'],
    reservedUnits: 5,
    concurrencyLimit: 20,
    mcuMonthlyAllocation: 100000,
    mcuConsumed: 20000,
    priorityScore: 300,
    status: 'active',
    slaUptimeTarget: 0.999,
    slaP95LatencyMs: 1500,
    slaDegradationWindowSecs: 900,
    slaRefundPct: 10.0,
    allocatedProviders: ['fal', 'runpod', 'mekong'],
    activeFrom: NOW - 10000,
    activeUntil: NOW + 100000,
    metadata: { monthlyPriceCents: 50000 },
    createdAt: NOW - 10000,
    updatedAt: NOW - 10000,
  };

  beforeEach(async () => {
    db = createAdversarialD1();

    await db
      .prepare('INSERT INTO organizations (id, name) VALUES (?, ?)')
      .bind(ORG_ID, 'Challenger Enterprise Corp')
      .run();

    await db
      .prepare(
        `INSERT INTO enterprise_gpu_reservations (
          id, org_id, lane_id, primary_region, fallback_regions,
          reserved_units, concurrency_limit, mcu_monthly_allocation, mcu_consumed,
          priority_score, status, sla_uptime_target, sla_p95_latency_ms,
          sla_degradation_window_secs, sla_refund_pct, allocated_providers,
          active_from, active_until, metadata, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, '["us", "eu"]',
          5, 20, 100000, 20000,
          300, 'active', 0.999, 1500,
          900, 10.0, '["fal", "runpod", "mekong"]',
          ?, ?, '{"monthlyPriceCents": 50000}', ?, ?
        )`,
      )
      .bind(
        RESERVATION_ID,
        ORG_ID,
        defaultReservation.laneId,
        defaultReservation.primaryRegion,
        defaultReservation.activeFrom,
        defaultReservation.activeUntil,
        NOW - 10000,
        NOW - 10000,
      )
      .run();

    // Seed default healthy regions: APAC (220ms), US (180ms), EU (210ms)
    await db
      .prepare(
        `INSERT INTO gpu_mesh_region_health (
          region, health_status, p95_latency_ms, error_rate_pct,
          active_reservations, available_capacity_pct, circuit_breaker_state,
          last_probe_at, probe_details, updated_at
        ) VALUES
          ('apac', 'healthy', 220, 0.0, 1, 95.0, 'CLOSED', ?, '{}', ?),
          ('us', 'healthy', 180, 0.0, 0, 100.0, 'CLOSED', ?, '{}', ?),
          ('eu', 'healthy', 210, 0.0, 0, 100.0, 'CLOSED', ?, '{}', ?)`,
      )
      .bind(NOW, NOW, NOW, NOW, NOW, NOW)
      .run();
  });

  // ============================================================================
  // 1. MULTI-REGION LATENCY ROUTING HARNESS
  // ============================================================================
  describe('1. Multi-Region Latency Routing Harness', () => {
    it('1.1 Primary APAC healthy: routes to APAC with 0 failover hops and PRIMARY_HEALTHY reason', async () => {
      const route = await resolveOptimalRegion(db, defaultReservation);

      expect(route.selectedRegion).toBe('apac');
      expect(route.isFailover).toBe(false);
      expect(route.failoverHops).toBe(0);
      expect(route.reason).toBe('PRIMARY_HEALTHY');
      expect(route.p95LatencyMs).toBe(220);
      expect(route.circuitBreakerState).toBe('CLOSED');
    });

    it('1.2 APAC degraded (>1500ms): routes to US with 1 failover hop', async () => {
      // Degrade APAC to 1800ms (> 1500ms ceiling)
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 1800, health_status = 'degraded' WHERE region = 'apac'")
        .run();

      const route = await resolveOptimalRegion(db, defaultReservation);

      expect(route.selectedRegion).toBe('us');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(1);
      expect(route.reason).toBe('FAILOVER_FROM_APAC');
      expect(route.p95LatencyMs).toBe(180);
    });

    it('1.3 APAC & US both degraded: cascades to EU with 2 failover hops', async () => {
      // Degrade APAC (1800ms) and US (1600ms)
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 1800 WHERE region = 'apac'")
        .run();
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 1600 WHERE region = 'us'")
        .run();

      const route = await resolveOptimalRegion(db, defaultReservation);

      expect(route.selectedRegion).toBe('eu');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(2);
      expect(route.reason).toBe('FAILOVER_FROM_APAC');
      expect(route.p95LatencyMs).toBe(210);
    });

    it('1.4 All regions degraded: asserts best-effort routing to lowest-error region', async () => {
      // All regions breach SLA (>1500ms): APAC=2200ms (30% err), US=2000ms (15% err), EU=1900ms (5% err)
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 2200, error_rate_pct = 30.0, health_status = 'unhealthy' WHERE region = 'apac'")
        .run();
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 2000, error_rate_pct = 15.0, health_status = 'unhealthy' WHERE region = 'us'")
        .run();
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 1900, error_rate_pct = 5.0, health_status = 'unhealthy' WHERE region = 'eu'")
        .run();

      const route = await resolveOptimalRegion(db, defaultReservation);

      // EU has lowest error rate (5%)
      expect(route.selectedRegion).toBe('eu');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(3);
      expect(route.reason).toBe('ALL_REGIONS_DEGRADED_BEST_EFFORT');
      expect(route.p95LatencyMs).toBe(1900);
    });

    it('1.5 Circuit breaker OPEN region is strictly deprioritized even with 0% error rate in degraded fallback', async () => {
      // EU has 0% error rate but circuit breaker OPEN
      // US has 10% error rate and circuit breaker CLOSED
      // APAC has 20% error rate and circuit breaker CLOSED
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 2000, error_rate_pct = 20.0, health_status = 'unhealthy' WHERE region = 'apac'")
        .run();
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 2000, error_rate_pct = 10.0, health_status = 'unhealthy' WHERE region = 'us'")
        .run();
      await db
        .prepare("UPDATE gpu_mesh_region_health SET p95_latency_ms = 2000, error_rate_pct = 0.0, health_status = 'unhealthy', circuit_breaker_state = 'OPEN' WHERE region = 'eu'")
        .run();

      const route = await resolveOptimalRegion(db, defaultReservation);

      // Must select US because EU is OPEN, even though EU had lower error rate!
      expect(route.selectedRegion).toBe('us');
      expect(route.reason).toBe('ALL_REGIONS_DEGRADED_BEST_EFFORT');
    });
  });

  // ============================================================================
  // 2. REGIONAL CIRCUIT BREAKER STATE MACHINE
  // ============================================================================
  describe('2. Regional Circuit Breaker State Machine & Invariants', () => {
    it('2.1 Trips to OPEN when failure rate >= 50%', async () => {
      const result = await updateRegionHealthTelemetry(db, {
        region: 'apac',
        errorRatePct: 50.0,
      });

      expect(result.circuitBreakerState).toBe('OPEN');
      expect(result.healthStatus).toBe('unhealthy');

      const persisted = await getRegionHealth(db, 'apac');
      expect(persisted?.circuitBreakerState).toBe('OPEN');
    });

    it('2.2 Trips to OPEN when P95 latency > 2500ms', async () => {
      const result = await updateRegionHealthTelemetry(db, {
        region: 'us',
        p95LatencyMs: 2501,
        errorRatePct: 0.0,
      });

      expect(result.circuitBreakerState).toBe('OPEN');
      expect(result.healthStatus).toBe('unhealthy');
    });

    it('2.3 Strictly excludes OPEN regions from candidate routing', async () => {
      await tripCircuitBreaker(db, 'apac', 'Simulated regional power loss');

      const route = await resolveOptimalRegion(db, defaultReservation);
      expect(route.selectedRegion).not.toBe('apac');
      expect(route.selectedRegion).toBe('us');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(1);
    });

    it('2.4 SRE reset drill restores region to CLOSED, healthy, and clears error rate', async () => {
      await tripCircuitBreaker(db, 'apac', 'Manual test drill');
      expect((await getRegionHealth(db, 'apac'))?.circuitBreakerState).toBe('OPEN');

      const resetOk = await resetCircuitBreaker(db, 'apac');
      expect(resetOk).toBe(true);

      const health = await getRegionHealth(db, 'apac');
      expect(health?.circuitBreakerState).toBe('CLOSED');
      expect(health?.healthStatus).toBe('healthy');
      expect(health?.errorRatePct).toBe(0.0);
    });

    it('2.5 Circuit breaker enforces 300s cooldown from OPEN to HALF_OPEN and requires 3 consecutive successes before CLOSED', async () => {
      // Step 1: Trip circuit to OPEN
      await tripCircuitBreaker(db, 'us', 'Adversarial probe trip', NOW);
      let health = await getRegionHealth(db, 'us');
      expect(health?.circuitBreakerState).toBe('OPEN');

      // Step 2: Probe before cooldown elapses (NOW + 100s < 300s)
      // Even with healthy telemetry, circuit MUST remain OPEN during cooldown
      const earlyProbe = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 0.0,
        p95LatencyMs: 180,
        probeTimestamp: NOW + 100,
      });
      expect(earlyProbe.circuitBreakerState).toBe('OPEN');
      expect(earlyProbe.healthStatus).toBe('unhealthy');

      // Step 3: Probe after cooldown elapses (NOW + 301s >= 300s) with healthy telemetry
      // Must transition from OPEN -> HALF_OPEN (1st success)
      const firstSuccess = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 0.0,
        p95LatencyMs: 180,
        probeTimestamp: NOW + 301,
      });
      expect(firstSuccess.circuitBreakerState).toBe('HALF_OPEN');
      expect(firstSuccess.healthStatus).toBe('degraded');

      // Step 4: Second healthy probe in HALF_OPEN (2nd success)
      // Must remain in HALF_OPEN because consecutiveSuccessesToClose is 3
      const secondSuccess = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 0.0,
        p95LatencyMs: 180,
        probeTimestamp: NOW + 310,
      });
      expect(secondSuccess.circuitBreakerState).toBe('HALF_OPEN');

      // Step 5: Third healthy probe in HALF_OPEN (3rd success)
      // Must transition to CLOSED and healthy
      const thirdSuccess = await updateRegionHealthTelemetry(db, {
        region: 'us',
        errorRatePct: 0.0,
        p95LatencyMs: 180,
        probeTimestamp: NOW + 320,
      });
      expect(thirdSuccess.circuitBreakerState).toBe('CLOSED');
      expect(thirdSuccess.healthStatus).toBe('healthy');
    });
  });

  // ============================================================================
  // 3. AUTOMATED SLA DEGRADATION MONITOR CRON & SLIDING WINDOW SLI BREACHES
  // ============================================================================
  describe('3. Automated SLA Degradation Monitor & Sliding Window SLIs', () => {
    it('3.1 15-minute sliding window boundary: excludes jobs outside the 900-second window', async () => {
      // Job 1: 950 seconds ago (outside window) -> failed
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
          ) VALUES ('job_old_fail', ?, 'failed', 'ENTERPRISE', '{}', ?, 1800, ?, ?)`,
        )
        .bind(ORG_ID, RESERVATION_ID, NOW - 1000, NOW - 950)
        .run();

      // Job 2: 300 seconds ago (inside window) -> completed (250ms)
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
          ) VALUES ('job_new_ok', ?, 'completed', 'ENTERPRISE', '{}', ?, 250, ?, ?)`,
        )
        .bind(ORG_ID, RESERVATION_ID, NOW - 400, NOW - 300)
        .run();

      const sli = await measureReservationSli(db, defaultReservation, 900, NOW);

      expect(sli.totalJobs).toBe(1);
      expect(sli.successfulJobs).toBe(1);
      expect(sli.failedJobs).toBe(0);
      expect(sli.availabilityRatio).toBe(1.0);
      expect(sli.breaches).toHaveLength(0);
    });

    it('3.2 Availability breach: detects uptime drop below 99.9% target', async () => {
      // 9 successful, 1 failed (90% availability < 99.9%)
      for (let i = 1; i <= 9; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'completed', 'ENTERPRISE', '{}', ?, 300, ?, ?)`,
          )
          .bind(`job_avail_ok_${i}`, ORG_ID, RESERVATION_ID, NOW - 400, NOW - 100)
          .run();
      }
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
          ) VALUES ('job_avail_fail_1', ?, 'failed', 'ENTERPRISE', '{}', ?, 500, ?, ?)`,
        )
        .bind(ORG_ID, RESERVATION_ID, NOW - 300, NOW - 50)
        .run();

      const sli = await measureReservationSli(db, defaultReservation, 900, NOW);
      expect(sli.availabilityRatio).toBe(0.9);

      const breach = sli.breaches.find((b) => b.breachType === 'uptime');
      expect(breach).toBeDefined();
      expect(breach?.measuredValue).toBe(0.9);
      expect(breach?.targetThreshold).toBe(0.999);
    });

    it('3.3 Latency P95 breach: detects latency exceeding 1500ms ceiling', async () => {
      // 20 jobs where P95 is 2400ms
      for (let i = 1; i <= 20; i++) {
        const lat = i <= 18 ? 400 : 2400;
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'completed', 'ENTERPRISE', '{}', ?, ?, ?, ?)`,
          )
          .bind(`job_lat_p95_${i}`, ORG_ID, RESERVATION_ID, lat, NOW - 300, NOW - 50)
          .run();
      }

      const sli = await measureReservationSli(db, defaultReservation, 900, NOW);
      expect(sli.p95LatencyMs).toBe(2400);

      const breach = sli.breaches.find((b) => b.breachType === 'latency_p95');
      expect(breach).toBeDefined();
      expect(breach?.measuredValue).toBe(2400);
      expect(breach?.targetThreshold).toBe(1500);
    });

    it('3.4 Cascading failover breach: detects >= 20% jobs with 2+ hops', async () => {
      for (let i = 1; i <= 10; i++) {
        const hops = i <= 2 ? 2 : 0;
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, status, tier, payload, reservation_id, failover_hops, execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'completed', 'ENTERPRISE', '{}', ?, ?, 350, ?, ?)`,
          )
          .bind(`job_cascade_${i}`, ORG_ID, RESERVATION_ID, hops, NOW - 300, NOW - 50)
          .run();
      }

      const sli = await measureReservationSli(db, defaultReservation, 900, NOW);
      expect(sli.cascadingFailoverJobs).toBe(2);

      const breach = sli.breaches.find((b) => b.breachType === 'cascading_failover');
      expect(breach).toBeDefined();
      expect(breach?.measuredValue).toBe(0.2); // 2/10 = 20%
    });
  });

  // ============================================================================
  // 4. DUAL-RAIL COMPENSATION & CRON DISBURSEMENT STRESS
  // ============================================================================
  describe('4. Dual-Rail Compensation & Cron Disbursement Stress', () => {
    it('4.1 Dry-Run mode calculates compensation without altering database state', async () => {
      // Seed failing job
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
          ) VALUES ('job_dry_test', ?, 'failed', 'ENTERPRISE', '{}', ?, 1800, ?, ?)`,
        )
        .bind(ORG_ID, RESERVATION_ID, NOW - 200, NOW - 50)
        .run();

      const summary = await runSlaRefundMonitorScan(db, {
        nowSeconds: NOW,
        windowSeconds: 900,
        dryRun: true,
      });

      expect(summary.scannedReservations).toBe(1);
      expect(summary.incidentsDetected).toBeGreaterThanOrEqual(1);
      expect(summary.incidentsDisbursed).toBe(0);
      expect(summary.totalCompensationMcu).toBeGreaterThan(0);

      // Verify ZERO incidents in DB
      const countRes = await db
        .prepare('SELECT COUNT(*) as count FROM sla_degradation_incidents')
        .first<{ count: number }>();
      expect(countRes?.count).toBe(0);

      // Verify mcu_consumed unchanged
      const resRow = await db
        .prepare('SELECT mcu_consumed FROM enterprise_gpu_reservations WHERE id = ?')
        .bind(RESERVATION_ID)
        .first<{ mcu_consumed: number }>();
      expect(resRow?.mcu_consumed).toBe(20000);
    });

    it('4.2 MCU credit compensation rebates consumed quota and logs transaction', async () => {
      // Seed failing job with latency 400ms (within 1500ms ceiling) to trigger ONLY uptime breach
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
          ) VALUES ('job_mcu_disburse', ?, 'failed', 'ENTERPRISE', '{}', ?, 400, ?, ?)`,
        )
        .bind(ORG_ID, RESERVATION_ID, NOW - 200, NOW - 50)
        .run();

      const summary = await runSlaRefundMonitorScan(db, {
        nowSeconds: NOW,
        windowSeconds: 900,
        dryRun: false,
      });

      expect(summary.incidentsDisbursed).toBe(1);
      expect(summary.totalCompensationMcu).toBe(10500); // 100,000 * 10% + 1 * 500 = 10,500 MCU

      // Verify incident persisted with 'disbursed' status
      const incidents = await db
        .prepare('SELECT * FROM sla_degradation_incidents WHERE reservation_id = ?')
        .bind(RESERVATION_ID)
        .all<SlaDegradationIncidentRow>();
      expect(incidents.results).toHaveLength(1);
      expect(incidents.results?.[0].refund_status).toBe('disbursed');

      // Verify mcu_consumed was decremented: 20000 - 10500 = 9500
      const updatedRes = await db
        .prepare('SELECT mcu_consumed FROM enterprise_gpu_reservations WHERE id = ?')
        .bind(RESERVATION_ID)
        .first<{ mcu_consumed: number }>();
      expect(updatedRes?.mcu_consumed).toBe(9500);

      // Verify mcu_transactions audit record exists
      const txRes = await db
        .prepare('SELECT * FROM mcu_transactions WHERE user_id = ?')
        .bind(ORG_ID)
        .all<{ delta: number; reason: string }>();
      expect(txRes.results?.length).toBeGreaterThanOrEqual(1);
      expect(txRes.results?.[0].delta).toBe(10500);
      expect(txRes.results?.[0].reason).toBe('SLA_DEGRADATION_COMPENSATION');
    });

    it('4.3 USDT Refund Rail records transaction in refund_ledger and links refund_ledger_id in incident', async () => {
      // Simulate an incident with compensation_rail = 'USDT_REFUND'
      const incidentId = 'sdi_test_usdt_rail';
      const now = NOW;

      const incident: SlaDegradationIncident = {
        id: incidentId,
        reservationId: RESERVATION_ID,
        orgId: ORG_ID,
        breachType: 'uptime',
        region: 'apac',
        targetThreshold: 0.999,
        measuredValue: 0.9,
        startedAt: now - 900,
        resolvedAt: null,
        durationSeconds: 900,
        impactedJobsCount: 2,
        creditAmountCents: 5050,
        compensationRail: 'USDT_REFUND',
        refundStatus: 'pending',
        refundLedgerId: null,
        detectedBy: 'test_runner',
        resolutionNotes: null,
        createdAt: now,
        updatedAt: now,
      };

      // Process the incident via the automated cron engine
      const processResult = await processSingleIncident(db, incident, now, 900);

      expect(processResult.skipped).toBeFalsy();
      expect(processResult.centsDelta).toBe(5050);
      expect(processResult.refundLedgerId).toBeDefined();

      // 1. Verify refund_ledger row was genuinely inserted
      const refundRows = await db
        .prepare('SELECT * FROM refund_ledger WHERE id = ?1')
        .bind(processResult.refundLedgerId)
        .all<{ id: string; user_id: string; amount_cents: number; tx_hash: string }>();
      expect(refundRows.results).toHaveLength(1);
      expect(refundRows.results?.[0].user_id).toBe(ORG_ID);
      expect(refundRows.results?.[0].amount_cents).toBe(5050);
      expect(refundRows.results?.[0].tx_hash).toBe('SLA_DEGRADATION');

      // 2. Verify incident in D1 links refund_ledger_id and marked disbursed
      const incidentRow = await db
        .prepare('SELECT * FROM sla_degradation_incidents WHERE id = ?')
        .bind(incidentId)
        .first<{ refund_status: string; refund_ledger_id: string | null }>();

      expect(incidentRow?.refund_status).toBe('disbursed');
      expect(incidentRow?.refund_ledger_id).toBe(processResult.refundLedgerId);
    });

    it('4.4 Cron enforces sliding window deduplication preventing duplicate compensations on successive scans', async () => {
      // Seed 1 failing job with latency 400ms that persists in the 15-minute sliding window
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
          ) VALUES ('job_repeating_outage', ?, 'failed', 'ENTERPRISE', '{}', ?, 400, ?, ?)`,
        )
        .bind(ORG_ID, RESERVATION_ID, NOW - 300, NOW - 100)
        .run();

      // First cron scan at T0 (e.g. 12:00)
      const scan1 = await runSlaRefundMonitorScan(db, {
        nowSeconds: NOW,
        windowSeconds: 900,
        dryRun: false,
      });

      expect(scan1.incidentsDetected).toBe(1);
      expect(scan1.incidentsDisbursed).toBe(1);
      const compensation1 = scan1.totalCompensationMcu;
      expect(compensation1).toBe(10500);

      // Reservation balance after first scan: 20000 - 10500 = 9500
      let resRow = await db
        .prepare('SELECT mcu_consumed FROM enterprise_gpu_reservations WHERE id = ?')
        .bind(RESERVATION_ID)
        .first<{ mcu_consumed: number }>();
      expect(resRow?.mcu_consumed).toBe(9500);

      // Second cron scan 60 seconds later at T0 + 60s (e.g. 12:01)
      // The same job from NOW-100 is STILL in the sliding 15-minute window!
      const scan2 = await runSlaRefundMonitorScan(db, {
        nowSeconds: NOW + 60,
        windowSeconds: 900,
        dryRun: false,
      });

      // DEDUPLICATION VERIFIED: The cron skips duplicate incident within the sliding window!
      // It does NOT disburse a second refund for the same outage!
      expect(scan2.incidentsDetected).toBe(1);
      expect(scan2.incidentsDisbursed).toBe(0);
      expect(scan2.totalCompensationMcu).toBe(0);

      // Reservation balance remains 9500 (NOT drained to 0!)
      resRow = await db
        .prepare('SELECT mcu_consumed FROM enterprise_gpu_reservations WHERE id = ?')
        .bind(RESERVATION_ID)
        .first<{ mcu_consumed: number }>();
      expect(resRow?.mcu_consumed).toBe(9500);

      // Only 1 incident created in D1 for this outage window!
      const incidentsCount = await db
        .prepare('SELECT COUNT(*) as count FROM sla_degradation_incidents WHERE reservation_id = ?')
        .bind(RESERVATION_ID)
        .first<{ count: number }>();
      expect(incidentsCount?.count).toBe(1);
    });
  });
});
