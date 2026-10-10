/**
 * Prosody Tuning and SSML Synthesis Markup
 *
 * Layer: tree/cultural-adaptation/normalizer
 */

import type {
  RegionalDialect,
  DialectProsody,
} from '@/seed/types/cultural-adaptation';
import {
  resolveDialectVoice,
} from '@/seed/voices/localized-profiles';
import { normalizeDialect } from './dialect-normalizer';

/**
 * Compute calibrated prosody parameters (pitch, rate, cadence) for a target dialect.
 */
export function tuneProsodyForDialect(
  dialect: RegionalDialect,
  baseProsody?: { pitch?: string; rate?: string },
): {
  pitch: string;
  rate: string;
  cadence: DialectProsody['cadenceStyle'];
  rateMultiplier: number;
} {
  const profile = resolveDialectVoice(dialect);
  const dialectProsody = profile.prosody;

  let finalPitch = dialectProsody.pitchOffset;
  if (baseProsody?.pitch && baseProsody.pitch !== '+0Hz') {
    const baseVal = parseInt(baseProsody.pitch.replace(/[^0-9-]/g, ''), 10) || 0;
    const offsetVal = parseInt(dialectProsody.pitchOffset.replace(/[^0-9-]/g, ''), 10) || 0;
    const combined = baseVal + offsetVal;
    finalPitch = combined >= 0 ? `+${combined}Hz` : `${combined}Hz`;
  }

  let finalRate = dialectProsody.rateMultiplier >= 1.0
    ? `+${Math.round((dialectProsody.rateMultiplier - 1) * 100)}%`
    : `${Math.round((dialectProsody.rateMultiplier - 1) * 100)}%`;

  if (baseProsody?.rate && baseProsody.rate !== '+0%') {
    const basePct = parseInt(baseProsody.rate.replace(/[^0-9-]/g, ''), 10) || 0;
    const dialectPct = Math.round((dialectProsody.rateMultiplier - 1) * 100);
    const combined = basePct + dialectPct;
    finalRate = combined >= 0 ? `+${combined}%` : `${combined}%`;
  }

  return {
    pitch: finalPitch,
    rate: finalRate,
    cadence: dialectProsody.cadenceStyle,
    rateMultiplier: dialectProsody.rateMultiplier,
  };
}

/**
 * Generate dialect-aware SSML payload ready for speech synthesis.
 */
export function generateSsmlWithDialect(
  text: string,
  dialect: RegionalDialect,
  options?: {
    sourceDialect?: RegionalDialect;
    voiceOverride?: string;
    rateOverride?: string;
    pitchOverride?: string;
  },
): {
  ssml: string;
  normalizedText: string;
  voiceName: string;
  appliedProsody: { pitch: string; rate: string };
} {
  const sourceDialect = options?.sourceDialect || dialect;
  const normalized = normalizeDialect(text, sourceDialect, dialect);
  const voiceProfile = resolveDialectVoice(dialect);
  const voiceName = options?.voiceOverride || voiceProfile.edgeVoiceName;

  const prosody = tuneProsodyForDialect(dialect, {
    rate: options?.rateOverride,
    pitch: options?.pitchOverride,
  });

  // XML escaping
  const escapedText = normalized.normalizedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${voiceProfile.locale}'>
  <voice name='${voiceName}'>
    <prosody rate='${prosody.rate}' pitch='${prosody.pitch}'>
      ${escapedText}
    </prosody>
  </voice>
</speak>`;

  return {
    ssml,
    normalizedText: normalized.normalizedText,
    voiceName,
    appliedProsody: { pitch: prosody.pitch, rate: prosody.rate },
  };
}
