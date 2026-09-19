/**
 * Mission Lifecycle
 * Layer: tree (domain-specific reusable)
 *
 * Sophia's top-level orchestration object.
 * Mission = "Build media business around sustainable living in SEA."
 *
 * Lifecycle: DRAFT → PLANNED → APPROVAL_REQUIRED → RUNNING → PAUSED
 *          → REVIEW → COMPLETED → LEARNING → ITERATING
 *
 * Single enforced authority for mission status transitions (see
 * docs/architecture-decisions/ADR-mission-state-machine.md). Persistence
 * CRUD lives in repository.ts; metrics aggregation lives in metrics.ts;
 * both are re-exported here so the public surface of this module is stable.
 *
 * @module tree/mission
 */

import { getD1 } from '@/seed/db/client';
// Mission lifecycle types route through the Creative Economy barrel so the
// canonical contract surface has a single import home. creative-domain.ts
// remains the type author; the barrel re-exports it unchanged.
import type { Mission, CreativeMissionStatus } from '@/seed/types/creative-economy';
import { getMission } from './repository';

export class MissionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'MissionError';
    this.code = code;
  }
}

export function newMissionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'msn_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Lifecycle transitions ─────────────────────────────────────────────────────

const NEXT_STATUS: Record<CreativeMissionStatus, CreativeMissionStatus[]> = {
  draft: ['planned', 'cancelled'],
  planned: ['approval_required', 'cancelled'],
  approval_required: ['running', 'cancelled'],
  running: ['paused', 'review', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'review', 'failed', 'cancelled'],
  review: ['completed', 'iterating', 'failed', 'cancelled'],
  completed: ['learning'],
  learning: ['iterating'],
  iterating: ['draft', 'planned', 'running', 'cancelled'],
  failed: ['draft', 'planned', 'running'],
  cancelled: ['draft'],
};

export function canTransition(from: CreativeMissionStatus, to: CreativeMissionStatus): boolean {
  return NEXT_STATUS[from]?.includes(to) ?? false;
}

// ── Execution start (named legal rule) ───────────────────────────────────────

/**
 * States from which an agent execution may legally start. Deliberately wider
 * than NEXT_STATUS edges into 'running': starting execution is a named rule,
 * not an unvalidated bypass. Terminal/review states may never start.
 */
export const EXECUTION_START_FROM: readonly CreativeMissionStatus[] = [
  'draft',
  'planned',
  'approval_required',
  'paused',
];

export function canStartExecution(from: CreativeMissionStatus): boolean {
  return EXECUTION_START_FROM.includes(from);
}

/**
 * Atomically flip a mission into execution ('running', phase 'executing').
 *
 * Guarded write binds the status observed at load time; if another writer
 * changed the row in between, meta.changes === 0 and the stale writer
 * rejects with CONCURRENT_MODIFICATION instead of interleaving.
 */
export async function beginMissionExecution(id: string): Promise<Mission> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  const mission = await getMission(id);
  if (!mission) throw new MissionError('NOT_FOUND', `Mission ${id} not found`);
  if (!canStartExecution(mission.status)) {
    throw new MissionError(
      'EXECUTION_START_INVALID',
      `${mission.status} → running not allowed; execution starts from ${EXECUTION_START_FROM.join('/')}`,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(`UPDATE creative_missions SET status = 'running', current_phase = 'executing', updated_at = ? WHERE id = ? AND status = ?`)
    .bind(now, id, mission.status)
    .run();
  if (result.meta.changes === 0) {
    throw new MissionError('CONCURRENT_MODIFICATION', `Mission ${id} status changed concurrently`);
  }
  const updated = await getMission(id);
  if (!updated) throw new MissionError('UPDATE_FAILED', 'Fetch after update failed');
  return updated;
}

// ── Public surface (moved modules, unchanged API) ─────────────────────────────

export {
  createMission,
  getMission,
  getMissionWithGoals,
  listMissions,
  updateMissionStatus,
  recordSpend,
  deleteMission,
} from './repository';

export { getMissionMetrics } from './metrics';
export type { MissionMetrics } from './metrics';

// ── Multi-Track Execution Contracts ───────────────────────────────────────────

export type SingleTrackState =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface MissionTrackStatus {
  script: SingleTrackState;
  audio: SingleTrackState;
  visual: SingleTrackState;
  video: SingleTrackState;
}

export interface ScriptScene {
  index: number;
  prompt: string;
  narration?: string;
  durationSeconds?: number;
}

export interface MultiTrackScriptResult {
  title: string;
  fullNarration: string;
  scenes: ScriptScene[];
  estimatedDurationSec: number;
  wordCount: number;
  storageKey?: string;
  assetId?: string;
}

export interface MultiTrackAudioResult {
  audioUrl: string;
  storageKey: string;
  durationSeconds: number;
  mimeType: string;
  assetId: string;
  sizeBytes?: number;
}

export interface MultiTrackVisualFrame {
  sceneIndex: number;
  prompt: string;
  storageKey: string;
  imageUrl: string;
  assetId: string;
  mimeType: string;
}

export interface MultiTrackVisualResult {
  frames: MultiTrackVisualFrame[];
  aspectRatio: string;
  totalScenes: number;
}

export interface MultiTrackVideoResult {
  videoUrl: string;
  storageKey: string;
  durationSeconds: number;
  mimeType: string;
  assetId: string;
  aspectRatio: string;
}

export interface MultiTrackExecutionResult {
  success: boolean;
  missionId: string;
  workspaceId: string;
  status: CreativeMissionStatus;
  currentPhase: string;
  trackStatus: MissionTrackStatus;
  tracks: {
    script?: MultiTrackScriptResult;
    audio?: MultiTrackAudioResult;
    visual?: MultiTrackVisualResult;
    video?: MultiTrackVideoResult;
  };
  error?: string;
}

