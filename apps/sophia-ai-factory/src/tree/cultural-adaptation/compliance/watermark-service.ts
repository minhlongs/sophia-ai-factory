/**
 * Watermark and Disclosure Generator
 *
 * Layer: tree/cultural-adaptation/compliance
 */
import type { ComplianceJurisdiction } from '@/seed/types/cultural-adaptation';
import type { GeneratedAiDisclosure } from './types';
import { JURISDICTION_RULES } from './jurisdiction-rules';
export function generateAiDisclosure(
  jurisdiction: ComplianceJurisdiction,
  format: 'visual' | 'audio' | 'both' = 'both',
): GeneratedAiDisclosure {
  const ruleDef = JURISDICTION_RULES[jurisdiction] || JURISDICTION_RULES.GLOBAL;
  const visualLabel = {
    textEn: ruleDef.mandatoryLabelEn,
    textLocal: ruleDef.mandatoryLabelLocal,
    position: ruleDef.defaultPosition,
    opacity: 0.85,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    textColor: '#FFFFFF',
  };
  let audioDisclaimer: GeneratedAiDisclosure['audioDisclaimer'];
  if (format === 'audio' || format === 'both') {
    const wordCount = ruleDef.audioDisclaimerLocal.split(/\s+/).length;
    const estDuration = Math.max(1.5, Math.round((wordCount / 2.8) * 10) / 10);
    audioDisclaimer = {
      textEn: ruleDef.audioDisclaimerEn,
      textLocal: ruleDef.audioDisclaimerLocal,
      estimatedDurationSec: estDuration,
    };
  }
  return {
    visualLabel,
    audioDisclaimer,
  };
}
