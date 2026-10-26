/**
 * @module seed/ai/video-model-radar-types
 * Foundational types for 2026-2027 AI Video Model Radar & Unified Aggregator Routing.
 */

export type VideoSceneTaskType =
  | 'HOOK_CINEMATIC_3S'
  | 'BROLL_TECH_LOOP'
  | 'AVATAR_TALKING_HEAD'
  | 'FFMPEG_COMPOSE';

export type VideoAggregatorProvider = 'fal-ai' | 'replicate' | 'heygen' | 'elevenlabs';

export interface RadarModelEntry {
  modelId: string;
  aggregator: VideoAggregatorProvider;
  sceneTask: VideoSceneTaskType;
  displayName: string;
  motionFidelity: number; // 0..1
  promptAdherence: number; // 0..1
  avgLatencySec: number;
  costPerSecUsd: number;
  compositeScore?: number;
  isActive: boolean;
  updatedAt: number;
}

export interface RankedRadarModel extends RadarModelEntry {
  compositeScore: number;
  rank: number;
}

export interface VideoGenerationJobRequest {
  userId: string;
  campaignId: string;
  sceneTask: VideoSceneTaskType;
  prompt: string;
  durationSec: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
}

export interface VideoGenerationJobResponse {
  jobId: string;
  aggregator: VideoAggregatorProvider;
  modelId: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED';
  videoUrl?: string;
  estimatedCostUsd: number;
}

export const DEFAULT_2027_RADAR_CATALOG: RadarModelEntry[] = [
  {
    modelId: 'fal-ai/kling-video/v2.1/master/text-to-video',
    aggregator: 'fal-ai',
    sceneTask: 'HOOK_CINEMATIC_3S',
    displayName: 'Kling 2.1 Master (Fal)',
    motionFidelity: 0.96,
    promptAdherence: 0.95,
    avgLatencySec: 22.0,
    costPerSecUsd: 0.045,
    isActive: true,
    updatedAt: 1761480000000,
  },
  {
    modelId: 'fal-ai/veo3/fast',
    aggregator: 'fal-ai',
    sceneTask: 'HOOK_CINEMATIC_3S',
    displayName: 'Google Veo 3 Fast (Fal)',
    motionFidelity: 0.95,
    promptAdherence: 0.96,
    avgLatencySec: 18.0,
    costPerSecUsd: 0.05,
    isActive: true,
    updatedAt: 1761480000000,
  },
  {
    modelId: 'wan-video/wan-2.2-t2v-14b',
    aggregator: 'replicate',
    sceneTask: 'HOOK_CINEMATIC_3S',
    displayName: 'Wan 2.2 14B (Replicate)',
    motionFidelity: 0.91,
    promptAdherence: 0.9,
    avgLatencySec: 28.0,
    costPerSecUsd: 0.025,
    isActive: true,
    updatedAt: 1761480000000,
  },
  {
    modelId: 'fal-ai/wan-v2.2-a14b/text-to-video',
    aggregator: 'fal-ai',
    sceneTask: 'BROLL_TECH_LOOP',
    displayName: 'Wan 2.2 A14B Loop (Fal)',
    motionFidelity: 0.92,
    promptAdherence: 0.91,
    avgLatencySec: 16.0,
    costPerSecUsd: 0.02,
    isActive: true,
    updatedAt: 1761480000000,
  },
  {
    modelId: 'heygen/avatar-v3-lipsync',
    aggregator: 'heygen',
    sceneTask: 'AVATAR_TALKING_HEAD',
    displayName: 'HeyGen Avatar V3 LipSync',
    motionFidelity: 0.97,
    promptAdherence: 0.98,
    avgLatencySec: 24.0,
    costPerSecUsd: 0.06,
    isActive: true,
    updatedAt: 1761480000000,
  },
  {
    modelId: 'fal-ai/ffmpeg-api/compose',
    aggregator: 'fal-ai',
    sceneTask: 'FFMPEG_COMPOSE',
    displayName: 'Fal Serverless FFmpeg Compose',
    motionFidelity: 1.0,
    promptAdherence: 1.0,
    avgLatencySec: 6.0,
    costPerSecUsd: 0.01,
    isActive: true,
    updatedAt: 1761480000000,
  },
];
