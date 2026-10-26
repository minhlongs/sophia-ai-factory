/**
 * @module tree/video/radar/model-radar-scorer
 * Scores and ranks 2026-2027 AI Video models per Scene Task.
 */

import {
  type RadarModelEntry,
  type RankedRadarModel,
  type VideoSceneTaskType,
  DEFAULT_2027_RADAR_CATALOG,
} from '@/seed/ai/video-model-radar-types';

export interface RadarWeightProfile {
  motionWeight: number;
  promptWeight: number;
  latencyWeight: number;
  costWeight: number;
}

const TASK_WEIGHTS: Record<VideoSceneTaskType, RadarWeightProfile> = {
  HOOK_CINEMATIC_3S: { motionWeight: 0.45, promptWeight: 0.35, latencyWeight: 0.1, costWeight: 0.1 },
  BROLL_TECH_LOOP: { motionWeight: 0.35, promptWeight: 0.25, latencyWeight: 0.2, costWeight: 0.2 },
  AVATAR_TALKING_HEAD: { motionWeight: 0.4, promptWeight: 0.4, latencyWeight: 0.1, costWeight: 0.1 },
  FFMPEG_COMPOSE: { motionWeight: 0.2, promptWeight: 0.2, latencyWeight: 0.4, costWeight: 0.2 },
};

export function computeModelScore(entry: RadarModelEntry): number {
  const weights = TASK_WEIGHTS[entry.sceneTask];
  const normLatency = Math.max(0, 1 - Math.min(entry.avgLatencySec, 60) / 60);
  const normCost = Math.max(0, 1 - Math.min(entry.costPerSecUsd, 0.1) / 0.1);

  const rawScore =
    entry.motionFidelity * weights.motionWeight +
    entry.promptAdherence * weights.promptWeight +
    normLatency * weights.latencyWeight +
    normCost * weights.costWeight;

  return Math.round(rawScore * 1000) / 1000;
}

export function rankModelsForTask(
  sceneTask: VideoSceneTaskType,
  candidates: RadarModelEntry[] = DEFAULT_2027_RADAR_CATALOG,
): RankedRadarModel[] {
  return candidates
    .filter((c) => c.sceneTask === sceneTask && c.isActive)
    .map((c) => ({ ...c, compositeScore: computeModelScore(c), rank: 0 }))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((c, idx) => ({ ...c, rank: idx + 1 }));
}
