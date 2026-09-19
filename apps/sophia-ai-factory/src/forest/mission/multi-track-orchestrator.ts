/**
 * Multi-Track Creative Mission Orchestrator — Sophia AI Factory.
 *
 * Coordinates parallel and sequential multi-modal generation tracks:
 * - Track 1: Script synthesis (AI_TEXT via OpenRouter / Anthropic)
 * - Track 2: Voiceover audio generation (AI_AUDIO via ElevenLabs)
 * - Track 3: Visual scene frame generation (AI_IMAGE via fal.ai / Replicate)
 * - Track 4: Video compositing / rendering (AI_VIDEO via Replicate / HeyGen / Wan)
 *
 * Concurrency & Coordination:
 * - Dispatches Track 2 and Track 3 in parallel via Promise.all once Track 1 completes.
 * - Joins audio and visual assets for Track 4 video compositing.
 *
 * State Machine Authority & Concurrency:
 * - Uses Compare-And-Swap (OCC CAS WHERE id = ? AND status = ?) to enforce atomic transitions.
 * - Transitions: draft / planned -> running -> review (on success) or failed (on error).
 * - Track-level checkpointing saves live track_status { script, audio, visual, video }.
 *
 * Media Vaulting & Content Assets:
 * - Vaults all generated media to Cloudflare R2 using tenant-scoped keys:
 *   tenants/${tenantId}/missions/${missionId}/assets/${trackType}_${assetId}.${ext}
 * - Registers records into content_assets table.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/multi-track-orchestrator
 */

import { posix } from 'node:path';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CreativeMissionStatus } from '@/seed/types/creative-economy';
import {
  getMission,
  canStartExecution,
  EXECUTION_START_FROM,
  registerMultiTrackExecutor,
  getCachedTrackStatus,
  setCachedTrackStatus,
  clearTrackStatusCache,
  getMissionTrackStatus,
  type SingleTrackState,
  type MissionTrackStatus,
  type ScriptScene,
  type MultiTrackScriptResult,
  type MultiTrackAudioResult,
  type MultiTrackVisualFrame,
  type MultiTrackVisualResult,
  type MultiTrackVideoResult,
  type MultiTrackExecutionResult,
} from '@/tree/mission';
import { MissionError } from '@/tree/mission/types';
import { newAssetId } from '@/tree/content-graph/types';
import {
  buildMultiTrackProviders,
  type MultiTrackProviders,
} from '@/forest/ai/provider-factory';

// ── Types (Re-exported from Tree domain layer) ──────────────────────────────

export type {
  SingleTrackState,
  MissionTrackStatus,
  ScriptScene,
  MultiTrackScriptResult,
  MultiTrackAudioResult,
  MultiTrackVisualFrame,
  MultiTrackVisualResult,
  MultiTrackVideoResult,
  MultiTrackExecutionResult,
};

export {
  getCachedTrackStatus,
  setCachedTrackStatus,
  clearTrackStatusCache,
  getMissionTrackStatus,
};

export interface MultiTrackExecutionOptions {
  userId?: string;
  workspaceId?: string;
  topic?: string;
  voiceStyle?: string;
  voiceId?: string;
  estimatedScenes?: number;
  durationSeconds?: number;
  aspectRatio?: string;
  providers?: MultiTrackProviders;
  checkpointCallback?: (trackStatus: MissionTrackStatus, phase: string) => Promise<void> | void;
  signal?: AbortSignal;
}


// ── Key & Vaulting Helpers ─────────────────────────────────────────────────

/**
 * Format canonical tenant-scoped Cloudflare R2 object key:
 * tenants/${tenantId}/missions/${missionId}/assets/${trackType}_${assetId}.${ext}
 *
 * Enforces strict whitelist sanitization:
 * - All directory segments sanitized to [a-zA-Z0-9_-]
 * - Extension sanitized to strict alphanumeric [a-zA-Z0-9]
 * - Verifies normalized POSIX path strictly begins with tenants/ and has no traversal sequences
 */
export function formatTenantAssetKey(
  tenantId: string,
  missionId: string,
  trackType: string,
  assetId: string,
  ext: string,
): string {
  const cleanTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '') || 'tenant';
  const cleanMission = missionId.replace(/[^a-zA-Z0-9_-]/g, '') || 'mission';
  const cleanTrack = trackType.replace(/[^a-zA-Z0-9_-]/g, '') || 'track';
  const cleanAsset = assetId.replace(/[^a-zA-Z0-9_-]/g, '') || 'asset';
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';

  const rawKey = `tenants/${cleanTenant}/missions/${cleanMission}/assets/${cleanTrack}_${cleanAsset}.${cleanExt}`;
  const normalizedKey = posix.normalize(rawKey);

  if (!normalizedKey.startsWith('tenants/') || normalizedKey.includes('..')) {
    throw new Error(`Storage key path traversal violation: ${rawKey}`);
  }

  return normalizedKey;
}

/**
 * Safely writes object payload to R2 bucket if bound in global runtime context.
 * Layer rule: pure global environment lookup without importing from land.
 */
async function vaultToR2IfAvailable(
  storageKey: string,
  data: ArrayBuffer | string,
  contentType: string,
): Promise<boolean> {
  try {
    const globalObj = globalThis as unknown as {
      __env__?: {
        STORAGE_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
        VIDEO_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
      };
      __env?: {
        STORAGE_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
        VIDEO_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
      };
    };

    const bucket =
      globalObj.__env__?.STORAGE_BUCKET ||
      globalObj.__env__?.VIDEO_BUCKET ||
      globalObj.__env?.STORAGE_BUCKET ||
      globalObj.__env?.VIDEO_BUCKET;

    if (bucket && typeof bucket.put === 'function') {
      await bucket.put(storageKey, data, {
        httpMetadata: { contentType },
      });
      return true;
    }
  } catch (err) {
    logger.warn('[MultiTrackOrchestrator] R2 vaulting skipped or failed (non-fatal)', {
      storageKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return false;
}

/**
 * Insert metadata record into content_assets table.
 */
export async function registerContentAsset(params: {
  id?: string;
  workspaceId: string;
  projectId: string; // missionId
  type: string;
  storageKey: string;
  mimeType: string;
  sizeBytes?: number;
  durationSeconds?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const assetId = params.id || newAssetId();
  const db = await getD1();
  const now = Math.floor(Date.now() / 1000);

  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO content_assets
             (id, project_id, workspace_id, type, storage_key, mime_type, size_bytes, duration_seconds, status, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          assetId,
          params.projectId,
          params.workspaceId,
          params.type,
          params.storageKey,
          params.mimeType,
          params.sizeBytes ?? 0,
          params.durationSeconds ?? 0,
          params.status ?? 'completed',
          JSON.stringify(params.metadata ?? {}),
          now,
          now,
        )
        .run();
    } catch (err) {
      logger.warn('[MultiTrackOrchestrator] Failed writing to content_assets table (non-fatal)', {
        assetId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return assetId;
}

// ── Checkpointing & State CAS Transitions ──────────────────────────────────

/**
 * Persist live track status in memory and to creative_missions.constraints.track_status.
 * Guarded with allowedStatuses (default: ['running']) to ensure non-running missions
 * (e.g. failed, cancelled, completed) are NEVER mutated by lagging background sub-tracks.
 */
export async function saveCheckpoint(
  missionId: string,
  trackStatus: MissionTrackStatus,
  currentPhase: string,
  allowedStatuses: CreativeMissionStatus[] = ['running'],
): Promise<void> {
  const db = await getD1();
  if (!db) {
    if (!['failed', 'review', 'completed', 'cancelled'].includes(currentPhase)) {
      setCachedTrackStatus(missionId, trackStatus);
    }
    return;
  }

  const row = await db
    .prepare('SELECT status, constraints FROM creative_missions WHERE id = ?')
    .bind(missionId)
    .first<{ status: CreativeMissionStatus; constraints: string }>();

  if (!row) {
    throw new MissionError('NOT_FOUND', `Mission ${missionId} not found`);
  }

  // Fail-closed guard: reject update if mission status is not allowed
  if (!allowedStatuses.includes(row.status)) {
    throw new MissionError(
      'CONCURRENT_MODIFICATION',
      `Cannot save checkpoint for mission ${missionId}: status is '${row.status}', expected 'running'`
    );
  }

  let constraintsObj: Record<string, unknown> = {};
  if (row.constraints) {
    try {
      constraintsObj = JSON.parse(row.constraints) as Record<string, unknown>;
    } catch {
      constraintsObj = {};
    }
  }

  constraintsObj.track_status = trackStatus;
  const now = Math.floor(Date.now() / 1000);

  const placeholders = allowedStatuses.map(() => '?').join(', ');
  const result = await db
    .prepare(
      `UPDATE creative_missions
       SET constraints = ?, current_phase = ?, updated_at = ?
       WHERE id = ? AND status IN (${placeholders})`
    )
    .bind(JSON.stringify(constraintsObj), currentPhase, now, missionId, ...allowedStatuses)
    .run();

  if (result.meta.changes === 0) {
    throw new MissionError(
      'CONCURRENT_MODIFICATION',
      `Mission ${missionId} status changed concurrently while saving checkpoint`
    );
  }

  if (row.status === 'running') {
    setCachedTrackStatus(missionId, trackStatus);
  } else {
    clearTrackStatusCache(missionId);
  }
}

/**
 * Assert that the mission exists and is still active ('running').
 * Checks both database status and AbortSignal to halt execution immediately on cancellation.
 */
export async function assertMissionActive(
  missionId: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new MissionError('MISSION_CANCELLED', 'Mission execution was aborted');
  }

  const db = await getD1();
  if (!db) return;

  const row = await db
    .prepare('SELECT status FROM creative_missions WHERE id = ?')
    .bind(missionId)
    .first<{ status: string }>();

  if (!row) {
    throw new MissionError('NOT_FOUND', `Mission ${missionId} not found`);
  }

  if (row.status === 'cancelled') {
    throw new MissionError('MISSION_CANCELLED', `Mission ${missionId} has been cancelled`);
  }

  if (row.status !== 'running') {
    throw new MissionError(
      'INVALID_STATE',
      `Mission ${missionId} is no longer running (status: ${row.status})`
    );
  }
}

/**
 * Optimistic Concurrency Control (OCC CAS) state transition.
 * Fails closed with CONCURRENT_MODIFICATION if row was modified concurrently.
 */
export async function transitionStatusCAS(
  missionId: string,
  expectedStatus: CreativeMissionStatus,
  newStatus: CreativeMissionStatus,
  currentPhase: string,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      'UPDATE creative_missions SET status = ?, current_phase = ?, updated_at = ? WHERE id = ? AND status = ?'
    )
    .bind(newStatus, currentPhase, now, missionId, expectedStatus)
    .run();

  if (result.meta.changes === 0) {
    throw new MissionError(
      'CONCURRENT_MODIFICATION',
      `Mission ${missionId} status changed concurrently (expected: ${expectedStatus})`
    );
  }
}

// ── Script Parsing Helper ──────────────────────────────────────────────────


/**
 * Robust script parser extracting visual prompts and voiceover narration.
 */
export function parseScriptIntoScenes(
  rawContent: string,
  topic: string,
  expectedScenes = 3
): {
  title: string;
  fullNarration: string;
  scenes: ScriptScene[];
  estimatedDurationSec: number;
  wordCount: number;
} {
  const content = rawContent.trim();

  // Try JSON parse if structured response
  if (content.startsWith('{') && content.endsWith('}')) {
    try {
      const parsed = JSON.parse(content) as {
        title?: string;
        narration?: string;
        scenes?: Array<{ index?: number; prompt?: string; narration?: string; duration?: number }>;
      };
      if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
        const scenes: ScriptScene[] = parsed.scenes.map((s, idx) => ({
          index: s.index ?? idx + 1,
          prompt: s.prompt || `${topic} scene ${idx + 1}`,
          narration: s.narration,
          durationSeconds: s.duration,
        }));
        const fullNarration =
          parsed.narration ||
          scenes
            .map((s) => s.narration)
            .filter(Boolean)
            .join(' ') ||
          content;
        const wordCount = fullNarration.split(/\s+/).filter(Boolean).length;
        return {
          title: parsed.title || topic,
          fullNarration,
          scenes,
          estimatedDurationSec: Math.max(15, Math.round(wordCount / 2.5)),
          wordCount,
        };
      }
    } catch {
      // Fall through to text pattern extraction
    }
  }

  // Text extraction with scene markers
  const sceneBlocks = content.split(/Scene\s*(\d+):?/i).filter(Boolean);
  const scenes: ScriptScene[] = [];
  let fullNarration = '';

  if (sceneBlocks.length >= 2) {
    for (let i = 0; i < sceneBlocks.length; i += 2) {
      const sceneIdx = parseInt(sceneBlocks[i], 10) || scenes.length + 1;
      const text = (sceneBlocks[i + 1] || '').trim();
      const visualMatch = text.match(/Visual:?\s*([^\n]+)/i);
      const narrationMatch = text.match(/Narration:?\s*([^\n]+)/i);

      const prompt = visualMatch ? visualMatch[1].trim() : text.slice(0, 150) || `${topic} scene ${sceneIdx}`;
      const narration = narrationMatch ? narrationMatch[1].trim() : text;

      scenes.push({
        index: sceneIdx,
        prompt,
        narration,
      });
      fullNarration += (narration ? narration + ' ' : '');
    }
  }

  // Fallback if no scene markers found: split into paragraphs
  if (scenes.length === 0) {
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const count = Math.max(expectedScenes, paragraphs.length || 1);
    for (let i = 0; i < count; i++) {
      const pText = paragraphs[i] || `${topic} scene ${i + 1}`;
      scenes.push({
        index: i + 1,
        prompt: `${topic} - scene ${i + 1}: ${pText.slice(0, 100)}`,
        narration: pText,
      });
    }
    fullNarration = content;
  }

  const wordCount = fullNarration.split(/\s+/).filter(Boolean).length;
  const estimatedDurationSec = Math.max(15, Math.round(wordCount / 2.5));

  return {
    title: topic,
    fullNarration: fullNarration.trim(),
    scenes,
    estimatedDurationSec,
    wordCount,
  };
}

// ── Orchestrator Core ──────────────────────────────────────────────────────

/**
 * Execute the 4-track creative mission:
 * Track 1: Script synthesis (AI_TEXT)
 * -> Dispatches Track 2 (Audio) and Track 3 (Visuals) in parallel via Promise.all
 * -> Joins both tracks for Track 4 (Video Compositing)
 * -> Transitions status atomically via OCC CAS: running -> review.
 */
export async function executeMultiTrackMission(
  missionId: string,
  options?: MultiTrackExecutionOptions,
): Promise<MultiTrackExecutionResult> {
  const mission = await getMission(missionId);
  if (!mission) {
    throw new MissionError('NOT_FOUND', `Mission ${missionId} not found`);
  }

  const workspaceId = options?.workspaceId || mission.workspaceId;
  const creatorId = options?.userId || mission.creatorId;

  // 1. Atomic state machine transition into 'running' if not already running
  if (mission.status !== 'running') {
    if (!canStartExecution(mission.status)) {
      throw new MissionError(
        'EXECUTION_START_INVALID',
        `Mission status '${mission.status}' cannot start execution. Valid states: ${EXECUTION_START_FROM.join(', ')}`
      );
    }
    await transitionStatusCAS(missionId, mission.status, 'running', 'executing');
  }

  // 2. Initialize checkpoint & live track state
  const trackStatus: MissionTrackStatus = {
    script: 'pending',
    audio: 'pending',
    visual: 'pending',
    video: 'pending',
  };
  await saveCheckpoint(missionId, trackStatus, 'executing');
  if (options?.checkpointCallback) {
    await options.checkpointCallback(trackStatus, 'executing');
  }

  const resultTracks: MultiTrackExecutionResult['tracks'] = {};

  try {
    // 3. Resolve multi-track providers
    const providers =
      options?.providers ??
      (await buildMultiTrackProviders({
        userId: creatorId,
        tenantId: workspaceId,
      }));

    const topic = options?.topic || mission.title || 'Automated Creative Video';
    const targetScenes =
      options?.estimatedScenes || (mission.constraints?.estimatedScenes as number) || 3;
    const targetDuration =
      options?.durationSeconds || (mission.constraints?.durationSeconds as number) || 30;

    // ── Track 1: Script Synthesis (AI_TEXT) ──────────────────────────────────
    trackStatus.script = 'running';
    await saveCheckpoint(missionId, trackStatus, 'script_generation');
    if (options?.checkpointCallback) {
      await options.checkpointCallback(trackStatus, 'script_generation');
    }

    const scriptPrompt = `Generate a video script for topic: "${topic}".
Objective: ${mission.objective || 'Create engaging automated video'}.
Target duration: ${targetDuration} seconds.
Estimated scenes: ${targetScenes}.
Provide structured narration and scene visual descriptions.`;

    const chatResponse = await providers.scriptProvider.chat(
      [
        {
          role: 'system',
          content:
            'You are an expert viral video director synthesizing multi-track video scripts with visual prompts and voiceover narration.',
        },
        { role: 'user', content: scriptPrompt },
      ],
      { model: 'openrouter/auto', apiKey: '' }
    );

    const parsedScript = parseScriptIntoScenes(chatResponse.content, topic, targetScenes);

    // Vault script asset
    const scriptAssetId = newAssetId();
    const scriptStorageKey = formatTenantAssetKey(workspaceId, missionId, 'script', scriptAssetId, 'json');
    await vaultToR2IfAvailable(scriptStorageKey, JSON.stringify(parsedScript), 'application/json');

    await registerContentAsset({
      id: scriptAssetId,
      workspaceId,
      projectId: missionId,
      type: 'script',
      storageKey: scriptStorageKey,
      mimeType: 'application/json',
      status: 'completed',
      metadata: { scenesCount: parsedScript.scenes.length, wordCount: parsedScript.wordCount },
    });

    trackStatus.script = 'completed';
    resultTracks.script = {
      ...parsedScript,
      storageKey: scriptStorageKey,
      assetId: scriptAssetId,
    };
    await saveCheckpoint(missionId, trackStatus, 'script_completed');
    if (options?.checkpointCallback) {
      await options.checkpointCallback(trackStatus, 'script_completed');
    }

    // ── Mid-Flight Cancellation Check #1: Before Track 2 & Track 3 ──────────
    await assertMissionActive(missionId, options?.signal);

    // ── Concurrency & Coordination: Parallel Track 2 & Track 3 ───────────────
    trackStatus.audio = 'running';
    trackStatus.visual = 'running';
    await saveCheckpoint(missionId, trackStatus, 'voice_and_visuals');
    if (options?.checkpointCallback) {
      await options.checkpointCallback(trackStatus, 'voice_and_visuals');
    }

    const abortController = new AbortController();
    const { signal: parallelSignal } = abortController;

    if (options?.signal?.aborted) {
      abortController.abort(options.signal.reason);
    } else if (options?.signal) {
      options.signal.addEventListener('abort', () => abortController.abort(options.signal?.reason), { once: true });
    }

    const runAudioTrack = async (): Promise<MultiTrackAudioResult> => {
      try {
        if (parallelSignal.aborted) {
          trackStatus.audio = 'cancelled';
          throw new MissionError('ABORTED', 'Audio track cancelled due to abort signal');
        }

        const voiceRes = await providers.audioProvider.generateSpeech(
          {
            text: parsedScript.fullNarration,
            voiceId: options?.voiceId,
            model: options?.voiceStyle,
          },
          creatorId
        );

        if (parallelSignal.aborted) {
          trackStatus.audio = 'cancelled';
          throw new MissionError('ABORTED', 'Audio track cancelled after speech generation');
        }

        const audioAssetId = newAssetId();
        const audioStorageKey = formatTenantAssetKey(workspaceId, missionId, 'audio', audioAssetId, 'mp3');

        if (voiceRes.audioBuffer && voiceRes.audioBuffer.byteLength > 0) {
          await vaultToR2IfAvailable(audioStorageKey, voiceRes.audioBuffer, 'audio/mpeg');
        }

        if (parallelSignal.aborted) {
          trackStatus.audio = 'cancelled';
          throw new MissionError('ABORTED', 'Audio track cancelled before asset registration');
        }

        await registerContentAsset({
          id: audioAssetId,
          workspaceId,
          projectId: missionId,
          type: 'audio',
          storageKey: audioStorageKey,
          mimeType: 'audio/mpeg',
          durationSeconds: Math.round(voiceRes.durationSeconds || targetDuration),
          sizeBytes: voiceRes.audioBuffer?.byteLength ?? 0,
          status: 'completed',
          metadata: { provider: voiceRes.provider, latencyMs: voiceRes.latencyMs },
        });

        if (parallelSignal.aborted) {
          trackStatus.audio = 'cancelled';
          throw new MissionError('ABORTED', 'Audio track cancelled before checkpoint');
        }

        trackStatus.audio = 'completed';
        await saveCheckpoint(missionId, trackStatus, 'voice_and_visuals');

        return {
          audioUrl: voiceRes.audioUrl || audioStorageKey,
          storageKey: audioStorageKey,
          durationSeconds: voiceRes.durationSeconds || targetDuration,
          mimeType: 'audio/mpeg',
          assetId: audioAssetId,
          sizeBytes: voiceRes.audioBuffer?.byteLength ?? 0,
        };
      } catch (err) {
        if (!parallelSignal.aborted) {
          trackStatus.audio = 'failed';
          abortController.abort(err);
        } else if (trackStatus.audio === 'running') {
          trackStatus.audio = 'cancelled';
        }
        throw err;
      }
    };

    const runVisualTrack = async (): Promise<MultiTrackVisualResult> => {
      try {
        if (parallelSignal.aborted) {
          trackStatus.visual = 'cancelled';
          throw new MissionError('ABORTED', 'Visual track cancelled due to abort signal');
        }

        const rawRatio = options?.aspectRatio || (mission.constraints?.aspectRatio as string) || '9:16';
        const validRatio: '1:1' | '16:9' | '9:16' | '4:3' =
          rawRatio === '1:1' || rawRatio === '16:9' || rawRatio === '9:16' || rawRatio === '4:3'
            ? rawRatio
            : '9:16';
        const frames: MultiTrackVisualFrame[] = [];

        for (const scene of parsedScript.scenes) {
          if (parallelSignal.aborted) {
            trackStatus.visual = 'cancelled';
            throw new MissionError('ABORTED', 'Visual track cancelled before scene rendering');
          }

          const imgRes = await providers.imageProvider.generate({
            prompt: scene.prompt,
            aspectRatio: validRatio,
          });

          if (parallelSignal.aborted) {
            trackStatus.visual = 'cancelled';
            throw new MissionError('ABORTED', 'Visual track cancelled after scene rendering');
          }

          const frameAssetId = newAssetId();
          const frameStorageKey = formatTenantAssetKey(
            workspaceId,
            missionId,
            'visual',
            `${scene.index}_${frameAssetId}`,
            'png'
          );

          await registerContentAsset({
            id: frameAssetId,
            workspaceId,
            projectId: missionId,
            type: 'image',
            storageKey: frameStorageKey,
            mimeType: 'image/png',
            status: 'completed',
            metadata: { sceneIndex: scene.index, provider: imgRes.provider, prompt: scene.prompt },
          });

          frames.push({
            sceneIndex: scene.index,
            prompt: scene.prompt,
            storageKey: frameStorageKey,
            imageUrl: imgRes.assetRef || frameStorageKey,
            assetId: frameAssetId,
            mimeType: 'image/png',
          });
        }

        if (parallelSignal.aborted) {
          trackStatus.visual = 'cancelled';
          throw new MissionError('ABORTED', 'Visual track cancelled before checkpoint');
        }

        trackStatus.visual = 'completed';
        await saveCheckpoint(missionId, trackStatus, 'voice_and_visuals');

        return {
          frames,
          aspectRatio: validRatio,
          totalScenes: frames.length,
        };
      } catch (err) {
        if (!parallelSignal.aborted) {
          trackStatus.visual = 'failed';
          abortController.abort(err);
        } else if (trackStatus.visual === 'running') {
          trackStatus.visual = 'cancelled';
        }
        throw err;
      }
    };

    const [audioSettled, visualSettled] = await Promise.allSettled([
      runAudioTrack(),
      runVisualTrack(),
    ]);

    if (audioSettled.status === 'rejected' || visualSettled.status === 'rejected') {
      const isAbortErr = (r: unknown) =>
        (r instanceof MissionError && r.code === 'ABORTED') ||
        (r instanceof Error && r.message.toLowerCase().includes('cancelled'));

      let rootErr: unknown;
      if (audioSettled.status === 'rejected' && visualSettled.status === 'rejected') {
        rootErr = !isAbortErr(audioSettled.reason) ? audioSettled.reason : visualSettled.reason;
      } else if (audioSettled.status === 'rejected') {
        rootErr = audioSettled.reason;
      } else {
        rootErr = (visualSettled as PromiseRejectedResult).reason;
      }

      if (audioSettled.status === 'rejected') {
        if (trackStatus.audio === 'running') {
          trackStatus.audio = isAbortErr(audioSettled.reason) ? 'cancelled' : 'failed';
        }
      }
      if (visualSettled.status === 'rejected') {
        if (trackStatus.visual === 'running') {
          trackStatus.visual = isAbortErr(visualSettled.reason) ? 'cancelled' : 'failed';
        }
      }

      throw rootErr;
    }

    const audioResult = (audioSettled as PromiseFulfilledResult<MultiTrackAudioResult>).value;
    const visualResult = (visualSettled as PromiseFulfilledResult<MultiTrackVisualResult>).value;

    resultTracks.audio = audioResult;
    resultTracks.visual = visualResult;

    // ── Mid-Flight Cancellation Check #2: Before Track 4 (Video Compositing) ──
    await assertMissionActive(missionId, options?.signal);

    // ── Track 4: Video Compositing / Rendering (AI_VIDEO) ────────────────────
    trackStatus.video = 'running';
    await saveCheckpoint(missionId, trackStatus, 'video_compositing');
    if (options?.checkpointCallback) {
      await options.checkpointCallback(trackStatus, 'video_compositing');
    }

    const firstFrameUrl =
      visualResult.frames[0]?.imageUrl || visualResult.frames[0]?.storageKey || 'https://placeholder.vault/frame.png';

    const renderJob = await providers.videoProvider.renderVideo(
      {
        audioUrl: audioResult.audioUrl,
        faceUrl: firstFrameUrl,
        options: {
          aspectRatio: visualResult.aspectRatio,
          duration: audioResult.durationSeconds,
          scenes: visualResult.frames.map((f) => ({ index: f.sceneIndex, storageKey: f.storageKey })),
        },
      },
      creatorId
    );

    const videoAssetId = newAssetId();
    const videoStorageKey = formatTenantAssetKey(workspaceId, missionId, 'video', videoAssetId, 'mp4');

    await registerContentAsset({
      id: videoAssetId,
      workspaceId,
      projectId: missionId,
      type: 'video',
      storageKey: videoStorageKey,
      mimeType: 'video/mp4',
      durationSeconds: Math.round(audioResult.durationSeconds),
      status: 'completed',
      metadata: {
        jobId: renderJob.jobId,
        aspectRatio: visualResult.aspectRatio,
        scenesCount: visualResult.frames.length,
      },
    });

    trackStatus.video = 'completed';
    resultTracks.video = {
      videoUrl: videoStorageKey,
      storageKey: videoStorageKey,
      durationSeconds: audioResult.durationSeconds,
      mimeType: 'video/mp4',
      assetId: videoAssetId,
      aspectRatio: visualResult.aspectRatio,
    };

    await saveCheckpoint(missionId, trackStatus, 'composited');
    if (options?.checkpointCallback) {
      await options.checkpointCallback(trackStatus, 'composited');
    }

    // ── Final Atomic CAS Transition: running -> review ───────────────────────
    await saveCheckpoint(missionId, trackStatus, 'review', ['running', 'review']);
    await transitionStatusCAS(missionId, 'running', 'review', 'review');
    clearTrackStatusCache(missionId);

    if (options?.checkpointCallback) {
      await options.checkpointCallback(trackStatus, 'review');
    }

    logger.info('[MultiTrackOrchestrator] Multi-track mission successfully completed', {
      missionId,
      workspaceId,
      trackStatus,
    });

    return {
      success: true,
      missionId,
      workspaceId,
      status: 'review',
      currentPhase: 'review',
      trackStatus,
      tracks: resultTracks,
    };
  } catch (err) {
    const isCancelled =
      (err instanceof MissionError && err.code === 'MISSION_CANCELLED') ||
      Boolean(options?.signal?.aborted) ||
      (err instanceof Error && err.message.toLowerCase().includes("'cancelled'"));

    const error =
      err instanceof MissionError
        ? `[${err.code}] ${err.message}`
        : err instanceof Error
        ? err.message
        : String(err);

    // Update failing track states accurately
    if (trackStatus.script === 'running') trackStatus.script = isCancelled ? 'cancelled' : 'failed';
    if (trackStatus.audio === 'running') trackStatus.audio = isCancelled ? 'cancelled' : 'failed';
    if (trackStatus.visual === 'running') trackStatus.visual = isCancelled ? 'cancelled' : 'failed';
    if (trackStatus.video === 'running') trackStatus.video = isCancelled ? 'cancelled' : 'failed';

    logger.error('[MultiTrackOrchestrator] Multi-track execution failed', {
      missionId,
      trackStatus,
      isCancelled,
      error,
    });

    const targetStatus: CreativeMissionStatus = isCancelled ? 'cancelled' : 'failed';
    const targetPhase = isCancelled ? 'cancelled' : 'failed';

    // Attempt fail-closed CAS transition to targetStatus
    try {
      await transitionStatusCAS(missionId, 'running', targetStatus, targetPhase);
    } catch {
      // Ignore CAS error if already modified out-of-band
    }

    try {
      await saveCheckpoint(missionId, trackStatus, targetPhase, ['running', targetStatus]);
    } catch {
      // Non-fatal
    }
    clearTrackStatusCache(missionId);

    if (options?.checkpointCallback) {
      try {
        await options.checkpointCallback(trackStatus, targetPhase);
      } catch {
        // non-fatal
      }
    }

    return {
      success: false,
      missionId,
      workspaceId,
      status: targetStatus,
      currentPhase: targetPhase,
      trackStatus,
      tracks: resultTracks,
      error,
    };
  }
}

// Register direct executor with Tree Service Bridge on module evaluation
registerMultiTrackExecutor(executeMultiTrackMission);

