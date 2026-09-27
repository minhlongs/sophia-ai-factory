/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateNodeFitnessScore,
  selectOptimalComputeNode,
  estimateRenderMetrics,
  dispatchRenderJob,
  rerouteInFlightJob,
  completeRenderJob,
  getMeshTopology,
} from '../workload-balancer';
import {
  type GpuComputeNode,
  type VideoRenderJobInput,
  GATE_10_CONSTANTS,
} from '@/seed/types/edge-gpu-mesh';

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

function createTestDb(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS gpu_compute_nodes (
      id TEXT PRIMARY KEY,
      node_id TEXT UNIQUE NOT NULL,
      region TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'cloud',
      gpu_model TEXT NOT NULL,
      gpu_count INTEGER NOT NULL DEFAULT 8,
      vram_gb_per_gpu INTEGER NOT NULL DEFAULT 80,
      total_vram_gb INTEGER NOT NULL DEFAULT 640,
      status TEXT NOT NULL DEFAULT 'online',
      current_load_pct REAL NOT NULL DEFAULT 0.0,
      active_render_jobs INTEGER NOT NULL DEFAULT 0,
      max_concurrency INTEGER NOT NULL DEFAULT 32,
      p95_latency_ms REAL NOT NULL DEFAULT 12.0,
      p99_latency_ms REAL NOT NULL DEFAULT 18.0,
      spot_price_cents_per_hour INTEGER NOT NULL DEFAULT 250,
      on_demand_price_cents_per_hour INTEGER NOT NULL DEFAULT 400,
      supported_codecs_json TEXT NOT NULL DEFAULT '["h264","hevc","av1","prores"]',
      max_resolution TEXT NOT NULL DEFAULT '4K',
      health_score REAL NOT NULL DEFAULT 1.0,
      is_healthy INTEGER NOT NULL DEFAULT 1,
      total_renders_completed INTEGER NOT NULL DEFAULT 0,
      total_render_seconds REAL NOT NULL DEFAULT 0.0,
      last_heartbeat_at INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS video_render_dispatches (
      id TEXT PRIMARY KEY,
      dispatch_id TEXT UNIQUE NOT NULL,
      tenant_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      video_resolution TEXT NOT NULL,
      video_duration_seconds REAL NOT NULL,
      frame_count INTEGER NOT NULL,
      codec TEXT NOT NULL DEFAULT 'h264',
      status TEXT NOT NULL DEFAULT 'dispatched',
      priority_score INTEGER NOT NULL DEFAULT 100,
      spot_pricing_applied INTEGER NOT NULL DEFAULT 1,
      cost_cents INTEGER NOT NULL DEFAULT 0,
      queue_wait_ms INTEGER NOT NULL DEFAULT 0,
      render_duration_ms INTEGER,
      egress_bytes INTEGER NOT NULL DEFAULT 0,
      sla_target_ms INTEGER NOT NULL DEFAULT 15000,
      sla_breached INTEGER NOT NULL DEFAULT 0,
      reroute_count INTEGER NOT NULL DEFAULT 0,
      failover_history_json TEXT NOT NULL DEFAULT '[]',
      error_message TEXT,
      dispatched_at INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() =>
              stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() =>
          stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    batch: async <T = unknown>(statements: Array<{ run?: () => Promise<unknown> }>): Promise<T[]> => {
      const results: unknown[] = [];
      for (const s of statements) {
        if (typeof s?.run === 'function') {
          results.push(await s.run());
        }
      }
      return results as T[];
    },
  } as unknown as D1Database;
}

function createSampleNode(overrides?: Partial<GpuComputeNode>): GpuComputeNode {
  return {
    id: 'node-1',
    nodeId: 'gpu-tokyo-h100-01',
    region: 'apac-tokyo',
    provider: 'cloud',
    gpuModel: 'H100',
    gpuCount: 8,
    vramGbPerGpu: 80,
    totalVramGb: 640,
    status: 'online',
    currentLoadPct: 20.0,
    activeRenderJobs: 4,
    maxConcurrency: 32,
    p95LatencyMs: 12.0,
    p99LatencyMs: 18.0,
    spotPriceCentsPerHour: 250,
    onDemandPriceCentsPerHour: 400,
    supportedCodecs: ['h264', 'hevc', 'av1', 'prores'],
    maxResolution: '4K',
    healthScore: 1.0,
    isHealthy: true,
    totalRendersCompleted: 100,
    totalRenderSeconds: 1200,
    lastHeartbeatAt: Date.now(),
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('Edge GPU Workload Balancer', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('calculateNodeFitnessScore', () => {
    it('returns 0 for unhealthy, offline, or degraded nodes', () => {
      const job: VideoRenderJobInput = {
        jobId: 'job-1',
        tenantId: 'tenant-1',
        videoResolution: '4K',
        videoDurationSeconds: 30,
        frameCount: 1800,
      };

      const unhealthyNode = createSampleNode({ isHealthy: false });
      const offlineNode = createSampleNode({ status: 'offline' });
      const degradedNode = createSampleNode({ status: 'degraded' });

      expect(calculateNodeFitnessScore(unhealthyNode, job)).toBe(0);
      expect(calculateNodeFitnessScore(offlineNode, job)).toBe(0);
      expect(calculateNodeFitnessScore(degradedNode, job)).toBe(0);
    });

    it('calculates higher fitness score for lower load, lower latency, and better spot discount', () => {
      const job: VideoRenderJobInput = {
        jobId: 'job-1',
        tenantId: 'tenant-1',
        videoResolution: '4K',
        videoDurationSeconds: 30,
        frameCount: 1800,
      };

      const idleNode = createSampleNode({
        currentLoadPct: 10.0,
        p95LatencyMs: 5.0,
        spotPriceCentsPerHour: 200,
        onDemandPriceCentsPerHour: 400, // 50% discount
      });

      const loadedNode = createSampleNode({
        currentLoadPct: 80.0,
        p95LatencyMs: 40.0,
        spotPriceCentsPerHour: 350,
        onDemandPriceCentsPerHour: 400,
      });

      const idleScore = calculateNodeFitnessScore(idleNode, job);
      const loadedScore = calculateNodeFitnessScore(loadedNode, job);

      expect(idleScore).toBeGreaterThan(loadedScore);
      expect(idleScore).toBeGreaterThan(60.0);
    });

    it('awards +10 regional proximity bonus when node matches preferred region', () => {
      const jobWithPref: VideoRenderJobInput = {
        jobId: 'job-1',
        tenantId: 'tenant-1',
        videoResolution: '4K',
        videoDurationSeconds: 30,
        frameCount: 1800,
        preferredRegion: 'apac-tokyo',
      };

      const nodeTokyo = createSampleNode({ region: 'apac-tokyo' });
      const nodeSingapore = createSampleNode({ region: 'apac-singapore' });

      const scoreTokyo = calculateNodeFitnessScore(nodeTokyo, jobWithPref);
      const scoreSingapore = calculateNodeFitnessScore(nodeSingapore, jobWithPref);

      expect(Number((scoreTokyo - scoreSingapore).toFixed(1))).toBe(10.0);
    });
  });

  describe('selectOptimalComputeNode', () => {
    it('verifies VRAM hardware constraints for 4K and 8K rendering', () => {
      const job4K: VideoRenderJobInput = {
        jobId: 'job-4k',
        tenantId: 'tenant-1',
        videoResolution: '4K',
        videoDurationSeconds: 30,
        frameCount: 1800,
      };

      const rtxNode = createSampleNode({
        nodeId: 'gpu-rtx-01',
        gpuModel: 'RTX4090',
        vramGbPerGpu: 24, // 24GB < 48GB required for 4K
        maxResolution: '1080p',
      });

      const h100Node = createSampleNode({
        nodeId: 'gpu-h100-01',
        gpuModel: 'H100',
        vramGbPerGpu: 80, // 80GB >= 48GB required
        maxResolution: '4K',
      });

      const optimal = selectOptimalComputeNode([rtxNode, h100Node], job4K);
      expect(optimal.nodeId).toBe('gpu-h100-01');
    });

    it('rejects saturated nodes with active jobs >= max concurrency', () => {
      const job: VideoRenderJobInput = {
        jobId: 'job-1',
        tenantId: 'tenant-1',
        videoResolution: '1080p',
        videoDurationSeconds: 30,
        frameCount: 900,
      };

      const busyNode = createSampleNode({
        nodeId: 'node-busy',
        activeRenderJobs: 32,
        maxConcurrency: 32,
      });

      const freeNode = createSampleNode({
        nodeId: 'node-free',
        activeRenderJobs: 5,
        maxConcurrency: 32,
      });

      const selected = selectOptimalComputeNode([busyNode, freeNode], job);
      expect(selected.nodeId).toBe('node-free');
    });
  });

  describe('estimateRenderMetrics', () => {
    it('guarantees 4K render duration estimate is well under 15s SLA target', () => {
      const job: VideoRenderJobInput = {
        jobId: 'job-1',
        tenantId: 'tenant-1',
        videoResolution: '4K',
        videoDurationSeconds: 60, // 60s video
        frameCount: 3600,
      };

      const h100Node = createSampleNode({ gpuModel: 'H100', currentLoadPct: 20.0 });
      const { estimatedDurationMs, estimatedCostCents } = estimateRenderMetrics(h100Node, job);

      // H100 renders 60s of 4K video in ~6.5s (well under 15,000ms SLA target)
      expect(estimatedDurationMs).toBeLessThan(GATE_10_CONSTANTS.FOUR_K_MAX_RENDER_MS);
      expect(estimatedCostCents).toBeGreaterThan(0);
    });
  });

  describe('D1 Database Dispatches & Failover Rerouting', () => {
    beforeEach(async () => {
      // Seed 2 nodes
      await db
        .prepare(
          `INSERT INTO gpu_compute_nodes (
            id, node_id, region, gpu_model, gpu_count, vram_gb_per_gpu, total_vram_gb,
            status, current_load_pct, active_render_jobs, max_concurrency, p95_latency_ms,
            spot_price_cents_per_hour, on_demand_price_cents_per_hour, supported_codecs_json,
            max_resolution, health_score, is_healthy
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'id-node-1',
          'gpu-tokyo-h100-01',
          'apac-tokyo',
          'H100',
          8,
          80,
          640,
          'online',
          15.0,
          2,
          32,
          10.5,
          250,
          400,
          '["h264","hevc","av1","prores"]',
          '4K',
          1.0,
          1,
        )
        .run();

      await db
        .prepare(
          `INSERT INTO gpu_compute_nodes (
            id, node_id, region, gpu_model, gpu_count, vram_gb_per_gpu, total_vram_gb,
            status, current_load_pct, active_render_jobs, max_concurrency, p95_latency_ms,
            spot_price_cents_per_hour, on_demand_price_cents_per_hour, supported_codecs_json,
            max_resolution, health_score, is_healthy
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          'id-node-2',
          'gpu-sg-a100-02',
          'apac-singapore',
          'A100',
          8,
          80,
          640,
          'online',
          25.0,
          3,
          32,
          15.2,
          220,
          350,
          '["h264","hevc","av1","prores"]',
          '4K',
          1.0,
          1,
        )
        .run();
    });

    it('dispatches a 4K render job, updates node load, and persists dispatch record', async () => {
      const jobInput: VideoRenderJobInput = {
        jobId: 'job-render-4k-01',
        tenantId: 'tenant-enterprise-99',
        videoResolution: '4K',
        videoDurationSeconds: 45,
        frameCount: 2700,
        preferredRegion: 'apac-tokyo',
      };

      const result = await dispatchRenderJob(db, jobInput);

      expect(result.dispatchId).toMatch(/^disp_/);
      expect(result.selectedNodeId).toBe('gpu-tokyo-h100-01');
      expect(result.slaTargetMs).toBe(15000);
      expect(result.estimatedDurationMs).toBeLessThan(15000);

      // Verify node load was incremented in DB
      const updatedNode = await db
        .prepare('SELECT * FROM gpu_compute_nodes WHERE node_id = ?')
        .bind('gpu-tokyo-h100-01')
        .first<{ active_render_jobs: number; current_load_pct: number }>();

      expect(updatedNode?.active_render_jobs).toBe(3); // 2 + 1
      expect(updatedNode?.current_load_pct).toBeGreaterThan(15.0);
    });

    it('executes sub-20ms failover rerouting when node fails mid-render', async () => {
      const jobInput: VideoRenderJobInput = {
        jobId: 'job-failover-test',
        tenantId: 'tenant-enterprise-99',
        videoResolution: '4K',
        videoDurationSeconds: 30,
        frameCount: 1800,
      };

      const dispatch = await dispatchRenderJob(db, jobInput);
      expect(dispatch.selectedNodeId).toBe('gpu-tokyo-h100-01');

      // Simulate failure of tokyo node
      const reroute = await rerouteInFlightJob(
        db,
        dispatch.dispatchId,
        'gpu-tokyo-h100-01',
        'simulated_kernel_panic',
      );

      expect(reroute.success).toBe(true);
      expect(reroute.previousNodeId).toBe('gpu-tokyo-h100-01');
      expect(reroute.newNodeId).toBe('gpu-sg-a100-02');
      expect(reroute.isSub20ms).toBe(true);
      expect(reroute.rerouteDurationMs).toBeLessThan(20.0);

      // Verify failed node marked degraded
      const failedNode = await db
        .prepare('SELECT * FROM gpu_compute_nodes WHERE node_id = ?')
        .bind('gpu-tokyo-h100-01')
        .first<{ status: string; is_healthy: number }>();

      expect(failedNode?.status).toBe('degraded');
      expect(failedNode?.is_healthy).toBe(0);

      // Verify dispatch record shows rerouted status
      const updatedDispatch = await db
        .prepare('SELECT * FROM video_render_dispatches WHERE dispatch_id = ?')
        .bind(dispatch.dispatchId)
        .first<{ status: string; node_id: string; reroute_count: number }>();

      expect(updatedDispatch?.status).toBe('rerouted');
      expect(updatedDispatch?.node_id).toBe('gpu-sg-a100-02');
      expect(updatedDispatch?.reroute_count).toBe(1);
    });

    it('records completed render job and checks SLA breach status', async () => {
      const jobInput: VideoRenderJobInput = {
        jobId: 'job-completion-test',
        tenantId: 'tenant-enterprise-99',
        videoResolution: '4K',
        videoDurationSeconds: 30,
        frameCount: 1800,
      };

      const dispatch = await dispatchRenderJob(db, jobInput);

      // Completed in 8,500ms (< 15,000ms SLA target)
      const completeRes = await completeRenderJob(db, dispatch.dispatchId, 8500, 1024000);

      expect(completeRes.status).toBe('completed');
      expect(completeRes.slaBreached).toBe(false);

      const dispatchRecord = await db
        .prepare('SELECT * FROM video_render_dispatches WHERE dispatch_id = ?')
        .bind(dispatch.dispatchId)
        .first<{ status: string; sla_breached: number; render_duration_ms: number }>();

      expect(dispatchRecord?.status).toBe('completed');
      expect(dispatchRecord?.sla_breached).toBe(0);
      expect(dispatchRecord?.render_duration_ms).toBe(8500);
    });

    it('flags SLA breach when render job exceeds 15,000ms SLA target', async () => {
      const jobInput: VideoRenderJobInput = {
        jobId: 'job-breached-test',
        tenantId: 'tenant-enterprise-99',
        videoResolution: '4K',
        videoDurationSeconds: 30,
        frameCount: 1800,
      };

      const dispatch = await dispatchRenderJob(db, jobInput);

      // Completed in 18,200ms (> 15,000ms SLA target)
      const completeRes = await completeRenderJob(db, dispatch.dispatchId, 18200);

      expect(completeRes.status).toBe('completed');
      expect(completeRes.slaBreached).toBe(true);

      const dispatchRecord = await db
        .prepare('SELECT * FROM video_render_dispatches WHERE dispatch_id = ?')
        .bind(dispatch.dispatchId)
        .first<{ sla_breached: number }>();

      expect(dispatchRecord?.sla_breached).toBe(1);
    });

    it('aggregates topology, regional capacity, and GPU model distribution', async () => {
      const topology = await getMeshTopology(db);

      expect(topology.totalNodes).toBe(2);
      expect(topology.onlineNodes).toBe(2);
      expect(topology.totalGpus).toBe(16);
      expect(topology.totalVramGb).toBe(1280);
      expect(topology.regionCapacities.length).toBe(2);
      expect(topology.modelsSummary.H100.count).toBe(1);
      expect(topology.modelsSummary.A100.count).toBe(1);
    });
  });
});
