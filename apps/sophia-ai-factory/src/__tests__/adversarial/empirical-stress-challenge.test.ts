/**
 * Empirical Adversarial Stress Test Harness.
 * 
 * Testing:
 * 1. OCC CAS concurrency in scheduler.ts (atomicClaimJob) & multi-track-orchestrator.ts
 * 2. Failure cascades & dangling promises (ElevenLabs failure vs fal.ai success, error isolation, deadlock freedom)
 * 3. Exponential backoff bounds [30, 60, 300, 900, 3600] and HTTP 429 Retry-After clamping
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { D1Client } from '@/seed/db/d1-client-rpc';
import { atomicClaimJob } from '@/land/video/publishing/publish-claim';
import {
  RETRY_BACKOFF_SCHEDULE_SECONDS,
  getBackoffDelaySeconds,
} from '@/forest/inngest/functions/publish-execute';
import { extractRetryAfterMs } from '@/land/video/publishing/publish-upload';
import {
  executeMultiTrackMission,
  transitionStatusCAS,
  saveCheckpoint,
  getCachedTrackStatus,
  clearTrackStatusCache,
} from '@/forest/mission/multi-track-orchestrator';
import type { MultiTrackProviders } from '@/forest/ai/provider-factory';
import type { Provider, ChatMessage, ChatOptions, ChatResponse } from '@/seed/ai/provider-interface';
import type {
  IAudioProvider,
  AudioGenerationInput,
  AudioGenerationResult,
  ImageGenerationProvider,
  ImageGenerationInput,
  ImageGenerationResult,
  IVideoRenderingProvider,
  VideoRenderInput,
  VideoRenderStatus,
} from '@/seed/ai/multimodal-provider-interface';

// ── Deterministic SQLite Shim for D1 ─────────────────────────────────────────
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

type StatementSync = ReturnType<InstanceType<typeof DatabaseSync>['prepare']>;

function makeD1(db: InstanceType<typeof DatabaseSync>) {
  return {
    prepare(sql: string) {
      const stmt: StatementSync = db.prepare(sql);
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
    exec: (sql: string) => db.exec(sql),
  };
}

const TEST_SCHEMA = `
CREATE TABLE IF NOT EXISTS creative_missions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  geography TEXT NOT NULL DEFAULT 'global',
  timeframe_start INTEGER NOT NULL DEFAULT 0,
  timeframe_end INTEGER NOT NULL DEFAULT 0,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  autonomy_level INTEGER NOT NULL DEFAULT 2,
  channels TEXT NOT NULL DEFAULT '[]',
  monetization_goals TEXT NOT NULL DEFAULT '[]',
  constraints TEXT NOT NULL DEFAULT '{}',
  success_metrics TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  current_phase TEXT NOT NULL DEFAULT 'init',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_key TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS publishing_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  caption TEXT,
  hashtags_json TEXT,
  product_link TEXT,
  scheduled_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  retry_count INTEGER DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL
);
`;

let memDb: InstanceType<typeof DatabaseSync>;
let activeD1: any;
let d1Client: D1Client;

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => activeD1),
  createServerClient: vi.fn(() => d1Client),
}));

// ── Mock Providers Builder ──────────────────────────────────────────────────
function buildMockProviders(options?: {
  scriptFail?: boolean;
  audioFail?: boolean;
  audioDelayMs?: number;
  imageFail?: boolean;
  imageDelayMs?: number;
  videoFail?: boolean;
}): MultiTrackProviders {
  const scriptProvider: Provider = {
    id: 'openrouter',
    label: 'Script Mock',
    chat: vi.fn(async (_msgs: ChatMessage[], _opts: ChatOptions): Promise<ChatResponse> => {
      if (options?.scriptFail) throw new Error('OpenRouter 504 Gateway Timeout');
      return {
        content: JSON.stringify({
          title: 'Stress Test Title',
          narration: 'This is the test narration for adversarial stress verification.',
          scenes: [
            { index: 1, prompt: 'Visual prompt 1', narration: 'Narration 1' },
            { index: 2, prompt: 'Visual prompt 2', narration: 'Narration 2' },
          ],
        }),
        model: 'openrouter/auto',
        provider: 'openrouter',
        usage: { inputTokens: 20, outputTokens: 40 },
        stopReason: 'end_turn',
        latencyMs: 10,
      };
    }),
    stream: vi.fn(),
    countTokens: vi.fn(() => 20),
    estimateCost: vi.fn(() => 0.001),
    getCapabilities: vi.fn(() => ({
      streaming: false,
      systemRole: true,
      maxOutputTokens: 2048,
      maxInputTokens: 4096,
      functionCalling: false,
      vision: false,
    })),
  };

  const audioProvider: IAudioProvider = {
    id: 'elevenlabs',
    label: 'ElevenLabs Mock',
    generateSpeech: vi.fn(async (_input: AudioGenerationInput): Promise<AudioGenerationResult> => {
      if (options?.audioDelayMs) {
        await new Promise((r) => setTimeout(r, options.audioDelayMs));
      }
      if (options?.audioFail) {
        throw new Error('ElevenLabs 429 Too Many Requests: Rate limit exceeded');
      }
      return {
        audioBuffer: new ArrayBuffer(512),
        durationSeconds: 15,
        mimeType: 'audio/mpeg',
        provider: 'elevenlabs',
        latencyMs: 50,
        audioUrl: 'https://vault.test/audio.mp3',
      };
    }),
  };

  const imageProvider: ImageGenerationProvider = {
    id: 'fal-ai',
    label: 'fal.ai Mock',
    capabilities: () => ({ supportsAspectRatio: true, supportsStyle: true, maxConcurrency: 4 }),
    health: async () => ({ healthy: true }),
    generate: vi.fn(async (input: ImageGenerationInput): Promise<ImageGenerationResult> => {
      if (options?.imageDelayMs) {
        await new Promise((r) => setTimeout(r, options.imageDelayMs));
      }
      if (options?.imageFail) {
        throw new Error('fal.ai 500 Internal Server Error: GPU out of memory');
      }
      return {
        assetRef: `https://vault.test/frames/${Date.now()}.png`,
        provider: 'fal-ai',
        latencyMs: 50,
        requestedAt: Math.floor(Date.now() / 1000),
        costCents: 1,
        costClassification: 'METERED',
      };
    }),
  };

  const videoProvider: IVideoRenderingProvider = {
    id: 'replicate',
    label: 'Replicate Video Mock',
    renderVideo: vi.fn(async (_input: VideoRenderInput): Promise<{ jobId: string }> => {
      if (options?.videoFail) {
        throw new Error('Replicate video rendering failure');
      }
      return { jobId: 'job_test_vid_123' };
    }),
    checkStatus: vi.fn(async (): Promise<VideoRenderStatus> => ({
      status: 'completed',
      videoUrl: 'https://vault.test/final.mp4',
    })),
    health: async () => ({ healthy: true }),
  };

  return { scriptProvider, audioProvider, imageProvider, videoProvider };
}

describe('Empirical Adversarial Stress Suite', () => {
  beforeEach(() => {
    memDb = new DatabaseSync(':memory:');
    memDb.exec(TEST_SCHEMA);
    activeD1 = makeD1(memDb);
    d1Client = new D1Client(activeD1 as any);
    clearTrackStatusCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearTrackStatusCache();
  });

  // ============================================================================
  // 1. CONCURRENCY STRESS & OCC CAS CHALLENGE
  // ============================================================================
  describe('1. Concurrency Stress: atomicClaimJob & OCC CAS', () => {
    it('OCC CAS atomicClaimJob returns claimed=true with uploading status upon winning claim', async () => {
      const now = Math.floor(Date.now() / 1000);
      memDb.exec(
        `INSERT INTO publishing_jobs (id, tenant_id, video_id, channel_id, status, scheduled_at, created_at)
         VALUES ('job-occ-1', 'tenant-1', 'vid-1', 'ch-1', 'scheduled', ${now - 10}, ${now - 20})`
      );

      const claimResult = await atomicClaimJob(d1Client as any, 'job-occ-1');
      const dbRow = memDb.prepare('SELECT status, started_at FROM publishing_jobs WHERE id = ?').get('job-occ-1') as any;

      // EMPIRICAL VERIFICATION:
      // dbRow.status was updated to 'uploading' in SQLite
      expect(dbRow.status).toBe('uploading');

      // Verified remediation: raw D1 prepare().bind().run() propagates meta.changes = 1
      expect(claimResult.claimed).toBe(true);
      expect(claimResult.status).toBe('uploading');
    });

    it('OCC CAS Concurrency: 50 concurrent workers race on job -> exactly 1 winner, 49 losers', async () => {
      const now = Math.floor(Date.now() / 1000);
      memDb.exec(
        `INSERT INTO publishing_jobs (id, tenant_id, video_id, channel_id, status, scheduled_at, created_at)
         VALUES ('job-race-1', 'tenant-1', 'vid-1', 'ch-1', 'scheduled', ${now - 10}, ${now - 20})`
      );

      const CONCURRENT_WORKERS = 50;
      const claimPromises = Array.from({ length: CONCURRENT_WORKERS }, () =>
        atomicClaimJob(d1Client as any, 'job-race-1')
      );

      const results = await Promise.all(claimPromises);
      const claimedWinners = results.filter((r) => r.claimed === true);
      const skippedLosers = results.filter((r) => r.claimed === false);

      // Expected by spec & verified by remediation: exactly 1 winner, 49 losers
      expect(claimedWinners.length).toBe(1);
      expect(skippedLosers.length).toBe(49);

      // The job status was changed to 'uploading' by the first worker in DB
      const dbRow = memDb.prepare('SELECT status FROM publishing_jobs WHERE id = ?').get('job-race-1') as any;
      expect(dbRow.status).toBe('uploading');
    });

    it('MULTI-TRACK-OCC-CAS: 20 concurrent workers executeMultiTrackMission on same mission (VERIFIED ROBUST)', async () => {
      const missionId = 'msn_concurrent_race_1';
      memDb.exec(
        `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
         VALUES ('${missionId}', 'ws_1', 'usr_1', 'Concurrent Race Mission', 'planned', 'planning')`
      );

      const providers = buildMockProviders();

      const executions = Array.from({ length: 20 }, () =>
        executeMultiTrackMission(missionId, {
          userId: 'usr_1',
          workspaceId: 'ws_1',
          providers,
        }).catch((err) => ({ success: false, error: err.message, status: 'thrown' }))
      );

      const settled = await Promise.all(executions);
      const successfulExecutions = settled.filter((s: any) => s.success === true);
      const failedExecutions = settled.filter((s: any) => s.success === false);

      // In multi-track-orchestrator, transitionStatusCAS uses raw getD1().prepare().run()
      // which properly returns meta.changes. Exactly 1 wins, 19 fail closed!
      expect(successfulExecutions.length).toBe(1);
      expect(failedExecutions.length).toBe(19);

      const finalDbRow = memDb.prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?').get(missionId) as any;
      expect(finalDbRow.status).toBe('review');
    });
  });

  // ============================================================================
  // 2. FAILURE CASCADES & DANGLING PROMISES CHALLENGE
  // ============================================================================
  describe('2. Failure Cascades & Dangling Promises (Multi-Track Orchestrator)', () => {
    it('ElevenLabs audio fails fast (10ms) while fal.ai image succeeds slowly (80ms): verify isolation & deadlock freedom', async () => {
      const missionId = 'msn_audio_fail_image_slow';
      memDb.exec(
        `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
         VALUES ('${missionId}', 'ws_1', 'usr_1', 'Audio Fail Image Slow', 'running', 'executing')`
      );

      const providers = buildMockProviders({
        audioFail: true,
        audioDelayMs: 10,
        imageFail: false,
        imageDelayMs: 80,
      });

      const startTime = Date.now();
      const res = await executeMultiTrackMission(missionId, {
        userId: 'usr_1',
        workspaceId: 'ws_1',
        providers,
      });
      const durationMs = Date.now() - startTime;

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.audio).toBe('failed');
      expect(res.trackStatus.video).toBe('pending');
      expect(res.error).toContain('ElevenLabs 429');

      // Video compositing must NOT have been called
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();

      // Mission status in DB must be 'failed'
      const row = memDb.prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?').get(missionId) as any;
      expect(row.status).toBe('failed');
      expect(row.current_phase).toBe('failed');
    });

    it('fal.ai image fails fast (10ms) while ElevenLabs audio succeeds slowly (80ms): verify clean abort without crash', async () => {
      const missionId = 'msn_image_fail_audio_slow';
      memDb.exec(
        `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
         VALUES ('${missionId}', 'ws_1', 'usr_1', 'Image Fail Audio Slow', 'running', 'executing')`
      );

      const providers = buildMockProviders({
        audioFail: false,
        audioDelayMs: 80,
        imageFail: true,
        imageDelayMs: 10,
      });

      const res = await executeMultiTrackMission(missionId, {
        userId: 'usr_1',
        workspaceId: 'ws_1',
        providers,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.visual).toBe('failed');
      expect(res.trackStatus.video).toBe('pending');
      expect(res.error).toContain('fal.ai 500');
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();

      const row = memDb.prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?').get(missionId) as any;
      expect(row.status).toBe('failed');
    });

    it('Dangling promise safety: lagging background callbacks must not overwrite DB state after failure', async () => {
      const missionId = 'msn_lagging_callback';
      memDb.exec(
        `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
         VALUES ('${missionId}', 'ws_1', 'usr_1', 'Lagging Callback Test', 'running', 'executing')`
      );

      const providers = buildMockProviders({
        audioFail: true,
        audioDelayMs: 10,
        imageFail: false,
        imageDelayMs: 100,
      });

      const res = await executeMultiTrackMission(missionId, {
        userId: 'usr_1',
        workspaceId: 'ws_1',
        providers,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');

      // Wait 150ms to ensure all background promises have settled
      await new Promise((r) => setTimeout(r, 150));

      const rowAfterWait = memDb.prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?').get(missionId) as any;
      expect(rowAfterWait.status).toBe('failed');
      expect(rowAfterWait.current_phase).toBe('failed');
    });
  });

  // ============================================================================
  // 3. EXPONENTIAL BACKOFF & 429 CLAMPING CHALLENGE
  // ============================================================================
  describe('3. Exponential Backoff & 429 Clamping', () => {
    it('Verifies retry queue delay bounds [30, 60, 300, 900, 3600] seconds for attempts 1..5+', () => {
      expect(RETRY_BACKOFF_SCHEDULE_SECONDS).toEqual([30, 60, 300, 900, 3600]);

      expect(getBackoffDelaySeconds(1)).toBe(30);
      expect(getBackoffDelaySeconds(2)).toBe(60);
      expect(getBackoffDelaySeconds(3)).toBe(300);
      expect(getBackoffDelaySeconds(4)).toBe(900);
      expect(getBackoffDelaySeconds(5)).toBe(3600);
      expect(getBackoffDelaySeconds(6)).toBe(3600);
      expect(getBackoffDelaySeconds(100)).toBe(3600);

      expect(getBackoffDelaySeconds(0)).toBe(30);
      expect(getBackoffDelaySeconds(-5)).toBe(30);
    });

    it('HTTP 429 Retry-After delayMs is safely clamped to [30, 3600] seconds and handles non-finite values', () => {
      // 24 hours delay: 86_400_000ms -> clamped to max 3600s
      const hugeDelaySec = getBackoffDelaySeconds(1, 86400000);
      expect(hugeDelaySec).toBe(3600);

      // Small delay: 5_000ms -> clamped to min 30s
      const smallDelaySec = getBackoffDelaySeconds(1, 5000);
      expect(smallDelaySec).toBe(30);

      // Infinity delay -> non-finite, falls back to attempt schedule (attempt 1 = 30s)
      const infinityDelaySec = getBackoffDelaySeconds(1, Infinity);
      expect(infinityDelaySec).toBe(30);

      // NaN delay -> non-finite, falls back to attempt schedule (attempt 2 = 60s)
      const nanDelaySec = getBackoffDelaySeconds(2, NaN);
      expect(nanDelaySec).toBe(60);
    });

    it('extractRetryAfterMs resilience against diverse header and error formats', () => {
      expect(extractRetryAfterMs({ retryAfterSec: 45 })).toBe(45000);
      expect(extractRetryAfterMs(new Error('Rate limit 429: Retry-After: 60s'))).toBe(60000);
      expect(extractRetryAfterMs(new Error('Rate limit 429: Retry-After: 120'))).toBe(120000);
      expect(extractRetryAfterMs(new Error('Random error'))).toBeUndefined();
      expect(extractRetryAfterMs(null)).toBeUndefined();
      expect(extractRetryAfterMs(undefined)).toBeUndefined();
    });
  });
});
