/**
 * SSML Builder & Tempo Calculator
 * Layer: forest/edge-tts
 */

import type { ApacLocale } from '@/seed/types/dubbing';

/**
 * Build SSML payload for Microsoft Speech Synthesizer.
 */
export function buildSsml(
  text: string,
  voice: string,
  rate = '+0%',
  pitch = '+0Hz',
  volume = '+0%',
): string {
  // Escape XML characters
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voice}'>
    <prosody rate='${rate}' pitch='${pitch}' volume='${volume}'>
      ${escapedText}
    </prosody>
  </voice>
</speak>`;
}

/**
 * Calculate rate adjustment string (+X% or -X%) to fit spoken text into target video scene duration.
 */
export function calculateTempoAdjustment(
  targetDurationSec: number,
  wordCount: number,
  locale: ApacLocale,
): string {
  if (!targetDurationSec || targetDurationSec <= 0 || wordCount <= 0) {
    return '+0%';
  }

  // Estimated natural speaking rates (words per second) by language
  const ratePerSecond: Record<ApacLocale, number> = {
    vi: 2.8,
    en: 2.5,
    ja: 3.5, // mora/characters per second approx
    ko: 2.7,
    th: 2.6,
  };

  const naturalDuration = wordCount / (ratePerSecond[locale] || 2.5);
  const ratio = naturalDuration / targetDurationSec;

  // Clamp adjustment between -30% (slow down) and +50% (speed up)
  const percentChange = Math.round((ratio - 1) * 100);
  const clamped = Math.max(-30, Math.min(50, percentChange));

  return clamped >= 0 ? `+${clamped}%` : `${clamped}%`;
}
