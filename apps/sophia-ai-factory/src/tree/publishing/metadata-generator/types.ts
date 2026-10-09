/**
 * @file types.ts
 * @description Types and options for viral metadata generation.
 * @layer tree
 */

import type { ApacLanguage, PlatformType, ViralHookArchetype } from '@/seed/types/apac-syndication';

export type HookTemplateMap = Record<ViralHookArchetype, (topic: string) => string>;

export interface FormatSeoDescriptionOptions {
  platform: PlatformType;
  language: ApacLanguage;
  rawTitle: string;
  keyTakeaways?: string[];
  trackedFunnelUrl: string;
  telegramDeepLink: string;
  hashtags: string[];
  referralCode?: string;
  maxDescriptionLength?: number;
}
