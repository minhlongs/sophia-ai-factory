/**
 * @file viral-expansion-types.ts
 * @description Zod schemas and TypeScript types for Viral Audio, Kinetic Subtitles, and Multilingual Dubbing
 * @layer seed
 */

import { z } from 'zod';

export const AUDIO_COPYRIGHT_TIERS = [
  'ROYALTY_FREE_SAFE',
  'PLATFORM_TRENDING_LICENSED',
  'AI_GENERATED_BEATS',
] as const;
export type AudioCopyrightTier = (typeof AUDIO_COPYRIGHT_TIERS)[number];

export const SUBTITLE_ANIMATION_PRESETS = [
  'HORMOZI_HIGHLIGHT',
  'BEAST_POP',
  'MINIMAL_CYBER',
  'NEON_PULSE',
] as const;
export type SubtitleAnimationPreset = (typeof SUBTITLE_ANIMATION_PRESETS)[number];

export const SUPPORTED_DUB_LOCALES = ['en', 'vi', 'es', 'id', 'ja'] as const;
export type SupportedDubLocale = (typeof SUPPORTED_DUB_LOCALES)[number];

export const WordTimestampSchema = z.object({
  word: z.string().min(1),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  confidence: z.number().min(0).max(1).default(1.0),
  emphasis: z.boolean().default(false),
});
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;

export const ViralSoundTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  artist: z.string().min(1).max(100),
  bpm: z.number().int().min(60).max(220),
  audioUrl: z.string().url(),
  viralityIndex: z.number().min(0).max(100),
  copyrightTier: z.enum(AUDIO_COPYRIGHT_TIERS),
  recommendedDuckingDb: z.number().min(-30).max(-6).default(-14),
  platformTags: z.array(z.string()).default([]),
});
export type ViralSoundTrack = z.infer<typeof ViralSoundTrackSchema>;

export const KineticSubtitleConfigSchema = z.object({
  preset: z.enum(SUBTITLE_ANIMATION_PRESETS),
  primaryColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#fbbf24'),
  highlightColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ef4444'),
  fontSizePx: z.number().int().min(18).max(96).default(36),
  maxWordsPerScreen: z.number().int().min(1).max(6).default(3),
  enableEmojiAutoInject: z.boolean().default(true),
  textShadowGlow: z.boolean().default(true),
});
export type KineticSubtitleConfig = z.infer<typeof KineticSubtitleConfigSchema>;

export const LocalizedLineageRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  parentVideoJobId: z.string().min(1),
  locale: z.enum(SUPPORTED_DUB_LOCALES),
  translatedTitle: z.string().min(1).max(200),
  translatedScript: z.string().min(1),
  audioDurationSeconds: z.number().min(1).max(600),
  pacingMultiplier: z.number().min(0.8).max(1.3),
  localizedCtaText: z.string().min(1).max(200),
  targetAffiliateNetwork: z.string().min(1).max(50),
  lipSyncStatus: z.enum(['QUEUED', 'TRANSLATING', 'SYNTHESIZING_VOICE', 'LIP_SYNCING', 'COMPLETED', 'FAILED']),
  dubbedVideoUrl: z.string().url().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LocalizedLineageRecord = z.infer<typeof LocalizedLineageRecordSchema>;

export const TriggerDubbingInputSchema = z.object({
  parentVideoJobId: z.string().min(1),
  targetLocales: z.array(z.enum(SUPPORTED_DUB_LOCALES)).min(1),
  preserveDuration: z.boolean().default(true),
});
export type TriggerDubbingInput = z.infer<typeof TriggerDubbingInputSchema>;

export const TriggerAudioPairingInputSchema = z.object({
  videoJobId: z.string().min(1),
  soundTrackId: z.string().min(1),
  duckingDb: z.number().min(-30).max(-6).default(-14),
  subtitlePreset: z.enum(SUBTITLE_ANIMATION_PRESETS).default('HORMOZI_HIGHLIGHT'),
});
export type TriggerAudioPairingInput = z.infer<typeof TriggerAudioPairingInputSchema>;
