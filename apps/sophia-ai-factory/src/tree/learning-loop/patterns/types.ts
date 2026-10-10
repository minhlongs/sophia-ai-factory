/**
 * Creative Pattern Extractor Types and Constants
 *
 * Layer: tree (domain reusable)
 * @module tree/learning-loop/patterns/types
 */

import type {
  HookStyle,
  VoiceProfile,
  DurationPattern,
  ExtractedCreativeVariables,
  LearningLoopAssetInput,
  ScriptSceneData,
} from '../types';

export type {
  HookStyle,
  VoiceProfile,
  DurationPattern,
  ExtractedCreativeVariables,
  LearningLoopAssetInput,
  ScriptSceneData,
};

export const VALID_HOOK_STYLES: ReadonlySet<HookStyle> = new Set([
  'curiosity_gap',
  'bold_claim',
  'problem_agitation',
  'question',
  'story_lead',
  'statistic_reveal',
]);

export const VALID_VOICE_PROFILES: ReadonlySet<VoiceProfile> = new Set([
  'dynamic_hook',
  'enthusiastic_recommender',
  'calm_authoritative',
  'cinematic_narrator',
]);
