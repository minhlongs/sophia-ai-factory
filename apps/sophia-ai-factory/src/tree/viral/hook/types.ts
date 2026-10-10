/**
 * @file types.ts
 * @layer tree/viral/hook
 * @description Types for Viral Hook Generator and Short-Form Video Script Builder.
 */

import type {
  ViralNiche,
  HookArchetype,
  ViralHook,
} from '@/seed/types/growth';

export interface GenerateHooksOptions {
  niche: ViralNiche;
  archetype?: HookArchetype;
  customTopic?: string;
  count?: number;
  locale?: 'en' | 'vi';
}

export interface FindTrendingHooksOptions {
  niche?: ViralNiche;
  minVelocity?: number;
  limit?: number;
}

export interface GenerateScriptOptions {
  niche: ViralNiche;
  hook?: ViralHook;
  hookArchetype?: HookArchetype;
  targetDurationSec?: 15 | 30 | 60;
  customTopic?: string;
  referralCode?: string;
  telegramStartParam?: string;
  locale?: 'en' | 'vi';
}
