/**
 * Enterprise SLA Degradation & SLI Monitor Unit Tests
 *
 * Validates:
 * - Pure P95 latency and availability calculations
 * - 15-minute sliding window SLI measurements
 * - Breaches: Uptime (< 99.9%), Latency (> 1500ms), Cascading Failovers
 * - Dual-rail compensation calculation (MCU credits vs USDT refunds)
 * - Automated forest cron orchestrator scan and compensation disbursement
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import {
  calculateP95Latency,
  calculateAvailability,
  calculateSlaCompensation,
  measureReservationSli,
  evaluateSlaDegradation,
} from '@/tree/sla/sla-degradation-calculator';
import { runSlaRefundMonitorScan } from '@/forest/jobs/sla-refund-monitor-cron';
import type { EnterpriseGpuReservation } from '@/seed/types/gpu-mesh';

function createTestD1(): D1Database {
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

describe('Enterprise SLA Degradation & Refund Monitor', () => {
  let db: D1Database;
  const NOW = 1760000000;
  const ORG_ID = 'org_sla_corp';
  const RESERVATION_ID = 'egr_sla_test_1';

  const mockReservation: EnterpriseGpuReservation = {
    id: RESERVATION_ID,
    orgId: ORG_ID,
    laneId: 'lane_sla_01',
    primaryRegion: 'apac',
    fallbackRegions: ['us', 'eu'],
    reservedUnits: 5,
    concurrencyLimit: 20,
    mcuMonthlyAllocation: 100000,
    mcuConsumed: 15000,
    priorityScore: 300,
    status: 'active',
    slaUptimeTarget: 0.999, // 99.9%
    slaP95LatencyMs: 1500, // 1500ms
    slaDegradationWindowSecs: 900,
    slaRefundPct: 10.0, // 10%
    allocatedProviders: ['fal', 'runpod'],
    activeFrom: NOW - 5000,
    activeUntil: NOW + 100000,
    metadata: { monthlyPriceCents: 50000 }, // $500/mo
    createdAt: NOW - 5000,
    updatedAt: NOW - 5000,
  };

  beforeEach(async () => {
    db = createTestD1();

    await db
      .prepare('INSERT INTO organizations (id, name) VALUES (?, ?)')
      .bind(ORG_ID, 'SLA Monitored Enterprise')
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
          5, 20, 100000, 15000,
          300, 'active', 0.999, 1500,
          900, 10.0, '["fal", "runpod"]',
          ?, ?, '{"monthlyPriceCents": 50000}', ?, ?
        )`,
      )
      .bind(
        RESERVATION_ID,
        ORG_ID,
        mockReservation.laneId,
        mockReservation.primaryRegion,
        mockReservation.activeFrom,
        mockReservation.activeUntil,
        NOW - 5000,
        NOW - 5000,
      )
      .run();
  });

  describe('Pure Mathematical SLI Calculations', () => {
    it('calculates P95 latency accurately across distributions', () => {
      expect(calculateP95Latency([])).toBe(0);
      expect(calculateP95Latency([300])).toBe(300);

      // 100 items from 10ms to 1000ms
      const latencies = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
      const p95 = calculateP95Latency(latencies);
      expect(p95).toBe(960);
    });

    it('calculates availability ratio accurately', () => {
      expect(calculateAvailability(0, 0)).toBe(1.0);
      expect(calculateAvailability(100, 100)).toBe(1.0);
      expect(calculateAvailability(99, 100)).toBe(0.99);
      expect(calculateAvailability(999, 1000)).toBe(0.999);
    });

    it('calculates dual-rail compensation for MCU credits and financial refunds', () => {
      const compMcu = calculateSlaCompensation(
        mockReservation,
        'uptime',
        5, // 5 failed jobs
        'MCU_CREDIT',
      );

      // Base MCU: 100,000 * 10% = 10,000. Plus 5 * 500 = 2,500. Total = 12,500 MCU.
      expect(compMcu.compensationMcu).toBe(12500);
      // Base Cents: 50,000 * 10% = 5,000. Plus 5 * 25 = 125. Total = 5,125 cents.
      expect(compMcu.creditAmountCents).toBe(5125);
    });
  });

  describe('Sliding Window SLI Measurement & Breach Detection', () => {
    it('detects no breaches when SLIs meet targets (100% availability, 400ms latency)', async () => {
      // Seed 20 successful jobs with fast latencies (200ms - 500ms) within the last 15 min
      for (let i = 1; i <= 20; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, lane, priority_score, status, tier, payload,
              reservation_id, target_region, executed_region, failover_hops,
              execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'priority', 300, 'completed', 'ENTERPRISE', '{}', ?, 'apac', 'apac', 0, ?, ?, ?)`,
          )
          .bind(`job_ok_${i}`, ORG_ID, RESERVATION_ID, 300 + i * 5, NOW - 300, NOW - 100)
          .run();
      }

      const sli = await measureReservationSli(db, mockReservation, 900, NOW);
      expect(sli.totalJobs).toBe(20);
      expect(sli.successfulJobs).toBe(20);
      expect(sli.failedJobs).toBe(0);
      expect(sli.availabilityRatio).toBe(1.0);
      expect(sli.p95LatencyMs).toBeLessThanOrEqual(500);
      expect(sli.breaches).toHaveLength(0);
    });

    it('detects availability breach when error rate breaches 99.9% target', async () => {
      // Seed 90 successful jobs and 10 failed jobs (90% availability < 99.9%)
      for (let i = 1; i <= 90; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'completed', 'ENTERPRISE', '{}', ?, 400, ?, ?)`,
          )
          .bind(`job_succ_${i}`, ORG_ID, RESERVATION_ID, NOW - 400, NOW - 200)
          .run();
      }
      for (let i = 1; i <= 10; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'failed', 'ENTERPRISE', '{}', ?, 500, ?, ?)`,
          )
          .bind(`job_fail_${i}`, ORG_ID, RESERVATION_ID, NOW - 300, NOW - 100)
          .run();
      }

      const sli = await measureReservationSli(db, mockReservation, 900, NOW);
      expect(sli.totalJobs).toBe(100);
      expect(sli.successfulJobs).toBe(90);
      expect(sli.failedJobs).toBe(10);
      expect(sli.availabilityRatio).toBe(0.9);

      const uptimeBreach = sli.breaches.find((b) => b.breachType === 'uptime');
      expect(uptimeBreach).toBeDefined();
      expect(uptimeBreach?.measuredValue).toBe(0.9);
      expect(uptimeBreach?.targetThreshold).toBe(0.999);
    });

    it('detects P95 latency ceiling breach when P95 exceeds 1500ms', async () => {
      // Seed jobs where P95 is 2200ms
      for (let i = 1; i <= 20; i++) {
        const latency = i <= 18 ? 800 : 2200;
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'completed', 'ENTERPRISE', '{}', ?, ?, ?, ?)`,
          )
          .bind(`job_lat_${i}`, ORG_ID, RESERVATION_ID, latency, NOW - 300, NOW - 100)
          .run();
      }

      const sli = await measureReservationSli(db, mockReservation, 900, NOW);
      expect(sli.p95LatencyMs).toBe(2200);

      const latencyBreach = sli.breaches.find((b) => b.breachType === 'latency_p95');
      expect(latencyBreach).toBeDefined();
      expect(latencyBreach?.measuredValue).toBe(2200);
      expect(latencyBreach?.targetThreshold).toBe(1500);
    });

    it('detects cascading failover breach when 2+ hops occur on >= 20% of jobs', async () => {
      // Seed jobs with failover_hops >= 2
      for (let i = 1; i <= 10; i++) {
        const hops = i <= 3 ? 2 : 0;
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, status, tier, payload, reservation_id, failover_hops, execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'completed', 'ENTERPRISE', '{}', ?, ?, 500, ?, ?)`,
          )
          .bind(`job_hop_${i}`, ORG_ID, RESERVATION_ID, hops, NOW - 300, NOW - 100)
          .run();
      }

      const sli = await measureReservationSli(db, mockReservation, 900, NOW);
      expect(sli.cascadingFailoverJobs).toBe(3);

      const cascadeBreach = sli.breaches.find((b) => b.breachType === 'cascading_failover');
      expect(cascadeBreach).toBeDefined();
      expect(cascadeBreach?.measuredValue).toBe(0.3); // 3/10 = 30% >= 20%
    });
  });

  describe('Forest Cron Orchestrator: runSlaRefundMonitorScan', () => {
    it('scans reservations, persists incidents, and disburses automatic compensation', async () => {
      // Seed failing jobs to trigger breach
      for (let i = 1; i <= 5; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
            ) VALUES (?, ?, 'failed', 'ENTERPRISE', '{}', ?, 1800, ?, ?)`,
          )
          .bind(`job_fail_cron_${i}`, ORG_ID, RESERVATION_ID, NOW - 200, NOW - 50)
          .run();
      }

      const summary = await runSlaRefundMonitorScan(db, {
        nowSeconds: NOW,
        windowSeconds: 900,
        dryRun: false,
      });

      expect(summary.scannedReservations).toBe(1);
      expect(summary.incidentsDetected).toBeGreaterThanOrEqual(1);
      expect(summary.incidentsDisbursed).toBeGreaterThanOrEqual(1);
      expect(summary.totalCompensationMcu).toBeGreaterThan(0);
      expect(summary.errors).toHaveLength(0);

      // Verify incident persisted in D1
      const incidents = await db
        .prepare('SELECT * FROM sla_degradation_incidents WHERE reservation_id = ?')
        .bind(RESERVATION_ID)
        .all<{ id: string; breach_type: string; refund_status: string }>();

      expect(incidents.results).toBeDefined();
      expect(incidents.results?.length).toBeGreaterThanOrEqual(1);
      expect(incidents.results?.[0].refund_status).toBe('disbursed');

      // Verify mcu_consumed was decremented / quota rebated
      const updatedRes = await db
        .prepare('SELECT mcu_consumed FROM enterprise_gpu_reservations WHERE id = ?')
        .bind(RESERVATION_ID)
        .first<{ mcu_consumed: number }>();

      expect(updatedRes?.mcu_consumed).toBeLessThan(15000);
    });

    it('respects dryRun option without modifying state', async () => {
      // Seed failing job
      await db
        .prepare(
          `INSERT INTO video_render_jobs (
            id, org_id, status, tier, payload, reservation_id, execution_latency_ms, created_at, updated_at
          ) VALUES (?, ?, 'failed', 'ENTERPRISE', '{}', ?, 1800, ?, ?)`,
        )
        .bind('job_dry_1', ORG_ID, RESERVATION_ID, NOW - 200, NOW - 50)
        .run();

      const summary = await runSlaRefundMonitorScan(db, {
        nowSeconds: NOW,
        windowSeconds: 900,
        dryRun: true,
      });

      expect(summary.incidentsDetected).toBeGreaterThanOrEqual(1);
      expect(summary.incidentsDisbursed).toBe(0);

      const incidentCount = await db
        .prepare('SELECT COUNT(*) as count FROM sla_degradation_incidents')
        .first<{ count: number }>();

      expect(incidentCount?.count).toBe(0);
    });
  });
});
