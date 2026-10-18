/**
 * Compliance and Dialect Normalization for Edge TTS
 * Layer: forest/edge-tts
 */

import {
  normalizeDialect,
} from '@/tree/cultural-adaptation/dialect-normalizer';
import {
  generateAiDisclosure,
} from '@/tree/cultural-adaptation/compliance-engine';
import type { EdgeTtsSynthesisOptions } from './types';

export const AUTO_DISCLAIMER_JURISDICTIONS = new Set(['EU', 'VN', 'JP']);

export interface ComplianceNormalizationResult {
  processedText: string;
  normalizedScript?: string;
  disclaimerInjected: boolean;
  disclaimerText?: string;
}

export function normalizeAndInjectCompliance(
  text: string,
  options?: EdgeTtsSynthesisOptions,
): ComplianceNormalizationResult {
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
