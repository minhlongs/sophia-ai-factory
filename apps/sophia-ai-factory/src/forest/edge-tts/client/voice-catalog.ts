/**
 * Edge TTS APAC Voice Catalog and Voice Resolution Helpers
 * Layer: forest/edge-tts
 */

import type { ApacLocale } from '@/seed/types/dubbing';
import type { RegionalDialect } from '@/seed/types/cultural-adaptation';
import { resolveDialectVoice } from '@/seed/voices/localized-profiles';
import type { EdgeTtsVoice } from './types';

/**
 * Standard Microsoft Edge neural voices for APAC and international dialect locales.
 */
export const EDGE_APAC_VOICES: readonly EdgeTtsVoice[] = [
  // Vietnamese
  {
    name: 'vi-VN-HoaiMyNeural',
    shortName: 'HoaiMy',
    locale: 'vi',
    gender: 'female',
    description: 'Natural southern Vietnamese female voice, clear and warm',
    dialect: 'vi-VN-nam',
  },
  {
    name: 'vi-VN-NamMinhNeural',
    shortName: 'NamMinh',
    locale: 'vi',
    gender: 'male',
    description: 'Northern Vietnamese male voice, deep and professional',
    dialect: 'vi-VN-bac',
  },
  // Japanese
  {
    name: 'ja-JP-NanamiNeural',
    shortName: 'Nanami',
    locale: 'ja',
    gender: 'female',
    description: 'Polite and expressive Tokyo female voice',
    dialect: 'ja-JP-tokyo',
  },
  {
    name: 'ja-JP-KeitaNeural',
    shortName: 'Keita',
    locale: 'ja',
    gender: 'male',
    description: 'Authoritative and dynamic Tokyo male voice',
    dialect: 'ja-JP-tokyo',
  },
  // Korean
  {
    name: 'ko-KR-SunHiNeural',
    shortName: 'SunHi',
    locale: 'ko',
    gender: 'female',
    description: 'Melodic and gentle Seoul female voice',
  },
  {
    name: 'ko-KR-InJoonNeural',
    shortName: 'InJoon',
    locale: 'ko',
    gender: 'male',
    description: 'Confident and clear Seoul tech male voice',
  },
  // Thai
  {
    name: 'th-TH-PremwadeeNeural',
    shortName: 'Premwadee',
    locale: 'th',
    gender: 'female',
    description: 'Smooth and engaging Bangkok female narrator',
  },
  {
    name: 'th-TH-NiwatNeural',
    shortName: 'Niwat',
    locale: 'th',
    gender: 'male',
    description: 'Crisp and energetic Bangkok male voice',
  },
  // English (US)
  {
    name: 'en-US-JennyNeural',
    shortName: 'Jenny',
    locale: 'en',
    gender: 'female',
    description: 'Versatile and articulate English female narrator',
    dialect: 'en-US',
  },
  {
    name: 'en-US-GuyNeural',
    shortName: 'Guy',
    locale: 'en',
    gender: 'male',
    description: 'Approachable and authoritative English male voice',
    dialect: 'en-US',
  },
  // English (UK)
  {
    name: 'en-GB-SoniaNeural',
    shortName: 'Sonia',
    locale: 'en',
    gender: 'female',
    description: 'Refined and articulate British English female voice',
    dialect: 'en-GB',
  },
  {
    name: 'en-GB-RyanNeural',
    shortName: 'Ryan',
    locale: 'en',
    gender: 'male',
    description: 'Warm and polished British English male voice',
    dialect: 'en-GB',
  },
] as const;

/**
 * Resolve standard neural voice identifier by locale and gender.
 */
export function resolveEdgeVoice(locale: ApacLocale, gender: 'male' | 'female' = 'female'): string {
  const match = EDGE_APAC_VOICES.find((v) => v.locale === locale && v.gender === gender);
  if (match) return match.name;
  const fallback = EDGE_APAC_VOICES.find((v) => v.locale === locale);
  return fallback ? fallback.name : 'vi-VN-HoaiMyNeural';
}

/**
 * Resolve Microsoft Edge neural voice name for a specific regional dialect.
 */
export function resolveEdgeVoiceForDialect(
  dialect: RegionalDialect,
  gender: 'male' | 'female' = 'female',
): string {
  const profile = resolveDialectVoice(dialect, gender);
  return profile.edgeVoiceName;
}
