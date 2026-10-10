import type { HookStyle, VoiceProfile } from '@/seed/types/playbook-pattern';

/** Minimum statistical confidence required to adopt a detected pattern */
export const MIN_PATTERN_CONFIDENCE = 0.70;

/** Standard multi-track mission generation estimated cost in cents ($1.50) */
export const DEFAULT_ESTIMATED_COST_CENTS = 150;

/** Canonical allowed hook styles for validation */
export const VALID_HOOK_STYLES: readonly HookStyle[] = [
  'curiosity_gap',
  'bold_claim',
  'problem_agitation',
  'question',
  'story_lead',
  'statistic_reveal',
] as const;

/** Canonical allowed voice profiles for validation */
export const VALID_VOICE_PROFILES: readonly VoiceProfile[] = [
  'dynamic_hook',
  'enthusiastic_recommender',
  'calm_authoritative',
  'cinematic_narrator',
] as const;

export type TargetPlatform = 'youtube_shorts' | 'tiktok' | 'instagram_reels';
export type AspectRatio = '9:16' | '16:9' | '1:1';
