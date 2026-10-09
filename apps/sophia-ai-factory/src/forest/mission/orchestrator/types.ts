/**
 * Types and contract re-exports for Multi-Track Orchestration.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/types
 */

import type {
  SingleTrackState,
  MissionTrackStatus,
  ScriptScene,
  MultiTrackScriptResult,
  MultiTrackAudioResult,
  MultiTrackVisualFrame,
  MultiTrackVisualResult,
  MultiTrackVideoResult,
  MultiTrackExecutionResult,
} from '@/tree/mission';
import type { MultiTrackProviders } from '@/forest/ai/provider-factory';

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
  getMissionTrackStatus,
  getCachedTrackStatus,
  setCachedTrackStatus,
  clearTrackStatusCache,
  registerMultiTrackExecutor,
  EXECUTION_START_FROM,
} from '@/tree/mission';

export interface MultiTrackExecutionOptions {
  userId?: string;
  workspaceId?: string;
  topic?: string;
  voiceStyle?: string;
  voiceId?: string;
  estimatedScenes?: number;
  durationSeconds?: number;
  aspectRatio?: string;
  videoProviderChoice?: 'kling' | 'hunyuan' | 'replicate' | 'default';
  imageProviderChoice?: 'fal-ai' | 'replicate';
  providers?: MultiTrackProviders;
  checkpointCallback?: (trackStatus: MissionTrackStatus, phase: string) => Promise<void> | void;
  signal?: AbortSignal;
}
