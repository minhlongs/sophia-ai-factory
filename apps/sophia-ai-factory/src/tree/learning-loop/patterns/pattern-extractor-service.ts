/**
 * Creative Pattern Extractor Service
 *
 * Layer: tree (domain reusable)
 * @module tree/learning-loop/patterns/pattern-extractor-service
 */

import {
  type VoiceProfile,
  type ExtractedCreativeVariables,
  type LearningLoopAssetInput,
  type ScriptSceneData,
  VALID_VOICE_PROFILES,
} from './types';
import {
  bucketDurationPattern,
  extractHookStyleFromScene0,
} from './signal-analyzer';

function resolveVoiceProfileStyle(rawStyle: string): VoiceProfile {
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

function extractVoiceIdFromMetadata(metadata: Record<string, unknown>): string | undefined {
  const candidates = [metadata.voiceId, metadata.voice_id, metadata.providerVoiceId];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return undefined;
}

function extractRawStyleFromMetadata(metadata: Record<string, unknown>): string {
  const candidates = [metadata.voiceStyle, metadata.voice_style, metadata.voiceProfile, metadata.voice_profile];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Extract voice profile from audio metadata or audio configuration.
 */
export function extractVoiceProfileFromMetadata(metadata?: Record<string, unknown>): {
  voiceProfile: VoiceProfile;
  voiceId?: string;
} {
  if (!metadata) {
    return { voiceProfile: 'calm_authoritative' };
  }

  const voiceId = extractVoiceIdFromMetadata(metadata);
  const rawStyle = extractRawStyleFromMetadata(metadata);

  return {
    voiceProfile: resolveVoiceProfileStyle(rawStyle),
    voiceId,
  };
}

function resolveScene0(
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

function resolveActualDuration(
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

function resolveAspectRatio(
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

/**
 * Composite extraction of creative variables from mission context and generated media assets.
 */
export function extractCreativeVariables(
  mission: {
    id: string;
    workspaceId: string;
    channels?: string[];
    constraints?: Record<string, unknown>;
    title?: string;
  },
  assets: Array<LearningLoopAssetInput | Record<string, unknown>>,
): ExtractedCreativeVariables {
  const scriptAsset = assets.find((a) => (a as LearningLoopAssetInput).type === 'script') as
    | LearningLoopAssetInput
    | undefined;
  const audioAsset = assets.find((a) => (a as LearningLoopAssetInput).type === 'audio') as
    | LearningLoopAssetInput
    | undefined;
  const videoAsset = assets.find((a) => (a as LearningLoopAssetInput).type === 'video') as
    | LearningLoopAssetInput
    | undefined;

  const { scene0Input, sceneCount } = resolveScene0(scriptAsset, mission.constraints, mission.title);
  const hookStyle = extractHookStyleFromScene0(scene0Input);

  const audioMeta = audioAsset?.metadata || (mission.constraints?.voice as Record<string, unknown> | undefined);
  const { voiceProfile, voiceId } = extractVoiceProfileFromMetadata(audioMeta);

  const actualDuration = resolveActualDuration(videoAsset, audioAsset, mission.constraints);
  const durationPattern = bucketDurationPattern(actualDuration);
  const aspectRatio = resolveAspectRatio(videoAsset, mission.constraints);

  return {
    missionId: mission.id,
    workspaceId: mission.workspaceId,
    hookStyle,
    voiceProfile,
    voiceId,
    durationPattern,
    actualDurationSeconds: actualDuration,
    aspectRatio,
    sceneCount: Math.max(1, sceneCount),
    channels: mission.channels ?? ['tiktok'],
    title: mission.title,
  };
}
