/**
 * Types for viral multi-platform distributor
 * Layer: Forest
 *
 * @module forest/publishing/distributor/types
 */

import type {
  ViralPlatform,
  ViralNiche,
  HookArchetype,
} from '@/seed/types/growth';

export interface TrackingUrlOptions {
  baseUrl?: string;
  platform: ViralPlatform;
  niche: ViralNiche;
  hookArchetype: HookArchetype;
  videoId: string;
  referralCode?: string;
}

export interface TelegramDeepLinkOptions {
  botUsername?: string;
  videoId: string;
  platform: ViralPlatform;
  niche: ViralNiche;
  referralCode?: string;
  customStart?: string;
}
