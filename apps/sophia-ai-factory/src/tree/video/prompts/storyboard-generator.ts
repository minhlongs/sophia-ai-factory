/**
 * Storyboard Generator
 *
 * Deterministically aligns script narration with blueprint scenes and computes millisecond timings.
 * Layer: tree (domain reusable storyboard calculation)
 * @module tree/video/prompts/storyboard-generator
 */

import type { VideoBlueprint, StoryboardSceneSpec } from '@/seed/config/video-blueprints/blueprint-types';

export interface CalculatedStoryboardScene {
  sceneIndex: number;
  name: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  narrationText: string;
  visualPrompt: string;
  cameraMotion: string;
  sfxCue: string;
  overlayText: string;
  pacingDesc: string;
}

export interface StoryboardPlan {
  blueprintId: string;
  totalDurationMs: number;
  aspectRatio: string;
  scenes: CalculatedStoryboardScene[];
}

export function generateStoryboardFromBlueprint(
  blueprint: VideoBlueprint,
  narrationScenes: string[] = [],
): StoryboardPlan {
  const calculatedScenes: CalculatedStoryboardScene[] = blueprint.scenes.map((sceneSpec: StoryboardSceneSpec) => {
    const startMs = Math.round(sceneSpec.startSec * 1000);
    const endMs = Math.round(sceneSpec.endSec * 1000);
    const durationMs = endMs - startMs;
    const narrationText = narrationScenes[sceneSpec.sceneIndex] || '';

    return {
      sceneIndex: sceneSpec.sceneIndex,
      name: sceneSpec.name,
      startMs,
      endMs,
      durationMs,
      narrationText,
      visualPrompt: sceneSpec.visualPrompt,
      cameraMotion: sceneSpec.cameraMotion || 'Static Centered',
      sfxCue: sceneSpec.sfxCue || 'None',
      overlayText: sceneSpec.overlayText || '',
      pacingDesc: sceneSpec.pacingDesc,
    };
  });

  const totalDurationMs = blueprint.defaultDurationSec * 1000;

  return {
    blueprintId: blueprint.id,
    totalDurationMs,
    aspectRatio: blueprint.aspectRatio,
    scenes: calculatedScenes,
  };
}
