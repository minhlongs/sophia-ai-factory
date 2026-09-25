/**
 * Enterprise Global GPU Mesh & Failover E2E Test Suite (Tiers 1–4)
 *
 * Implements opaque-box, requirement-driven E2E verification of:
 * 1. Dedicated GPU Lane Allocation (priority score 300, concurrency quotas, MCU commitment validation)
 * 2. Deterministic Multi-Region Routing (latency-aware APAC -> US -> EU failover & 1500ms ceiling)
 * 3. Regional Circuit Breaker States (CLOSED, HALF_OPEN, OPEN & automatic trip/reset arbitration)
 * 4. Automated SLA Degradation Detection (availability < 99.9%, P95 latency > 1500ms, cascading failovers)
 * 5. Automated Dual-Rail Compensation (MCU credits restoration & USDT / invoice refund calculation)
 * 6. Production Enterprise Workflows & Admin Server Actions RBAC Guard
 *
 * @vitest-environment node
 * @module __tests__/e2e/enterprise/gpu-mesh-failover.e2e.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createEnterpriseTestDb } from './enterprise-e2e-harness';
import type {
  EnterpriseGpuReservation,
  GpuMeshRegion,
  BreachType,
  CompensationRail,
} from '@/seed/types/gpu-mesh';
import { GPU_MESH_SLA_CONFIG } from '@/seed/config/gpu-mesh';
import {
  allocateDedicatedLane,
  releaseDedicatedLane,
  getReservationById,
  getReservationByLaneId,
  getActiveReservationForOrg,
  validateReservationCapacity,
  getReservationActiveJobCount,
} from '@/tree/gpu-mesh/dedicated-lane-allocator';
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
import { runSlaRefundMonitorScan } from '@/forest/jobs/sla-refund-monitor-cron';
import {
  createGpuReservationAction,
  updateGpuReservationAction,
  terminateGpuReservationAction,
  getGpuMeshHealthAction,
  listSlaIncidentsAction,
} from '@/land/enterprise/gpu-reservations-actions';

// ── Auth & D1 Mocks for Server Actions ────────────────────────────────────────

let mockCurrentUser: { id: string; email: string; role: string } | null = null;
let mockIsAdmin = false;
let currentD1: D1Database;

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => Promise.resolve(mockCurrentUser),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: () =>
    Promise.resolve({ isAdmin: mockIsAdmin, dbRole: mockIsAdmin ? 'admin' : 'user' }),
  isUserAdmin: () => Promise.resolve(mockIsAdmin),
}));

vi.mock('@/seed/db/client', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    getD1: () => Promise.resolve(currentD1),
  };
});

// ── Test Constants & Fixture Helpers ──────────────────────────────────────────

const TEST_ORG_ID = 'org_gpu_enterprise_test';

async function seedDefaultRegionHealth(d1: D1Database): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const regions: Array<{ region: GpuMeshRegion; latency: number }> = [
    { region: 'apac', latency: 180 },
    { region: 'us', latency: 220 },
    { region: 'eu', latency: 260 },
  ];

  for (const { region, latency } of regions) {
    await d1
      .prepare(
        `INSERT INTO gpu_mesh_region_health (
          region, health_status, p95_latency_ms, error_rate_pct,
          active_reservations, available_capacity_pct, circuit_breaker_state,
          last_probe_at, probe_details, updated_at
        ) VALUES (?1, 'healthy', ?2, 0.0, 0, 100.0, 'CLOSED', ?3, '{}', ?3)
        ON CONFLICT(region) DO UPDATE SET
          health_status = 'healthy',
          p95_latency_ms = excluded.p95_latency_ms,
          circuit_breaker_state = 'CLOSED',
          error_rate_pct = 0.0,
          updated_at = excluded.updated_at`,
      )
      .bind(region, latency, now)
      .run();
  }
}

async function createTestReservation(
  d1: D1Database,
  overrides: Partial<EnterpriseGpuReservation> = {},
): Promise<EnterpriseGpuReservation> {
  const now = Math.floor(Date.now() / 1000);
  const id = overrides.id || `egr_test_${Math.random().toString(36).slice(2, 10)}`;
  const laneId = overrides.laneId || `lane_dedicated_${Math.random().toString(36).slice(2, 8)}`;
  const orgId = overrides.orgId || TEST_ORG_ID;
  const primaryRegion = overrides.primaryRegion || 'apac';
  const fallbackRegions = overrides.fallbackRegions || ['us', 'eu'];
  const reservedUnits = overrides.reservedUnits ?? 5;
  const concurrencyLimit = overrides.concurrencyLimit ?? 20;
  const mcuMonthlyAllocation = overrides.mcuMonthlyAllocation ?? 100_000;
  const mcuConsumed = overrides.mcuConsumed ?? 0;
  const priorityScore = overrides.priorityScore ?? 300;
  const status = overrides.status || 'active';
  const slaUptimeTarget = overrides.slaUptimeTarget ?? 0.999;
  const slaP95LatencyMs = overrides.slaP95LatencyMs ?? 1500;
  const slaDegradationWindowSecs = overrides.slaDegradationWindowSecs ?? 900;
  const slaRefundPct = overrides.slaRefundPct ?? 10.0;
  const allocatedProviders = overrides.allocatedProviders || ['fal', 'runpod', 'mekong'];
  const activeFrom = overrides.activeFrom ?? now - 3600;
  const activeUntil = overrides.activeUntil ?? now + 86400 * 30;
  const metadata = overrides.metadata || { monthlyPriceCents: 350_000 };

  await d1
    .prepare(
      `INSERT INTO enterprise_gpu_reservations (
        id, org_id, deal_id, contract_id, lane_id,
        primary_region, fallback_regions, reserved_units, concurrency_limit,
        mcu_monthly_allocation, mcu_consumed, priority_score, status,
        sla_uptime_target, sla_p95_latency_ms, sla_degradation_window_secs, sla_refund_pct,
        allocated_providers, active_from, active_until, metadata,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)`,
    )
    .bind(
      id,
      orgId,
      overrides.dealId ?? null,
      overrides.contractId ?? null,
      laneId,
      primaryRegion,
      JSON.stringify(fallbackRegions),
      reservedUnits,
      concurrencyLimit,
      mcuMonthlyAllocation,
      mcuConsumed,
      priorityScore,
      status,
      slaUptimeTarget,
      slaP95LatencyMs,
      slaDegradationWindowSecs,
      slaRefundPct,
      JSON.stringify(allocatedProviders),
      activeFrom,
      activeUntil,
      JSON.stringify(metadata),
      now,
      now,
    )
    .run();

  const fetched = await getReservationById(d1, id);
  if (!fetched) throw new Error('Failed to create test reservation fixture');
  return fetched;
}

async function createTestJob(
  d1: D1Database,
  overrides: {
    id?: string;
    orgId?: string;
    reservationId?: string | null;
    status?: string;
    lane?: string;
    priorityScore?: number;
    targetRegion?: string;
    executedRegion?: string | null;
    executionLatencyMs?: number | null;
    failoverHops?: number;
    leasedUntil?: number | null;
    updatedAt?: number;
  } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const id = overrides.id || `job_${Math.random().toString(36).slice(2, 10)}`;
  const orgId = overrides.orgId || TEST_ORG_ID;
  const status = overrides.status || 'queued';
  const lane = overrides.lane || 'standard';
  const priorityScore = overrides.priorityScore ?? 10;

  await d1
    .prepare(
      `INSERT INTO video_render_jobs (
        id, org_id, lane, priority_score, status, tier, payload,
        reservation_id, target_region, executed_region, failover_hops,
        execution_latency_ms, leased_until, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'enterprise', '{}', ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
    )
    .bind(
      id,
      orgId,
      lane,
      priorityScore,
      status,
      overrides.reservationId ?? null,
      overrides.targetRegion ?? 'apac',
      overrides.executedRegion ?? null,
      overrides.failoverHops ?? 0,
      overrides.executionLatencyMs ?? null,
      overrides.leasedUntil ?? null,
      now,
      overrides.updatedAt ?? now,
    )
    .run();

  return id;
}

// ── Test Suites ───────────────────────────────────────────────────────────────

describe('Enterprise GPU Mesh & Failover E2E Test Suite', () => {
  let d1: D1Database;

  beforeEach(async () => {
    const harness = createEnterpriseTestDb();
    d1 = harness.d1;
    currentD1 = d1;
    mockCurrentUser = null;
    mockIsAdmin = false;

    // Seed organization record
    await d1
      .prepare(
        `INSERT INTO organizations (id, name, slug, tier, status)
         VALUES (?1, 'Enterprise GPU Test Org', 'enterprise-gpu-org', 'enterprise', 'active')`,
      )
      .bind(TEST_ORG_ID)
      .run();

    await seedDefaultRegionHealth(d1);
  });

  // ============================================================================
  // TIER 1: SMOKE & HAPPY PATH — Core Dedicated Lane Lifecycle
  // ============================================================================
  describe('Tier 1: Smoke & Happy Path — Core Dedicated Lane Lifecycle', () => {
    it('T1-1: provisions enterprise GPU reservation with priority score 300 and 20 concurrency', async () => {
      const reservation = await createTestReservation(d1, {
        orgId: TEST_ORG_ID,
        primaryRegion: 'apac',
        fallbackRegions: ['us', 'eu'],
        reservedUnits: 10,
        concurrencyLimit: 20,
        mcuMonthlyAllocation: 250_000,
        priorityScore: 300,
        status: 'active',
      });

      expect(reservation.id).toBeDefined();
      expect(reservation.priorityScore).toBe(300);
      expect(reservation.concurrencyLimit).toBe(20);
      expect(reservation.primaryRegion).toBe('apac');
      expect(reservation.fallbackRegions).toEqual(['us', 'eu']);
      expect(reservation.status).toBe('active');
    });

    it('T1-2: allocates dedicated priority lane elevating job priority score from 10 to 300', async () => {
      const reservation = await createTestReservation(d1, { priorityScore: 300 });
      const jobId = await createTestJob(d1, { lane: 'standard', priorityScore: 10 });

      const allocation = await allocateDedicatedLane(d1, jobId, reservation.id, {
        requestedMcu: 1000,
      });

      expect(allocation.success).toBe(true);
      expect(allocation.priorityScore).toBe(300);
      expect(allocation.lane).toBe('priority');
      expect(allocation.allocatedRegion).toBe('apac');
      expect(allocation.activeJobs).toBe(1);

      // Verify D1 state updated
      const jobRow = await d1
        .prepare('SELECT lane, priority_score, reservation_id, target_region FROM video_render_jobs WHERE id = ?1')
        .bind(jobId)
        .first<{ lane: string; priority_score: number; reservation_id: string; target_region: string }>();

      expect(jobRow?.lane).toBe('priority');
      expect(jobRow?.priority_score).toBe(300);
      expect(jobRow?.reservation_id).toBe(reservation.id);
      expect(jobRow?.target_region).toBe('apac');

      // Verify MCU consumption tracked
      const updatedRes = await getReservationById(d1, reservation.id);
      expect(updatedRes?.mcuConsumed).toBe(1000);
    });

    it('T1-3: resolves primary region APAC on hop 0 when health is nominal (<1500ms)', async () => {
      const reservation = await createTestReservation(d1, {
        primaryRegion: 'apac',
        fallbackRegions: ['us', 'eu'],
        slaP95LatencyMs: 1500,
      });

      const route = await resolveOptimalRegion(d1, reservation);
      expect(route.selectedRegion).toBe('apac');
      expect(route.isFailover).toBe(false);
      expect(route.failoverHops).toBe(0);
      expect(route.reason).toBe('PRIMARY_HEALTHY');
      expect(route.p95LatencyMs).toBeLessThanOrEqual(1500);
    });

    it('T1-4: releases dedicated lane on job completion and records execution latency & region', async () => {
      const reservation = await createTestReservation(d1);
      const jobId = await createTestJob(d1, {
        reservationId: reservation.id,
        status: 'rendering',
        lane: 'priority',
        priorityScore: 300,
      });

      const released = await releaseDedicatedLane(d1, jobId, {
        status: 'completed',
        executionLatencyMs: 412,
        executedRegion: 'apac',
      });

      expect(released).toBe(true);

      const jobRow = await d1
        .prepare('SELECT status, execution_latency_ms, executed_region FROM video_render_jobs WHERE id = ?1')
        .bind(jobId)
        .first<{ status: string; execution_latency_ms: number; executed_region: string }>();

      expect(jobRow?.status).toBe('completed');
      expect(jobRow?.execution_latency_ms).toBe(412);
      expect(jobRow?.executed_region).toBe('apac');

      // Active jobs count should be 0 now
      const activeCount = await getReservationActiveJobCount(d1, reservation.id);
      expect(activeCount).toBe(0);
    });

    it('T1-5: retrieves active reservation for organization ordered by priority score', async () => {
      await createTestReservation(d1, { orgId: TEST_ORG_ID, priorityScore: 200 });
      const higherRes = await createTestReservation(d1, { orgId: TEST_ORG_ID, priorityScore: 300 });

      const active = await getActiveReservationForOrg(d1, TEST_ORG_ID);
      expect(active).not.toBeNull();
      expect(active?.id).toBe(higherRes.id);
      expect(active?.priorityScore).toBe(300);
    });
  });

  // ============================================================================
  // TIER 2: BOUNDARY & EDGE CONDITIONS — Resource Limits & Constraints
  // ============================================================================
  describe('Tier 2: Boundary & Edge Conditions — Resource Limits & Constraints', () => {
    it('T2-1: enforces concurrency quota and rejects allocation beyond 20 concurrent jobs', async () => {
      const reservation = await createTestReservation(d1, { concurrencyLimit: 3 });
      const now = Math.floor(Date.now() / 1000);

      // Create 3 active rendering jobs
      for (let i = 0; i < 3; i++) {
        await createTestJob(d1, {
          reservationId: reservation.id,
          status: 'rendering',
          lane: 'priority',
        });
      }

      const activeCount = await getReservationActiveJobCount(d1, reservation.id, now);
      expect(activeCount).toBe(3);

      // Attempt 4th job allocation
      const overflowJobId = await createTestJob(d1, { status: 'queued' });
      const result = await allocateDedicatedLane(d1, overflowJobId, reservation.id);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      expect(result.activeJobs).toBe(3);
      expect(result.concurrencyLimit).toBe(3);
    });

    it('T2-2: enforces MCU monthly allocation and rejects jobs when allocation is exhausted', async () => {
      const reservation = await createTestReservation(d1, {
        mcuMonthlyAllocation: 100_000,
        mcuConsumed: 95_000,
      });

      const jobId = await createTestJob(d1);

      // Requesting 6,000 MCU exceeds 100,000 limit
      const result = await allocateDedicatedLane(d1, jobId, reservation.id, {
        requestedMcu: 6_000,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('CAPACITY_EXHAUSTED');

      // Requesting 5,000 MCU fits exact boundary
      const exactResult = await allocateDedicatedLane(d1, jobId, reservation.id, {
        requestedMcu: 5_000,
      });
      expect(exactResult.success).toBe(true);
    });

    it('T2-3: rejects lane allocation for expired reservations', async () => {
      const now = Math.floor(Date.now() / 1000);
      const expiredRes = await createTestReservation(d1, {
        activeFrom: now - 86400 * 30,
        activeUntil: now - 60, // expired 1 minute ago
      });

      const jobId = await createTestJob(d1);
      const result = await allocateDedicatedLane(d1, jobId, expiredRes.id);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('RESERVATION_EXPIRED');
    });

    it('T2-4: rejects lane allocation for reservations not yet active', async () => {
      const now = Math.floor(Date.now() / 1000);
      const futureRes = await createTestReservation(d1, {
        activeFrom: now + 3600, // starts in 1 hour
        activeUntil: now + 86400 * 30,
      });

      const jobId = await createTestJob(d1);
      const result = await allocateDedicatedLane(d1, jobId, futureRes.id);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('RESERVATION_NOT_YET_ACTIVE');
    });

    it('T2-5: rejects lane allocation when reservation status is suspended or terminated', async () => {
      const suspendedRes = await createTestReservation(d1, { status: 'suspended' });
      const jobId = await createTestJob(d1);

      const result = await allocateDedicatedLane(d1, jobId, suspendedRes.id);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('RESERVATION_SUSPENDED');

      const terminatedRes = await createTestReservation(d1, { status: 'terminated' });
      const result2 = await allocateDedicatedLane(d1, jobId, terminatedRes.id);
      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('RESERVATION_TERMINATED');
    });

    it('T2-6: pure SLI math boundaries: empty array, single latency, identical latencies', () => {
      expect(calculateP95Latency([])).toBe(0);
      expect(calculateP95Latency([350])).toBe(350);

      const latencies = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
      // 100 items: 95th index is 95 -> 960ms
      expect(calculateP95Latency(latencies)).toBe(960);

      const identical = [500, 500, 500, 500];
      expect(calculateP95Latency(identical)).toBe(500);
    });

    it('T2-7: pure availability ratio boundaries: 0 jobs, 100% success, 0% success', () => {
      expect(calculateAvailability(0, 0)).toBe(1.0);
      expect(calculateAvailability(10, 10)).toBe(1.0);
      expect(calculateAvailability(0, 10)).toBe(0.0);
      expect(calculateAvailability(999, 1000)).toBe(0.999);
      expect(calculateAvailability(998, 1000)).toBe(0.998);
    });
  });

  // ============================================================================
  // TIER 3: ERROR HANDLING, CIRCUIT BREAKERS & DEGRADATION INCIDENTS
  // ============================================================================
  describe('Tier 3: Error Handling & Circuit Breakers & Degradation Incidents', () => {
    it('T3-1: failover routing cascades APAC -> US when APAC latency exceeds 1500ms ceiling', async () => {
      const reservation = await createTestReservation(d1, {
        primaryRegion: 'apac',
        fallbackRegions: ['us', 'eu'],
        slaP95LatencyMs: 1500,
      });

      // Update APAC latency to 1850ms (exceeds 1500ms ceiling)
      await updateRegionHealthTelemetry(d1, {
        region: 'apac',
        p95LatencyMs: 1850,
      });

      const route = await resolveOptimalRegion(d1, reservation);
      expect(route.selectedRegion).toBe('us');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(1);
      expect(route.reason).toBe('FAILOVER_FROM_APAC');
      expect(route.p95LatencyMs).toBeLessThanOrEqual(1500);
    });

    it('T3-2: failover routing cascades APAC -> US -> EU when both APAC and US are degraded', async () => {
      const reservation = await createTestReservation(d1, {
        primaryRegion: 'apac',
        fallbackRegions: ['us', 'eu'],
        slaP95LatencyMs: 1500,
      });

      await updateRegionHealthTelemetry(d1, { region: 'apac', p95LatencyMs: 1900 });
      await updateRegionHealthTelemetry(d1, { region: 'us', p95LatencyMs: 1650 });

      const route = await resolveOptimalRegion(d1, reservation);
      expect(route.selectedRegion).toBe('eu');
      expect(route.isFailover).toBe(true);
      expect(route.failoverHops).toBe(2);
      expect(route.reason).toBe('FAILOVER_FROM_APAC');
    });

    it('T3-3: best effort fallback when all regions degraded selects region with lowest error/latency', async () => {
      const reservation = await createTestReservation(d1, {
        primaryRegion: 'apac',
        fallbackRegions: ['us', 'eu'],
        slaP95LatencyMs: 1500,
      });

      // All regions violate 1500ms ceiling
      await updateRegionHealthTelemetry(d1, { region: 'apac', p95LatencyMs: 2200, errorRatePct: 25.0 });
      await updateRegionHealthTelemetry(d1, { region: 'us', p95LatencyMs: 1800, errorRatePct: 5.0 });
      await updateRegionHealthTelemetry(d1, { region: 'eu', p95LatencyMs: 2000, errorRatePct: 15.0 });

      const route = await resolveOptimalRegion(d1, reservation);
      expect(route.isFailover).toBe(true);
      expect(route.reason).toBe('ALL_REGIONS_DEGRADED_BEST_EFFORT');
      // US has lowest error rate (5%)
      expect(route.selectedRegion).toBe('us');
    });

    it('T3-4: circuit breaker automatically trips to OPEN when error rate >= 50% or latency > 2500ms', async () => {
      const health = await updateRegionHealthTelemetry(d1, {
        region: 'apac',
        errorRatePct: 55.0,
        p95LatencyMs: 3000,
      });

      expect(health.circuitBreakerState).toBe('OPEN');
      expect(health.healthStatus).toBe('unhealthy');

      // Verify persisted in D1
      const persisted = await getRegionHealth(d1, 'apac');
      expect(persisted?.circuitBreakerState).toBe('OPEN');
      expect(persisted?.healthStatus).toBe('unhealthy');
    });

    it('T3-5: circuit breaker transitions to HALF_OPEN when moderate degradation occurs', async () => {
      const health = await updateRegionHealthTelemetry(d1, {
        region: 'us',
        errorRatePct: 25.0,
        p95LatencyMs: 1600,
      });

      expect(health.circuitBreakerState).toBe('HALF_OPEN');
      expect(health.healthStatus).toBe('degraded');
    });

    it('T3-6: circuit breaker OPEN state strictly excludes region from candidate routing', async () => {
      const reservation = await createTestReservation(d1, {
        primaryRegion: 'apac',
        fallbackRegions: ['us', 'eu'],
      });

      await tripCircuitBreaker(d1, 'apac', 'Critical fiber line cut');

      const route = await resolveOptimalRegion(d1, reservation);
      expect(route.selectedRegion).not.toBe('apac');
      expect(route.selectedRegion).toBe('us');
      expect(route.isFailover).toBe(true);
    });

    it('T3-7: resets regional circuit breaker to CLOSED and clears error rate', async () => {
      await tripCircuitBreaker(d1, 'apac', 'Manual drill');
      let health = await getRegionHealth(d1, 'apac');
      expect(health?.circuitBreakerState).toBe('OPEN');

      const resetOk = await resetCircuitBreaker(d1, 'apac');
      expect(resetOk).toBe(true);

      health = await getRegionHealth(d1, 'apac');
      expect(health?.circuitBreakerState).toBe('CLOSED');
      expect(health?.healthStatus).toBe('healthy');
      expect(health?.errorRatePct).toBe(0.0);
    });

    it('T3-8: SLI calculation detects uptime SLA breach (< 99.9%) and creates incident record', async () => {
      const now = Math.floor(Date.now() / 1000);
      const reservation = await createTestReservation(d1, { slaUptimeTarget: 0.999 });

      // Create 9 successful jobs and 1 failed job (90% availability < 99.9%)
      for (let i = 0; i < 9; i++) {
        await createTestJob(d1, {
          reservationId: reservation.id,
          status: 'completed',
          executionLatencyMs: 300,
          updatedAt: now - 60,
        });
      }
      await createTestJob(d1, {
        reservationId: reservation.id,
        status: 'failed',
        updatedAt: now - 60,
      });

      const sli = await measureReservationSli(d1, reservation, 900, now);
      expect(sli.totalJobs).toBe(10);
      expect(sli.successfulJobs).toBe(9);
      expect(sli.failedJobs).toBe(1);
      expect(sli.availabilityRatio).toBe(0.9);

      const breach = sli.breaches.find((b) => b.breachType === 'uptime');
      expect(breach).toBeDefined();
      expect(breach?.targetThreshold).toBe(0.999);
      expect(breach?.measuredValue).toBe(0.9);
    });

    it('T3-9: SLI calculation detects P95 latency SLA breach (> 1500ms)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const reservation = await createTestReservation(d1, { slaP95LatencyMs: 1500 });

      // Create 5 completed jobs with high latency (1800ms)
      for (let i = 0; i < 5; i++) {
        await createTestJob(d1, {
          reservationId: reservation.id,
          status: 'completed',
          executionLatencyMs: 1800 + i * 50,
          updatedAt: now - 120,
        });
      }

      const sli = await measureReservationSli(d1, reservation, 900, now);
      expect(sli.p95LatencyMs).toBeGreaterThan(1500);

      const breach = sli.breaches.find((b) => b.breachType === 'latency_p95');
      expect(breach).toBeDefined();
      expect(breach?.targetThreshold).toBe(1500);
    });

    it('T3-10: dual-rail SLA compensation formula accurately computes MCU credits and USDT value', async () => {
      const reservation = await createTestReservation(d1, {
        mcuMonthlyAllocation: 100_000,
        slaRefundPct: 10.0, // 10% base refund
        metadata: { monthlyPriceCents: 350_000 }, // $3,500/mo
      });

      // 4 directly impacted jobs
      const mcuComp = calculateSlaCompensation(reservation, 'uptime', 4, 'MCU_CREDIT');
      // Base MCU: 100,000 * 10% = 10,000 MCU. Bonus: 4 * 500 = 2,000 MCU. Total: 12,000 MCU.
      expect(mcuComp.compensationMcu).toBe(12_000);
      // Base Cents: $3,500 * 10% = 35,000 cents. Bonus: 4 * 25 cents = 100 cents. Total: 35,100 cents ($351).
      expect(mcuComp.creditAmountCents).toBe(35_100);

      const usdtComp = calculateSlaCompensation(reservation, 'latency_p95', 2, 'USDT_REFUND');
      expect(usdtComp.creditAmountCents).toBe(35_050);
      expect(usdtComp.compensationMcu).toBe(11_000);
    });
  });

  // ============================================================================
  // TIER 4: END-TO-END ENTERPRISE PRODUCTION SCENARIOS
  // ============================================================================
  describe('Tier 4: End-to-End Enterprise Production Scenarios', () => {
    it('S1: High-Throughput Media Agency with Dedicated GPU Lane & Peak Concurrency', async () => {
      // 1. Enterprise Agency commits to 500K MCU / month with 20 concurrent lanes and priority score 300
      const reservation = await createTestReservation(d1, {
        orgId: 'org_apex_studios',
        primaryRegion: 'apac',
        concurrencyLimit: 20,
        mcuMonthlyAllocation: 500_000,
        priorityScore: 300,
      });

      // 2. Queue 5 enterprise video render jobs
      const jobIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const jobId = await createTestJob(d1, {
          orgId: 'org_apex_studios',
          lane: 'standard',
          priorityScore: 10,
        });
        jobIds.push(jobId);
      }

      // 3. Allocate dedicated lane for each job with 2,500 MCU each
      for (const jid of jobIds) {
        const allocation = await allocateDedicatedLane(d1, jid, reservation.id, {
          requestedMcu: 2500,
        });
        expect(allocation.success).toBe(true);
        expect(allocation.lane).toBe('priority');
        expect(allocation.priorityScore).toBe(300);
        expect(allocation.allocatedRegion).toBe('apac');

        // Worker transitions job to rendering
        await d1
          .prepare("UPDATE video_render_jobs SET status = 'rendering' WHERE id = ?1")
          .bind(jid)
          .run();
      }

      // 4. Verify 5 jobs are active and MCU consumption updated to 12,500
      const activeCount = await getReservationActiveJobCount(d1, reservation.id);
      expect(activeCount).toBe(5);

      const updatedRes = await getReservationById(d1, reservation.id);
      expect(updatedRes?.mcuConsumed).toBe(12_500);

      // 5. Complete all 5 jobs and verify capacity released
      for (const jid of jobIds) {
        await releaseDedicatedLane(d1, jid, {
          status: 'completed',
          executionLatencyMs: 380,
          executedRegion: 'apac',
        });
      }

      const finalActiveCount = await getReservationActiveJobCount(d1, reservation.id);
      expect(finalActiveCount).toBe(0);
    });

    it('S2: Real-Time Multi-Region Failover under APAC Outage & Degraded Performance', async () => {
      const reservation = await createTestReservation(d1, {
        orgId: 'org_global_broadcaster',
        primaryRegion: 'apac',
        fallbackRegions: ['us', 'eu'],
        slaP95LatencyMs: 1500,
      });

      // 1. Initial health is nominal -> route to APAC
      const route1 = await resolveOptimalRegion(d1, reservation);
      expect(route1.selectedRegion).toBe('apac');
      expect(route1.isFailover).toBe(false);

      // 2. APAC encounters fiber degradation -> latency spikes to 1950ms
      await updateRegionHealthTelemetry(d1, {
        region: 'apac',
        p95LatencyMs: 1950,
        errorRatePct: 15.0,
      });

      // 3. Router autonomously detects degradation and fails over to US
      const route2 = await resolveOptimalRegion(d1, reservation);
      expect(route2.selectedRegion).toBe('us');
      expect(route2.isFailover).toBe(true);
      expect(route2.failoverHops).toBe(1);

      // 4. Job is executed on US cluster
      const jobId = await createTestJob(d1, { targetRegion: route2.selectedRegion });
      await allocateDedicatedLane(d1, jobId, reservation.id, {
        targetRegion: route2.selectedRegion,
      });

      await releaseDedicatedLane(d1, jobId, {
        status: 'completed',
        executionLatencyMs: 240,
        executedRegion: 'us',
      });

      const jobRow = await d1
        .prepare('SELECT executed_region, status FROM video_render_jobs WHERE id = ?1')
        .bind(jobId)
        .first<{ executed_region: string; status: string }>();

      expect(jobRow?.executed_region).toBe('us');
      expect(jobRow?.status).toBe('completed');
    });

    it('S3: Automated SLA Breach Detection, Dual-Rail Refund & Balance Restitution', async () => {
      const now = Math.floor(Date.now() / 1000);
      const reservation = await createTestReservation(d1, {
        orgId: TEST_ORG_ID,
        mcuMonthlyAllocation: 100_000,
        mcuConsumed: 20_000,
        slaUptimeTarget: 0.999,
        slaRefundPct: 10.0,
      });

      // 1. Simulate customer workload during degraded period: 6 completed, 4 failed (60% uptime)
      for (let i = 0; i < 6; i++) {
        await createTestJob(d1, {
          reservationId: reservation.id,
          status: 'completed',
          executionLatencyMs: 400,
          updatedAt: now - 300,
        });
      }
      for (let i = 0; i < 4; i++) {
        await createTestJob(d1, {
          reservationId: reservation.id,
          status: 'failed',
          updatedAt: now - 200,
        });
      }

      // 2. Execute automated background SLA refund monitor cron
      const scanSummary = await runSlaRefundMonitorScan(d1, {
        windowSeconds: 900,
        nowSeconds: now,
        reservationId: reservation.id,
      });

      expect(scanSummary.incidentsDetected).toBeGreaterThanOrEqual(1);
      expect(scanSummary.incidentsDisbursed).toBeGreaterThanOrEqual(1);
      expect(scanSummary.totalCompensationMcu).toBeGreaterThan(0);
      expect(scanSummary.errors).toHaveLength(0);

      // 3. Verify incident persisted in sla_degradation_incidents table
      const incidentRow = await d1
        .prepare(
          `SELECT * FROM sla_degradation_incidents
           WHERE reservation_id = ?1 AND breach_type = 'uptime'`,
        )
        .bind(reservation.id)
        .first<{
          id: string;
          breach_type: string;
          refund_status: string;
          impacted_jobs_count: number;
        }>();

      expect(incidentRow).not.toBeNull();
      expect(incidentRow?.breach_type).toBe('uptime');
      expect(incidentRow?.refund_status).toBe('disbursed');
      expect(incidentRow?.impacted_jobs_count).toBe(4);

      // 4. Verify MCU credit compensation applied to reservation consumed balance
      // Base: 10,000 MCU + (4 * 500) = 12,000 MCU refunded.
      // mcu_consumed should decrease: 20,000 - 12,000 = 8,000 MCU
      const updatedRes = await getReservationById(d1, reservation.id);
      expect(updatedRes?.mcuConsumed).toBe(8_000);

      // 5. Verify transaction logged in mcu_transactions audit ledger
      const txRow = await d1
        .prepare(
          `SELECT delta, reason FROM mcu_transactions
           WHERE user_id = ?1 AND reason = 'SLA_DEGRADATION_COMPENSATION'`,
        )
        .bind(TEST_ORG_ID)
        .first<{ delta: number; reason: string }>();

      expect(txRow).not.toBeNull();
      expect(txRow?.delta).toBe(12_000);
      expect(txRow?.reason).toBe('SLA_DEGRADATION_COMPENSATION');
    });

    it('S4: Severe Degradation Health Downgrade & Circuit Breaker Recovery Loop', async () => {
      const now = Math.floor(Date.now() / 1000);
      const reservation = await createTestReservation(d1, {
        primaryRegion: 'apac',
        fallbackRegions: ['us'],
        status: 'active',
      });

      // 1. Severe failure rate causes circuit breaker trip to OPEN
      await updateRegionHealthTelemetry(d1, {
        region: 'apac',
        errorRatePct: 60.0,
        p95LatencyMs: 2900,
      });

      // 2. Generate severe failure jobs for cron scan
      for (let i = 0; i < 10; i++) {
        await createTestJob(d1, {
          reservationId: reservation.id,
          status: 'failed',
          updatedAt: now - 100,
        });
      }

      await runSlaRefundMonitorScan(d1, { nowSeconds: now, reservationId: reservation.id });

      // Reservation status should be degraded due to severe failure (< 95% availability)
      const degradedRes = await getReservationById(d1, reservation.id);
      expect(degradedRes?.status).toBe('degraded');

      // 3. Verify routing shifts away from APAC
      const route = await resolveOptimalRegion(d1, reservation);
      expect(route.selectedRegion).toBe('us');

      // 4. SRE performs recovery drill and resets circuit breaker
      await updateRegionHealthTelemetry(d1, {
        region: 'apac',
        p95LatencyMs: 180,
        errorRatePct: 0.0,
      });

      const resetResult = await resetCircuitBreaker(d1, 'apac');
      expect(resetResult).toBe(true);

      const recoveredHealth = await getRegionHealth(d1, 'apac');
      expect(recoveredHealth?.circuitBreakerState).toBe('CLOSED');
      expect(recoveredHealth?.healthStatus).toBe('healthy');

      // 5. Subsequent routing immediately returns traffic to primary APAC
      const recoveredRoute = await resolveOptimalRegion(d1, reservation);
      expect(recoveredRoute.selectedRegion).toBe('apac');
      expect(recoveredRoute.isFailover).toBe(false);
    });

    it('S5: Enterprise GPU Reservation Server Actions RBAC & Full Lifecycle', async () => {
      const now = Math.floor(Date.now() / 1000);

      // 1. Unauthenticated request rejected
      mockCurrentUser = null;
      mockIsAdmin = false;
      const unauthResult = await createGpuReservationAction({
        orgId: TEST_ORG_ID,
        activeUntil: now + 86400 * 30,
      });
      expect(unauthResult.ok).toBe(false);
      if (!unauthResult.ok) {
        expect(unauthResult.error.code).toBe('UNAUTHORIZED');
      }

      // 2. Non-admin user rejected
      mockCurrentUser = { id: 'usr_regular', email: 'user@corp.com', role: 'user' };
      mockIsAdmin = false;
      const nonAdminResult = await createGpuReservationAction({
        orgId: TEST_ORG_ID,
        activeUntil: now + 86400 * 30,
      });
      expect(nonAdminResult.ok).toBe(false);
      if (!nonAdminResult.ok) {
        expect(nonAdminResult.error.code).toBe('FORBIDDEN');
      }

      // 3. Admin user creates reservation successfully
      mockCurrentUser = { id: 'usr_admin', email: 'admin@sophia.vn', role: 'admin' };
      mockIsAdmin = true;
      const createResult = await createGpuReservationAction({
        orgId: TEST_ORG_ID,
        concurrencyLimit: 25,
        mcuMonthlyAllocation: 300_000,
        primaryRegion: 'apac',
        fallbackRegions: ['us', 'eu'],
        activeUntil: now + 86400 * 30,
      });
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const createdRes = createResult.value;
      expect(createdRes.orgId).toBe(TEST_ORG_ID);
      expect(createdRes.concurrencyLimit).toBe(25);
      expect(createdRes.priorityScore).toBe(300);

      // 4. Update reservation via Server Action
      const updateResult = await updateGpuReservationAction(createdRes.id, {
        concurrencyLimit: 30,
        mcuMonthlyAllocation: 400_000,
      });
      expect(updateResult.ok).toBe(true);
      if (!updateResult.ok) return;
      expect(updateResult.value.concurrencyLimit).toBe(30);
      expect(updateResult.value.mcuMonthlyAllocation).toBe(400_000);

      // 5. Query mesh health via Server Action
      const healthResult = await getGpuMeshHealthAction();
      expect(healthResult.ok).toBe(true);
      if (healthResult.ok) {
        expect(healthResult.value.length).toBeGreaterThanOrEqual(3);
        const apac = healthResult.value.find((r) => r.region === 'apac');
        expect(apac?.circuitBreakerState).toBe('CLOSED');
      }

      // Query SLA incidents via Server Action
      const incidentResult = await listSlaIncidentsAction({ orgId: TEST_ORG_ID });
      expect(incidentResult.ok).toBe(true);

      // 6. Terminate reservation via Server Action
      const termResult = await terminateGpuReservationAction(createdRes.id, 'Contract completed');
      expect(termResult.ok).toBe(true);
      if (termResult.ok) {
        expect(termResult.value.terminated).toBe(true);
        const terminated = await getReservationById(d1, createdRes.id);
        expect(terminated?.status).toBe('terminated');
      }
    });

    it('S6: Dry-Run vs Live Execution in SLA Refund Monitor Cron', async () => {
      const now = Math.floor(Date.now() / 1000);
      const reservation = await createTestReservation(d1, {
        mcuMonthlyAllocation: 100_000,
        mcuConsumed: 15_000,
      });

      // Create degraded jobs
      for (let i = 0; i < 5; i++) {
        await createTestJob(d1, {
          reservationId: reservation.id,
          status: 'failed',
          updatedAt: now - 100,
        });
      }

      // 1. Execute Dry Run
      const drySummary = await runSlaRefundMonitorScan(d1, {
        dryRun: true,
        nowSeconds: now,
        reservationId: reservation.id,
      });

      expect(drySummary.incidentsDetected).toBeGreaterThanOrEqual(1);
      expect(drySummary.incidentsDisbursed).toBe(0); // None disbursed in dry run
      expect(drySummary.totalCompensationMcu).toBeGreaterThan(0);

      // Verify no incidents inserted in D1
      const countRow = await d1
        .prepare('SELECT COUNT(*) as count FROM sla_degradation_incidents WHERE reservation_id = ?1')
        .bind(reservation.id)
        .first<{ count: number }>();
      expect(countRow?.count).toBe(0);

      // Consumed MCU should be unchanged
      const resAfterDry = await getReservationById(d1, reservation.id);
      expect(resAfterDry?.mcuConsumed).toBe(15_000);

      // 2. Execute Live Scan
      const liveSummary = await runSlaRefundMonitorScan(d1, {
        dryRun: false,
        nowSeconds: now,
        reservationId: reservation.id,
      });

      expect(liveSummary.incidentsDisbursed).toBeGreaterThanOrEqual(1);
      const countAfterLive = await d1
        .prepare('SELECT COUNT(*) as count FROM sla_degradation_incidents WHERE reservation_id = ?1')
        .bind(reservation.id)
        .first<{ count: number }>();
      expect(countAfterLive?.count).toBeGreaterThan(0);
    });
  });
});
