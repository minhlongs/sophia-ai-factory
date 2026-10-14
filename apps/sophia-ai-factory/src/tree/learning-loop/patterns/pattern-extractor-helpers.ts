/**
 * Creative Pattern Extractor Helpers (Scene, Duration & Aspect Ratio Resolution)
 *
 * Layer: tree (domain reusable)
 * @module tree/learning-loop/patterns/pattern-extractor-helpers
 */

import {
  type VoiceProfile,
  type LearningLoopAssetInput,
  type ScriptSceneData,
  VALID_VOICE_PROFILES,
} from './types';

export function resolveVoiceProfileStyle(rawStyle: string): VoiceProfile {
  if (rawStyle && VALID_VOICE_PROFILES.has(rawStyle as VoiceProfile)) {
    return rawStyle as VoiceProfile;
  }

  const normalized = rawStyle.toLowerCase();
  if (/dynamic|hook|punchy|fast|hype|energetic/.test(normalized)) {
    return 'dynamic_hook';
  }
  if (/enthusiastic|recommender|warm|friendly|affiliate|recommend/.test(normalized)) {
    return 'enthusiastic_recommender';
  }
  if (/narrator|cinematic|story|documentary|epic|deep/.test(normalized)) {
    return 'cinematic_narrator';
  }
  return 'calm_authoritative';
}

export function extractVoiceIdFromMetadata(metadata: Record<string, unknown>): string | undefined {
  const candidates = [metadata.voiceId, metadata.voice_id, metadata.providerVoiceId];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return undefined;
}

export function extractRawStyleFromMetadata(metadata: Record<string, unknown>): string {
  const candidates = [metadata.voiceStyle, metadata.voice_style, metadata.voiceProfile, metadata.voice_profile];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

export function resolveScene0(
  scriptAsset?: LearningLoopAssetInput,
  constraints?: Record<string, unknown>,
  title?: string,
): { scene0Input: unknown; sceneCount: number } {
  let scene0Input: unknown = null;
  let sceneCount = 1;

  if (scriptAsset?.metadata) {
    const meta = scriptAsset.metadata;
    if (Array.isArray(meta.scenes) && meta.scenes.length > 0) {
      scene0Input = meta.scenes[0] as ScriptSceneData;
      sceneCount = meta.scenes.length;
    } else if (meta.scene0) {
      scene0Input = meta.scene0;
    } else if (meta.narration || meta.prompt || meta.title) {
      scene0Input = meta;
    }
    if (typeof meta.scenesCount === 'number') {
      sceneCount = meta.scenesCount;
    }
  }

  if (!scene0Input && constraints) {
    scene0Input = constraints.hookStyle || constraints.title || title;
  }

  return { scene0Input, sceneCount };
}

export function resolveActualDuration(
  videoAsset?: LearningLoopAssetInput,
  audioAsset?: LearningLoopAssetInput,
  constraints?: Record<string, unknown>,
): number {
  if (typeof videoAsset?.durationSeconds === 'number' && videoAsset.durationSeconds > 0) {
    return videoAsset.durationSeconds;
  }
  if (typeof audioAsset?.durationSeconds === 'number' && audioAsset.durationSeconds > 0) {
    return audioAsset.durationSeconds;
  }
  if (typeof constraints?.durationSeconds === 'number') {
    return constraints.durationSeconds as number;
  }
  return 60;
}

export function resolveAspectRatio(
  videoAsset?: LearningLoopAssetInput,
  constraints?: Record<string, unknown>,
): '9:16' | '16:9' | '1:1' {
  const rawAspect =
    (videoAsset?.metadata?.aspectRatio as string) ||
    (constraints?.aspectRatio as string) ||
    '9:16';

  if (rawAspect === '16:9' || rawAspect === '1:1') {
    return rawAspect;
  }
  return '9:16';
}
