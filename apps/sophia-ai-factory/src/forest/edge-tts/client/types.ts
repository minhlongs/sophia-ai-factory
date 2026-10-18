/**
 * Edge TTS Types and Voice Catalog
 * Layer: forest/edge-tts
 */

import type { ApacLocale } from '@/seed/types/dubbing';
import type {
  RegionalDialect,
  ComplianceJurisdiction,
} from '@/seed/types/cultural-adaptation';

export interface EdgeTtsVoice {
  name: string;
  shortName: string;
  locale: ApacLocale | string;
  gender: 'male' | 'female';
  description: string;
  dialect?: RegionalDialect;
}

export interface EdgeTtsSynthesisOptions {
  voice?: string;
  rate?: string; // e.g. "+0%", "+15%", "-10%"
  pitch?: string; // e.g. "+0Hz", "+5Hz"
  volume?: string; // e.g. "+0%", "+20%"
  targetDurationSec?: number;
  gender?: 'male' | 'female';
  dialect?: RegionalDialect;
  sourceDialect?: RegionalDialect;
  complianceJurisdiction?: ComplianceJurisdiction;
  injectAudioDisclaimer?: boolean;
}

export interface EdgeTtsSynthesisResult {
  audioBuffer: Uint8Array;
  mimeType: string;
  durationSec: number;
  voice: string;
  rate: string;
  wordCount: number;
  disclaimerInjected?: boolean;
  disclaimerText?: string;
  normalizedScript?: string;
}

export {
  EDGE_APAC_VOICES,
  resolveEdgeVoice,
  resolveEdgeVoiceForDialect,
} from './voice-catalog';
