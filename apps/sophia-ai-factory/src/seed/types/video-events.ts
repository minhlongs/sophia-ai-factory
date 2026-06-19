/**
 * Video pipeline event types — canonical source for cross-layer access
 *
 * These types represent the event payloads for video-related Inngest events.
 * They are kept in seed/types so that both forest and land can import
 * them without cross-layer dependency violations.
 */

import type { Tier } from './index';

export type VideoGenerateRequestedEvent = {
  missionId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  /** Optional voiceover text; if absent, falls back to prompt */
  voiceoverText?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSec?: number;
  language?: 'en' | 'vi';
};
