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
} from './types';
import {
  bucketDurationPattern,
  extractHookStyleFromScene0,
} from './signal-analyzer';
import {
  resolveVoiceProfileStyle,
  extractVoiceIdFromMetadata,
  extractRawStyleFromMetadata,
  resolveScene0,
  resolveActualDuration,
  resolveAspectRatio,
} from './pattern-extractor-helpers';

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
