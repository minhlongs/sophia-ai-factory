/**
 * Subtitle Cue Adaptation
 *
 * @module tree/cultural-adaptation/subtitles/cue-adapter
 */

import { getSubtitleCulturalBudget } from './budget-registry';
import { breakJapaneseBunsetsu, wrapWords } from './line-wrapper';

export interface SubtitleAdaptationResult {
  adaptedText: string;
  lines: string[];
  effectiveCps: number;
  isWithinBudget: boolean;
  minCps: number;
  maxCps: number;
  targetCps: number;
  suggestedDurationSec: number;
  lineBreaksCount: number;
}

/**
 * Adapt a subtitle cue text for reading speed CPS and script-specific line wrapping.
 */
export function adaptSubtitleCue(
  text: string,
  durationSec: number,
  locale: string,
): SubtitleAdaptationResult {
  const budget = getSubtitleCulturalBudget(locale);
  const cleanText = text.trim();
  const charCount = cleanText.length;

  const effectiveDuration = Math.max(0.5, durationSec);
  const effectiveCps = Math.round((charCount / effectiveDuration) * 10) / 10;
  const isWithinBudget = effectiveCps >= budget.minCps && effectiveCps <= budget.maxCps;

  // Calculate suggested duration to fit target CPS
  const suggestedDurationSec =
    effectiveCps > budget.maxCps
      ? Math.ceil((charCount / budget.targetCps) * 10) / 10
      : durationSec;

  // Perform script-appropriate line wrapping
  let lines: string[];
  if (budget.wordWrapMode === 'bunsetsu') {
    lines = breakJapaneseBunsetsu(cleanText, budget.maxCpl);
  } else if (budget.wordWrapMode === 'character') {
    // For Chinese or Thai where spaces may not exist between words
    lines = [];
    for (let i = 0; i < cleanText.length; i += budget.maxCpl) {
      lines.push(cleanText.slice(i, i + budget.maxCpl));
    }
  } else {
    // Space-based wrapping
    lines = wrapWords(cleanText, budget.maxCpl);
  }

  // Cap to maxLines if exceeded (condense into maxLines by joining)
  if (lines.length > budget.maxLines) {
    const condensed: string[] = [];
    const chunkSize = Math.ceil(lines.length / budget.maxLines);
    for (let i = 0; i < lines.length; i += chunkSize) {
      condensed.push(lines.slice(i, i + chunkSize).join(' '));
    }
    lines = condensed.slice(0, budget.maxLines);
  }

  const adaptedText = lines.join('\n');
  const lineBreaksCount = Math.max(0, lines.length - 1);

  return {
    adaptedText,
    lines,
    effectiveCps,
    isWithinBudget,
    minCps: budget.minCps,
    maxCps: budget.maxCps,
    targetCps: budget.targetCps,
    suggestedDurationSec,
    lineBreaksCount,
  };
}
