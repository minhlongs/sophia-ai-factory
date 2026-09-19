/**
 * Multi-Track Mission Orchestrator Unit Tests.
 *
 * Validates:
 * 1. Multi-Track Orchestration: Track 1 (script) -> Parallel Track 2 (audio) & Track 3 (visuals) -> Track 4 (video compositing).
 * 2. Concurrency & OCC CAS Transitions: draft/planned -> running -> review (on success) or failed (on error).
 * 3. Tenant-Scoped R2 Media Vaulting & Content Assets persistence.
 * 4. Path traversal sanitization in tenant storage keys.
 * 5. Track failure cascading and error recovery.
 * 6. Live track status querying.
 *
 * @module forest/mission/__tests__/multi-track-orchestrator.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { posix } from 'node:path';
import {
  executeMultiTrackMission,
  getMissionTrackStatus,
  formatTenantAssetKey,
  parseScriptIntoScenes,
  clearTrackStatusCache,
  saveCheckpoint,
  getCachedTrackStatus,
  type MissionTrackStatus,
} from '../multi-track-orchestrator';
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

// ── Deterministic SQLite Shim ────────────────────────────────────────────────
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
`;

let memDb: InstanceType<typeof DatabaseSync>;
let activeD1: ReturnType<typeof makeD1>;

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => activeD1),
}));

// ── Mock Providers Setup ─────────────────────────────────────────────────────

function createMockProviders(overrides?: {
  scriptFail?: boolean;
  audioFail?: boolean;
  imageFail?: boolean;
  videoFail?: boolean;
}): MultiTrackProviders {
  const scriptProvider: Provider = {
    id: 'openrouter',
    label: 'Mock Script Provider',
    chat: vi.fn(async (_messages: ChatMessage[], _options: ChatOptions): Promise<ChatResponse> => {
      if (overrides?.scriptFail) {
        throw new Error('Script synthesis API timeout');
      }
      const structuredContent = JSON.stringify({
        title: 'AI Automation Video 2026',
        narration: 'Here is why AI automation will change everything in 2026. Watch how agents build products.',
        scenes: [
          { index: 1, prompt: 'Founder working at futuristic desk with holographic displays', narration: 'Here is why AI automation will change everything.' },
          { index: 2, prompt: 'Automated agent pipelines rendering video assets at lightspeed', narration: 'Watch how agents build products.' },
        ],
      });
      return {
        content: structuredContent,
        model: 'openrouter/auto',
        provider: 'openrouter',
        usage: { inputTokens: 50, outputTokens: 100 },
        stopReason: 'end_turn',
        latencyMs: 150,
      };
    }),
    stream: vi.fn(),
    countTokens: vi.fn(() => 50),
    estimateCost: vi.fn(() => 0.002),
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
    label: 'Mock Audio Provider',
    generateSpeech: vi.fn(async (input: AudioGenerationInput): Promise<AudioGenerationResult> => {
      if (overrides?.audioFail) {
        throw new Error('ElevenLabs TTS voice synthesis failed');
      }
      return {
        audioBuffer: new ArrayBuffer(1024),
        durationSeconds: 28.5,
        mimeType: 'audio/mpeg',
        provider: 'elevenlabs',
        latencyMs: 300,
        audioUrl: 'https://vault.test/audio/sample.mp3',
      };
    }),
  };

  const imageProvider: ImageGenerationProvider = {
    id: 'fal-ai',
    label: 'Mock Image Provider',
    capabilities: () => ({ supportsAspectRatio: true, supportsStyle: true, maxConcurrency: 4 }),
    health: async () => ({ healthy: true }),
    generate: vi.fn(async (input: ImageGenerationInput): Promise<ImageGenerationResult> => {
      if (overrides?.imageFail) {
        throw new Error('fal.ai image generation rate limited');
      }
      return {
        assetRef: `https://vault.test/frames/${Date.now()}.png`,
        provider: 'fal-ai',
        latencyMs: 250,
        requestedAt: Math.floor(Date.now() / 1000),
        costCents: 1,
        costClassification: 'METERED',
      };
    }),
  };

  const videoProvider: IVideoRenderingProvider = {
    id: 'replicate',
    label: 'Mock Video Provider',
    renderVideo: vi.fn(async (_input: VideoRenderInput): Promise<{ jobId: string }> => {
      if (overrides?.videoFail) {
        throw new Error('Replicate video compositing job failed');
      }
      return { jobId: 'job_rep_vid_999' };
    }),
    checkStatus: vi.fn(async (_jobId: string): Promise<VideoRenderStatus> => ({
      status: 'completed',
      videoUrl: 'https://vault.test/video/final.mp4',
    })),
    health: async () => ({ healthy: true }),
  };

  return {
    scriptProvider,
    audioProvider,
    imageProvider,
    videoProvider,
  };
}

describe('forest/mission/multi-track-orchestrator', () => {
  beforeEach(() => {
    memDb = new DatabaseSync(':memory:');
    memDb.exec(TEST_SCHEMA);
    activeD1 = makeD1(memDb);
    clearTrackStatusCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearTrackStatusCache();
  });

  // ── 1. Key Formatting & Path Traversal Sanitization ───────────────────────
  describe('formatTenantAssetKey', () => {
    it('formats canonical tenant-scoped R2 key', () => {
      const key = formatTenantAssetKey('ws_tenant_1', 'msn_001', 'audio', 'ast_123', 'mp3');
      expect(key).toBe('tenants/ws_tenant_1/missions/msn_001/assets/audio_ast_123.mp3');
    });

    it('sanitizes directory traversal sequences in tenantId and missionId', () => {
      const key = formatTenantAssetKey('../../root', '../msn_secret', 'video', 'vid_1', '.mp4');
      expect(key).not.toContain('..');
      expect(key).toBe('tenants/root/missions/msn_secret/assets/video_vid_1.mp4');
    });

    it('sanitizes malicious directory traversal payloads in ext parameter', () => {
      const maliciousExts = [
        '../../../../../../../escape.txt',
        '..\\..\\..\\win_escape.png',
        '/etc/passwd',
        '../../../root.mp4',
        '.png/../../../evil.txt',
        'mp4?query=123#fragment',
        'json\0nullbyte.txt',
      ];

      for (const ext of maliciousExts) {
        const key = formatTenantAssetKey('ws_tenant_1', 'msn_123', 'visual', 'ast_456', ext);

        // Must not contain any .. relative path segments
        expect(key).not.toContain('..');
        // Must strictly start with the tenant namespace
        expect(key.startsWith('tenants/ws_tenant_1/missions/msn_123/assets/')).toBe(true);

        // posix.normalize must never escape the tenant namespace
        const normalized = posix.normalize(key);
        expect(normalized.startsWith('tenants/ws_tenant_1/')).toBe(true);
      }
    });

    it('whitelists path segments and handles special characters safely', () => {
      const key = formatTenantAssetKey('..//ws-clean!!', '../../msn..evil', 'audio!!', 'ast#1', '.mp3');
      expect(key).toBe('tenants/ws-clean/missions/msnevil/assets/audio_ast1.mp3');
      expect(posix.normalize(key)).toBe('tenants/ws-clean/missions/msnevil/assets/audio_ast1.mp3');
    });

    it('falls back to safe default segment tokens when all characters are stripped', () => {
      const key = formatTenantAssetKey('...', '///', '***', '###', '...');
      expect(key).toBe('tenants/tenant/missions/mission/assets/track_asset.bin');
      expect(posix.normalize(key).startsWith('tenants/tenant/')).toBe(true);
    });
  });

  // ── 2. Script Parser ─────────────────────────────────────────────────────
  describe('parseScriptIntoScenes', () => {
    it('parses structured JSON script output correctly', () => {
      const json = JSON.stringify({
        title: 'Growth Hacks',
        narration: 'Learn the top 3 growth hacks for founders.',
        scenes: [
          { index: 1, prompt: 'Founder looking at viral metrics graph', narration: 'First hack is distribution.' },
          { index: 2, prompt: 'Automated newsletter system send button', narration: 'Second is retention.' },
        ],
      });
      const parsed = parseScriptIntoScenes(json, 'Growth Hacks');
      expect(parsed.title).toBe('Growth Hacks');
      expect(parsed.scenes.length).toBe(2);
      expect(parsed.scenes[0].prompt).toContain('Founder looking at viral metrics');
      expect(parsed.wordCount).toBeGreaterThan(0);
    });

    it('parses scene marker text structure correctly', () => {
      const text = `
Scene 1:
Visual: Futuristic laboratory glowing blue
Narration: Science is changing fast.

Scene 2:
Visual: Quantum computer processor floating in zero-g
Narration: Here is the future of computing.
`;
      const parsed = parseScriptIntoScenes(text, 'Quantum Computing');
      expect(parsed.scenes.length).toBe(2);
      expect(parsed.scenes[0].prompt).toBe('Futuristic laboratory glowing blue');
      expect(parsed.scenes[1].narration).toBe('Here is the future of computing.');
    });

    it('falls back to paragraph division when unstructured text is provided', () => {
      const text = `Artificial intelligence is transforming every industry.\n\nFrom automated factories to creative studios, machines and humans collaborate.`;
      const parsed = parseScriptIntoScenes(text, 'AI Evolution', 2);
      expect(parsed.scenes.length).toBe(2);
      expect(parsed.fullNarration).toContain('Artificial intelligence');
    });
  });

  // ── 3. Full Multi-Track Pipeline Execution ─────────────────────────────────
  describe('executeMultiTrackMission (Happy Path)', () => {
    it('orchestrates all 4 tracks, performs OCC CAS transitions, and vaults assets', async () => {
      const missionId = 'msn_multi_happy_1';
      const workspaceId = 'ws_enterprise_100';
      const creatorId = 'usr_creator_99';

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, objective, status, current_phase, constraints)
           VALUES (?, ?, ?, 'Viral AI Explainer', 'Drive engagement', 'planned', 'planning', ?)`
        )
        .bind(
          missionId,
          workspaceId,
          creatorId,
          JSON.stringify({ durationSeconds: 30, estimatedScenes: 2, aspectRatio: '9:16' })
        )
        .run();

      const providers = createMockProviders();
      const phases: string[] = [];
      const trackProgress: string[] = [];

      const result = await executeMultiTrackMission(missionId, {
        userId: creatorId,
        workspaceId,
        providers,
        checkpointCallback: (ts, phase) => {
          phases.push(phase);
          trackProgress.push(JSON.stringify(ts));
        },
      });

      // Verification: Success & Final CAS state
      expect(result.success).toBe(true);
      expect(result.status).toBe('review');
      expect(result.currentPhase).toBe('review');

      // Verification: All 4 tracks completed
      expect(result.trackStatus).toEqual({
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      });

      // Verification: DB CAS status updated to 'review'
      const updatedRow = await activeD1
        .prepare('SELECT status, current_phase, constraints FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ status: string; current_phase: string; constraints: string }>();

      expect(updatedRow?.status).toBe('review');
      expect(updatedRow?.current_phase).toBe('review');
      const constraints = JSON.parse(updatedRow?.constraints || '{}');
      expect(constraints.track_status).toEqual({
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      });

      // Verification: Provider call order
      expect(providers.scriptProvider.chat).toHaveBeenCalledTimes(1);
      expect(providers.audioProvider.generateSpeech).toHaveBeenCalledTimes(1);
      expect(providers.imageProvider.generate).toHaveBeenCalledTimes(2); // 2 scenes
      expect(providers.videoProvider.renderVideo).toHaveBeenCalledTimes(1);

      // Verification: Content assets persisted with tenant-scoped keys
      const assets = await activeD1
        .prepare('SELECT type, storage_key, mime_type, status FROM content_assets WHERE project_id = ?')
        .bind(missionId)
        .all<{ type: string; storage_key: string; mime_type: string; status: string }>();

      expect(assets.results?.length).toBe(5); // 1 script + 1 audio + 2 frames + 1 video
      const scriptAsset = assets.results?.find((a) => a.type === 'script');
      const audioAsset = assets.results?.find((a) => a.type === 'audio');
      const imageAssets = assets.results?.filter((a) => a.type === 'image');
      const videoAsset = assets.results?.find((a) => a.type === 'video');

      expect(scriptAsset?.storage_key).toContain(`tenants/${workspaceId}/missions/${missionId}/assets/script_`);
      expect(audioAsset?.storage_key).toContain(`tenants/${workspaceId}/missions/${missionId}/assets/audio_`);
      expect(audioAsset?.mime_type).toBe('audio/mpeg');
      expect(imageAssets?.length).toBe(2);
      expect(imageAssets?.[0].storage_key).toContain(`tenants/${workspaceId}/missions/${missionId}/assets/visual_`);
      expect(videoAsset?.storage_key).toContain(`tenants/${workspaceId}/missions/${missionId}/assets/video_`);
      expect(videoAsset?.mime_type).toBe('video/mp4');

      // Verification: Phase checkpoints executed in order
      expect(phases).toContain('script_generation');
      expect(phases).toContain('voice_and_visuals');
      expect(phases).toContain('video_compositing');
      expect(phases).toContain('review');
    });
  });

  // ── 4. Concurrency & OCC CAS Transitions ─────────────────────────────────
  describe('Concurrency & State Machine Locking', () => {
    it('rejects starting mission from terminal completed state', async () => {
      const missionId = 'msn_completed_terminal';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Finished Mission', 'completed')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders();
      await expect(
        executeMultiTrackMission(missionId, { providers })
      ).rejects.toMatchObject({
        code: 'EXECUTION_START_INVALID',
      });
    });

    it('fails closed when mission is missing', async () => {
      const providers = createMockProviders();
      await expect(
        executeMultiTrackMission('msn_non_existent', { providers })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('detects concurrent modification when status is changed out of band', async () => {
      const missionId = 'msn_concurrent_mod';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Concurrent Test', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders();

      // Intercept video render to simulate out-of-band cancellation before final CAS
      providers.videoProvider.renderVideo = vi.fn(async () => {
        await activeD1
          .prepare("UPDATE creative_missions SET status = 'cancelled' WHERE id = ?")
          .bind(missionId)
          .run();
        return { jobId: 'job_cancelled_123' };
      });

      const res = await executeMultiTrackMission(missionId, { providers });
      expect(res.success).toBe(false);
      expect(res.error).toContain('CONCURRENT_MODIFICATION');
    });
  });

  // ── 5. Track Failure Cascading ───────────────────────────────────────────
  describe('Track Failure Cascading', () => {
    it('cascades failure when Track 1 (script synthesis) throws', async () => {
      const missionId = 'msn_script_fails';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Fail Script', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders({ scriptFail: true });
      const res = await executeMultiTrackMission(missionId, { providers });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.script).toBe('failed');
      expect(res.trackStatus.audio).toBe('pending');
      expect(res.trackStatus.visual).toBe('pending');
      expect(res.error).toContain('Script synthesis API timeout');

      // Audio & image providers should never have been called
      expect(providers.audioProvider.generateSpeech).not.toHaveBeenCalled();
      expect(providers.imageProvider.generate).not.toHaveBeenCalled();
    });

    it('cascades failure when Track 2 (audio) throws in parallel execution', async () => {
      const missionId = 'msn_audio_fails';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Fail Audio', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders({ audioFail: true });
      const res = await executeMultiTrackMission(missionId, { providers });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.audio).toBe('failed');
      expect(res.trackStatus.script).toBe('completed');
      expect(res.error).toContain('ElevenLabs TTS voice synthesis failed');

      // Video compositing must NOT be called if audio fails
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();
    });

    it('cascades failure when Track 3 (visual frames) throws in parallel execution', async () => {
      const missionId = 'msn_visual_fails';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Fail Visual', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders({ imageFail: true });
      const res = await executeMultiTrackMission(missionId, { providers });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.visual).toBe('failed');
      expect(res.error).toContain('fal.ai image generation rate limited');
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();
    });

    it('cascades failure when Track 4 (video compositing) throws', async () => {
      const missionId = 'msn_video_fails';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Fail Video', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders({ videoFail: true });
      const res = await executeMultiTrackMission(missionId, { providers });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.script).toBe('completed');
      expect(res.trackStatus.audio).toBe('completed');
      expect(res.trackStatus.visual).toBe('completed');
      expect(res.trackStatus.video).toBe('failed');
      expect(res.error).toContain('Replicate video compositing job failed');
    });
  });

  // ── 6. Live Track Status Querying ─────────────────────────────────────────
  describe('getMissionTrackStatus', () => {
    it('reads track status accurately from D1 constraints', async () => {
      const missionId = 'msn_status_query_1';
      const expectedStatus = {
        script: 'completed' as const,
        audio: 'running' as const,
        visual: 'running' as const,
        video: 'pending' as const,
      };

      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase, constraints)
           VALUES (?, 'ws_1', 'usr_1', 'Status Test', 'running', 'voice_and_visuals', ?)`
        )
        .bind(missionId, JSON.stringify({ track_status: expectedStatus }))
        .run();

      const status = await getMissionTrackStatus(missionId);
      expect(status).toEqual(expectedStatus);
    });

    it('infers status cleanly when constraints.track_status is not yet populated', async () => {
      const missionId = 'msn_status_infer_review';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, 'ws_1', 'usr_1', 'Infer Test', 'review', 'review')`
        )
        .bind(missionId)
        .run();

      const status = await getMissionTrackStatus(missionId);
      expect(status).toEqual({
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      });
    });
  });

  // ── 7. saveCheckpoint State Validation & Fail-Closed Guards ───────────────
  describe('saveCheckpoint state validation', () => {
    it('fails closed when mission status is "failed"', async () => {
      const missionId = 'msn_failed_checkpoint';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, 'ws_1', 'usr_1', 'Failed Mission', 'failed', 'failed')`
        )
        .bind(missionId)
        .run();

      const trackStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'failed',
        visual: 'completed',
        video: 'pending',
      };

      await expect(
        saveCheckpoint(missionId, trackStatus, 'voice_and_visuals')
      ).rejects.toThrow(/status is 'failed', expected 'running'/);

      // Verify DB current_phase remains 'failed' and was not overwritten
      const row = await activeD1
        .prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ status: string; current_phase: string }>();

      expect(row?.status).toBe('failed');
      expect(row?.current_phase).toBe('failed');
    });

    it('fails closed when mission status is "completed" or "review"', async () => {
      const missionId = 'msn_completed_checkpoint';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, 'ws_1', 'usr_1', 'Review Mission', 'review', 'review')`
        )
        .bind(missionId)
        .run();

      const trackStatus: MissionTrackStatus = {
        script: 'completed',
        audio: 'completed',
        visual: 'completed',
        video: 'completed',
      };

      await expect(
        saveCheckpoint(missionId, trackStatus, 'composited')
      ).rejects.toThrow(/status is 'review', expected 'running'/);

      const row = await activeD1
        .prepare('SELECT current_phase FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ current_phase: string }>();

      expect(row?.current_phase).toBe('review');
    });

    it('throws NOT_FOUND when mission does not exist in database', async () => {
      const trackStatus: MissionTrackStatus = {
        script: 'running',
        audio: 'pending',
        visual: 'pending',
        video: 'pending',
      };

      await expect(
        saveCheckpoint('msn_non_existent', trackStatus, 'executing')
      ).rejects.toThrow(/not found/);
    });
  });

  // ── 8. Accurate Sub-Track Failure Attribution ─────────────────────────────
  describe('Accurate Sub-Track Failure Attribution', () => {
    it('marks only Track 2 as failed and sibling running Track 3 as cancelled when audio fails', async () => {
      const missionId = 'msn_audio_fails_precise';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Audio Fail Precision', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders({ audioFail: true });
      const res = await executeMultiTrackMission(missionId, { providers });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.script).toBe('completed');
      expect(res.trackStatus.audio).toBe('failed');
      // Visual was running when audio threw; it must be marked cancelled, NOT failed!
      expect(res.trackStatus.visual).toBe('cancelled');
      expect(res.trackStatus.video).toBe('pending');
    });

    it('marks only Track 3 as failed and sibling running Track 2 as cancelled when visual fails', async () => {
      const missionId = 'msn_visual_fails_precise';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Visual Fail Precision', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders({ imageFail: true });
      const res = await executeMultiTrackMission(missionId, { providers });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.script).toBe('completed');
      expect(res.trackStatus.visual).toBe('failed');
      // Audio was running when visual threw; it must be marked cancelled, NOT failed!
      expect(res.trackStatus.audio).toBe('cancelled');
      expect(res.trackStatus.video).toBe('pending');
    });

    it('preserves completed tracks when video compositing fails', async () => {
      const missionId = 'msn_video_fails_preserve';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Video Fail Preserved', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders({ videoFail: true });
      const res = await executeMultiTrackMission(missionId, { providers });

      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.trackStatus.script).toBe('completed');
      expect(res.trackStatus.audio).toBe('completed');
      expect(res.trackStatus.visual).toBe('completed');
      expect(res.trackStatus.video).toBe('failed');
    });
  });

  // ── 9. Dangling Promise State Overwrite Guard ──────────────────────────────
  describe('Dangling Promise State Overwrite Guard', () => {
    it('prevents dangling sub-track from overwriting failed state when sibling fails', async () => {
      const missionId = 'msn_dangling_subtrack_test';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status, current_phase)
           VALUES (?, 'ws_1', 'usr_1', 'Dangling Test', 'running', 'executing')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders();
      // Audio fails early at 10ms
      providers.audioProvider.generateSpeech = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        throw new Error('ElevenLabs TTS Fast Failure');
      });
      // Visual runs slower at 50ms
      providers.imageProvider.generate = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return {
          assetRef: 'https://vault.test/delayed.png',
          provider: 'fal-ai',
          latencyMs: 50,
          requestedAt: Math.floor(Date.now() / 1000),
          costCents: 1,
          costClassification: 'METERED' as const,
        };
      });

      const res = await executeMultiTrackMission(missionId, { providers });
      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');

      // Wait 70ms to ensure any background work would have finished
      await new Promise((r) => setTimeout(r, 70));

      // Query DB to verify phase was NOT overwritten
      const dbRow = await activeD1
        .prepare('SELECT status, current_phase FROM creative_missions WHERE id = ?')
        .bind(missionId)
        .first<{ status: string; current_phase: string }>();

      expect(dbRow?.status).toBe('failed');
      expect(dbRow?.current_phase).toBe('failed'); // Must NOT be 'voice_and_visuals'
    });
  });

  // ── 10. Mid-Flight Cancellation Checks ────────────────────────────────────
  describe('Mid-Flight Cancellation Checks', () => {
    it('halts execution before Track 2/3 when mission is cancelled in DB', async () => {
      const missionId = 'msn_midflight_cancel_test';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Cancel Test', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders();
      // Simulate out-of-band cancellation during script synthesis
      const originalChat = providers.scriptProvider.chat;
      providers.scriptProvider.chat = vi.fn(async (msgs, opts) => {
        const res = await originalChat(msgs, opts);
        await activeD1
          .prepare("UPDATE creative_missions SET status = 'cancelled' WHERE id = ?")
          .bind(missionId)
          .run();
        return res;
      });

      const res = await executeMultiTrackMission(missionId, { providers });
      expect(res.success).toBe(false);
      expect(res.status).toBe('cancelled');
      expect(providers.audioProvider.generateSpeech).not.toHaveBeenCalled();
      expect(providers.imageProvider.generate).not.toHaveBeenCalled();
      expect(providers.videoProvider.renderVideo).not.toHaveBeenCalled();
    });
  });

  // ── 11. In-Memory Cache Eviction ──────────────────────────────────────────
  describe('In-Memory Cache Eviction', () => {
    it('evicts completed and failed missions from liveTrackStatusMap', async () => {
      const missionId = 'msn_cache_evict_test';
      await activeD1
        .prepare(
          `INSERT INTO creative_missions (id, workspace_id, creator_id, title, status)
           VALUES (?, 'ws_1', 'usr_1', 'Cache Test', 'running')`
        )
        .bind(missionId)
        .run();

      const providers = createMockProviders();
      await executeMultiTrackMission(missionId, { providers });

      // In-memory cache must be cleared upon terminal review transition
      expect(getCachedTrackStatus(missionId)).toBeUndefined();

      // DB must retain track status
      const liveStatus = await getMissionTrackStatus(missionId);
      expect(liveStatus.video).toBe('completed');
    });
  });
});
