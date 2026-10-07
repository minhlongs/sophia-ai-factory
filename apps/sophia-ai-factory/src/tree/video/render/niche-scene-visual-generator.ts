/**
 * Niche Scene Visual Generator
 *
 * Prepares image/video visual asset descriptors formatted for 9:16 vertical
 * generation pipelines (Fal.ai Flux Schnell, Replicate, or stock video b-rolls).
 * Layer: tree (domain reusable logic)
 * @module tree/video/render/niche-scene-visual-generator
 */

import type { SynthesizedSceneScript } from './niche-script-synthesizer';

export interface SceneVisualAsset {
  sceneId: string;
  order: number;
  aspectRatio: '9:16';
  prompt: string;
  durationSec: number;
  assetType: 'image' | 'video_clip';
  transition: 'cut' | 'fade' | 'zoom_in';
  captionOverlay?: string;
}

export interface GenerateSceneVisualsResult {
  planId: string;
  totalScenes: number;
  assets: SceneVisualAsset[];
}

export function generateSceneVisualAssets(
  planId: string,
  scenes: SynthesizedSceneScript[],
): GenerateSceneVisualsResult {
  const assets: SceneVisualAsset[] = scenes.map((scene) => {
    let transition: 'cut' | 'fade' | 'zoom_in' = 'cut';
    if (scene.role === 'hook') transition = 'zoom_in';
    else if (scene.role === 'cta') transition = 'fade';

    const enrichedPrompt = `${scene.visualPrompt}, vertical orientation 9:16, 1080x1920, sharp focus, professional color grading, award winning cinematography`;

    return {
      sceneId: scene.sceneId,
      order: scene.order,
      aspectRatio: '9:16',
      prompt: enrichedPrompt,
      durationSec: scene.durationSec,
      assetType: 'image',
      transition,
      captionOverlay: scene.onScreenText,
    };
  });

  return {
    planId,
    totalScenes: assets.length,
    assets,
  };
}
