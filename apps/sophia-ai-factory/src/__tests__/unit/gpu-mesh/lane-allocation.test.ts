/**
 * Dedicated Enterprise GPU Lane Allocation Unit Tests
 *
 * Validates:
 * - Priority score elevation to 300 for dedicated enterprise lane
 * - Lane isolation (priority lane assignment)
 * - Concurrency quota enforcement (default 20 concurrent jobs)
 * - Reservation capacity and MCU monthly allocation constraints
 * - Expiration, activation window, and status state checks
 * - Active render count tracking and release logic
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import {
  allocateDedicatedLane,
  releaseDedicatedLane,
  getReservationById,
  getReservationByLaneId,
  getActiveReservationForOrg,
  validateReservationCapacity,
  getReservationActiveJobCount,
} from '@/tree/gpu-mesh/dedicated-lane-allocator';
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
      lane TEXT NOT NULL DEFAULT 'standard',
      priority_score INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'queued',
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

describe('Dedicated Enterprise GPU Lane Allocator', () => {
  let db: D1Database;
  const NOW = 1760000000;
  const ORG_ID = 'org_enterprise_corp';
  const RESERVATION_ID = 'egr_test_reservation_1';
  const LANE_ID = 'lane_dedicated_ent_01';

  beforeEach(async () => {
    db = createTestD1();

    // Seed org
    await db
      .prepare('INSERT INTO organizations (id, name) VALUES (?, ?)')
      .bind(ORG_ID, 'Global Enterprise Media Inc')
      .run();

    // Seed active reservation
    await db
      .prepare(
        `INSERT INTO enterprise_gpu_reservations (
          id, org_id, lane_id, primary_region, fallback_regions,
          reserved_units, concurrency_limit, mcu_monthly_allocation, mcu_consumed,
          priority_score, status, sla_uptime_target, sla_p95_latency_ms,
          sla_degradation_window_secs, sla_refund_pct, allocated_providers,
          active_from, active_until, metadata, created_at, updated_at
        ) VALUES (
          ?, ?, ?, 'apac', '["us", "eu"]',
          5, 20, 100000, 10000,
          300, 'active', 0.999, 1500,
          900, 10.0, '["fal", "runpod", "mekong"]',
          ?, ?, '{"tier": "enterprise"}', ?, ?
        )`,
      )
      .bind(
        RESERVATION_ID,
        ORG_ID,
        LANE_ID,
        NOW - 3600, // active_from 1h ago
        NOW + 86400 * 30, // active_until 30d future
        NOW - 3600,
        NOW - 3600,
      )
      .run();

    // Seed initial render job
    await db
      .prepare(
        `INSERT INTO video_render_jobs (
          id, org_id, lane, priority_score, status, tier, payload, created_at, updated_at
        ) VALUES (?, ?, 'standard', 10, 'queued', 'ENTERPRISE', '{}', ?, ?)`,
      )
      .bind('job_101', ORG_ID, NOW, NOW)
      .run();
  });

  describe('Reservation Querying & Capacity Validation', () => {
    it('fetches reservation by ID correctly', async () => {
      const res = await getReservationById(db, RESERVATION_ID);
      expect(res).not.toBeNull();
      expect(res?.id).toBe(RESERVATION_ID);
      expect(res?.priorityScore).toBe(300);
      expect(res?.concurrencyLimit).toBe(20);
      expect(res?.primaryRegion).toBe('apac');
      expect(res?.fallbackRegions).toEqual(['us', 'eu']);
    });

    it('fetches reservation by unique lane_id', async () => {
      const res = await getReservationByLaneId(db, LANE_ID);
      expect(res).not.toBeNull();
      expect(res?.id).toBe(RESERVATION_ID);
      expect(res?.laneId).toBe(LANE_ID);
    });

    it('fetches active reservation for organization', async () => {
      const res = await getActiveReservationForOrg(db, ORG_ID, NOW);
      expect(res).not.toBeNull();
      expect(res?.orgId).toBe(ORG_ID);
    });

    it('validates active capacity correctly when quota available', () => {
      const mockRes: EnterpriseGpuReservation = {
        id: 'res_1',
        orgId: ORG_ID,
        laneId: 'lane_1',
        primaryRegion: 'apac',
        fallbackRegions: ['us'],
        reservedUnits: 5,
        concurrencyLimit: 20,
        mcuMonthlyAllocation: 100000,
        mcuConsumed: 20000,
        priorityScore: 300,
        status: 'active',
        slaUptimeTarget: 0.999,
        slaP95LatencyMs: 1500,
        slaDegradationWindowSecs: 900,
        slaRefundPct: 10,
        allocatedProviders: ['fal'],
        activeFrom: NOW - 1000,
        activeUntil: NOW + 10000,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      };

      const result = validateReservationCapacity(mockRes, 5000, NOW);
      expect(result.valid).toBe(true);
    });

    it('rejects allocation when MCU monthly allocation is exhausted', () => {
      const mockRes: EnterpriseGpuReservation = {
        id: 'res_1',
        orgId: ORG_ID,
        laneId: 'lane_1',
        primaryRegion: 'apac',
        fallbackRegions: ['us'],
        reservedUnits: 5,
        concurrencyLimit: 20,
        mcuMonthlyAllocation: 100000,
        mcuConsumed: 99000,
        priorityScore: 300,
        status: 'active',
        slaUptimeTarget: 0.999,
        slaP95LatencyMs: 1500,
        slaDegradationWindowSecs: 900,
        slaRefundPct: 10,
        allocatedProviders: ['fal'],
        activeFrom: NOW - 1000,
        activeUntil: NOW + 10000,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      };

      const result = validateReservationCapacity(mockRes, 2000, NOW);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('CAPACITY_EXHAUSTED');
    });

    it('rejects allocation when reservation has expired', () => {
      const mockRes: EnterpriseGpuReservation = {
        id: 'res_1',
        orgId: ORG_ID,
        laneId: 'lane_1',
        primaryRegion: 'apac',
        fallbackRegions: ['us'],
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
        allocatedProviders: ['fal'],
        activeFrom: NOW - 10000,
        activeUntil: NOW - 100, // Expired
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      };

      const result = validateReservationCapacity(mockRes, 100, NOW);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('RESERVATION_EXPIRED');
    });

    it('rejects allocation when reservation status is suspended or terminated', () => {
      const mockRes: EnterpriseGpuReservation = {
        id: 'res_1',
        orgId: ORG_ID,
        laneId: 'lane_1',
        primaryRegion: 'apac',
        fallbackRegions: ['us'],
        reservedUnits: 5,
        concurrencyLimit: 20,
        mcuMonthlyAllocation: 100000,
        mcuConsumed: 1000,
        priorityScore: 300,
        status: 'suspended',
        slaUptimeTarget: 0.999,
        slaP95LatencyMs: 1500,
        slaDegradationWindowSecs: 900,
        slaRefundPct: 10,
        allocatedProviders: ['fal'],
        activeFrom: NOW - 1000,
        activeUntil: NOW + 10000,
        metadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      };

      const result = validateReservationCapacity(mockRes, 100, NOW);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('RESERVATION_SUSPENDED');
    });
  });

  describe('Dedicated Lane Allocation Arbitration', () => {
    it('successfully elevates job to dedicated priority lane with score 300', async () => {
      const result = await allocateDedicatedLane(db, 'job_101', RESERVATION_ID, {
        nowSeconds: NOW,
        requestedMcu: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.lane).toBe('priority');
      expect(result.priorityScore).toBe(300);
      expect(result.allocatedRegion).toBe('apac');
      expect(result.activeJobs).toBe(1);

      // Verify DB row
      const jobRow = await db
        .prepare('SELECT * FROM video_render_jobs WHERE id = ?')
        .bind('job_101')
        .first<{ lane: string; priority_score: number; reservation_id: string; target_region: string }>();

      expect(jobRow?.lane).toBe('priority');
      expect(jobRow?.priority_score).toBe(300);
      expect(jobRow?.reservation_id).toBe(RESERVATION_ID);
      expect(jobRow?.target_region).toBe('apac');

      // Verify consumed MCU incremented
      const resRow = await db
        .prepare('SELECT mcu_consumed FROM enterprise_gpu_reservations WHERE id = ?')
        .bind(RESERVATION_ID)
        .first<{ mcu_consumed: number }>();

      expect(resRow?.mcu_consumed).toBe(11000); // 10000 + 1000
    });

    it('returns error if reservation does not exist', async () => {
      const result = await allocateDedicatedLane(db, 'job_101', 'non_existent_res');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('RESERVATION_NOT_FOUND');
    });

    it('enforces concurrency limit of 20 active jobs', async () => {
      // Seed 20 active rendering jobs
      for (let i = 1; i <= 20; i++) {
        await db
          .prepare(
            `INSERT INTO video_render_jobs (
              id, org_id, lane, priority_score, status, tier, payload, reservation_id, created_at, updated_at
            ) VALUES (?, ?, 'priority', 300, 'rendering', 'ENTERPRISE', '{}', ?, ?, ?)`,
          )
          .bind(`active_job_${i}`, ORG_ID, RESERVATION_ID, NOW, NOW)
          .run();
      }

      const activeCount = await getReservationActiveJobCount(db, RESERVATION_ID, NOW);
      expect(activeCount).toBe(20);

      // Attempt 21st allocation
      const result = await allocateDedicatedLane(db, 'job_101', RESERVATION_ID, {
        nowSeconds: NOW,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      expect(result.activeJobs).toBe(20);
      expect(result.concurrencyLimit).toBe(20);
    });

    it('allows releasing dedicated lane upon job completion', async () => {
      const allocated = await allocateDedicatedLane(db, 'job_101', RESERVATION_ID, {
        nowSeconds: NOW,
      });
      expect(allocated.success).toBe(true);

      const released = await releaseDedicatedLane(db, 'job_101', {
        status: 'completed',
        executionLatencyMs: 820,
        executedRegion: 'apac',
      });

      expect(released).toBe(true);

      const jobRow = await db
        .prepare('SELECT status, execution_latency_ms, executed_region FROM video_render_jobs WHERE id = ?')
        .bind('job_101')
        .first<{ status: string; execution_latency_ms: number; executedRegion?: string; executed_region: string }>();

      expect(jobRow?.status).toBe('completed');
      expect(jobRow?.execution_latency_ms).toBe(820);
      expect(jobRow?.executed_region).toBe('apac');
    });
  });
});
