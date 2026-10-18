/**
 * Edge TTS Synthesis Preparation Helpers
 * Layer: forest/edge-tts
 */

import type { ApacLocale } from '@/seed/types/dubbing';
import {
  normalizeDialect,
  tuneProsodyForDialect,
} from '@/tree/cultural-adaptation/dialect-normalizer';
import {
  generateAiDisclosure,
} from '@/tree/cultural-adaptation/compliance-engine';
import {
  type EdgeTtsSynthesisOptions,
  resolveEdgeVoice,
  resolveEdgeVoiceForDialect,
} from './types';
import { buildSsml, calculateTempoAdjustment } from './ssml-builder';

export interface PreparedEdgeTtsPayload {
  processedText: string;
  normalizedScript?: string;
  disclaimerInjected: boolean;
  disclaimerText?: string;
  wordCount: number;
  voice: string;
  rate: string;
  ssml: string;
  estimatedDuration: number;
}

const AUTO_DISCLAIMER_JURISDICTIONS = new Set(['EU', 'VN', 'JP']);

function normalizeAndInjectCompliance(
  text: string,
  options?: EdgeTtsSynthesisOptions,
): {
  processedText: string;
  normalizedScript?: string;
  disclaimerInjected: boolean;
  disclaimerText?: string;
} {
  let processedText = text;
  let normalizedScript: string | undefined;

  if (options?.dialect && options.sourceDialect) {
    const dialectResult = normalizeDialect(processedText, options.sourceDialect, options.dialect);
    processedText = dialectResult.normalizedText;
    normalizedScript = processedText;
  }

  const jurisdiction = options?.complianceJurisdiction;
  if (!jurisdiction) {
    return { processedText, normalizedScript, disclaimerInjected: false };
  }

  const disclosure = generateAiDisclosure(jurisdiction, 'audio');
  const shouldInject =
    Boolean(disclosure.audioDisclaimer) &&
    (Boolean(options?.injectAudioDisclaimer) || AUTO_DISCLAIMER_JURISDICTIONS.has(jurisdiction));

  if (!shouldInject || !disclosure.audioDisclaimer) {
    return { processedText, normalizedScript, disclaimerInjected: false };
  }

  const disclaimerText = disclosure.audioDisclaimer.textLocal;
  return {
    processedText: `${processedText}. ${disclaimerText}`,
    normalizedScript,
    disclaimerInjected: true,
    disclaimerText,
  };
}

function resolveVoiceAndProsody(
  locale: ApacLocale,
  wordCount: number,
  options?: EdgeTtsSynthesisOptions,
): { voice: string; rate: string; pitch: string; volume: string } {
  const gender = options?.gender || 'female';
  const voice = options?.voice
    ? options.voice
    : options?.dialect
      ? resolveEdgeVoiceForDialect(options.dialect, gender)
      : resolveEdgeVoice(locale, gender);

  let rate = options?.rate;
  let pitch = options?.pitch;

  if (options?.dialect && (!rate || !pitch)) {
    const prosody = tuneProsodyForDialect(options.dialect, { rate, pitch });
    rate = rate || prosody.rate;
    pitch = pitch || prosody.pitch;
  }

  if (!rate) {
    rate =
      options?.targetDurationSec && options.targetDurationSec > 0
        ? calculateTempoAdjustment(options.targetDurationSec, wordCount, locale)
        : '+0%';
  }

  return {
    voice,
    rate,
    pitch: pitch || '+0Hz',
    volume: options?.volume || '+0%',
  };
}

export function prepareEdgeTtsSynthesis(
  text: string,
  locale: ApacLocale,
  options?: EdgeTtsSynthesisOptions,
): PreparedEdgeTtsPayload {
  const { processedText, normalizedScript, disclaimerInjected, disclaimerText } =
    normalizeAndInjectCompliance(text, options);

  const wordCount = processedText.trim().split(/\s+/).filter(Boolean).length;
  const { voice, rate, pitch, volume } = resolveVoiceAndProsody(locale, wordCount, options);
  const ssml = buildSsml(processedText, voice, rate, pitch, volume);

  const rateModifier = 1 + (parseFloat(rate.replace('%', '')) || 0) / 100;
  const baseRate = locale === 'ja' ? 3.5 : locale === 'vi' ? 2.8 : 2.5;
  const estimatedDuration = Math.max(0.5, wordCount / (baseRate * rateModifier));

  return {
    processedText,
    normalizedScript,
    disclaimerInjected,
    disclaimerText,
    wordCount,
    voice,
    rate,
    ssml,
    estimatedDuration,
  };
}
