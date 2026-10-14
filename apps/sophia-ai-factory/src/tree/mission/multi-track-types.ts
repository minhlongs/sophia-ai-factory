/**
 * Multi-Track Execution Contracts for Missions.
 * Layer: tree (domain-specific reusable)
 */

import type { CreativeMissionStatus } from '@/seed/types/creative-economy';

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
  provider?: string;
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
