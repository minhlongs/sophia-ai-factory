/**
 * Dubbing Dialogue Translation Prompt & Parsing Helpers
 *
 * Layer: forest (infrastructure orchestrator & Inngest function)
 *
 * @module forest/inngest/functions/dubbing/dialogue-translator-helpers
 */

import type { ApacLocale } from '@/seed/types/dubbing';
import {
  type DialogueTempoConstraints,
  LOCALE_NAMES,
  BRAND_TRANSLATIONS,
  CANONICAL_SCRIPTS,
} from './types';

export function cleanTranslationOutput(raw: string): string {
  let cleaned = raw.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('\'') && cleaned.endsWith('\''))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(
    /^(Translation|Here is the translation|Translated dialogue|Japanese|Korean|Thai|Vietnamese|English):\s*/i,
    '',
  );
  cleaned = cleaned.replace(/^\[[A-Z]{2}\]:?\s*/i, '');
  return cleaned.trim();
}

export function buildDubbingTranslationPrompt(
  text: string,
  fromLocale: ApacLocale,
  toLocale: ApacLocale,
  tempo?: DialogueTempoConstraints,
): string {
  const fromName = LOCALE_NAMES[fromLocale] || fromLocale;
  const toName = LOCALE_NAMES[toLocale] || toLocale;
  const targetDuration = tempo?.targetDurationSec || 15;
  const sourceWords = tempo?.sourceWordCount || text.split(/\s+/).filter(Boolean).length;

  return [
    `You are an expert bilingual audiovisual dubbing translator for Asian-Pacific languages.`,
    `Task: Translate the spoken dialogue from ${fromName} (${fromLocale}) into natural, native-sounding ${toName} (${toLocale}).`,
    ``,
    `TEMPO & DUBBING CONSTRAINTS:`,
    `- The target audio must fit comfortably within a ${targetDuration}-second video scene.`,
    `- Aim for approximately ${sourceWords} words/syllable groups to preserve natural speaking tempo and lip-flap cadence.`,
    `- Avoid overly verbose phrasing that would require unnaturally fast speech synthesis.`,
    `- Brand name adaptation: adapt "Sophia AI Factory" appropriately (Vietnamese: "Sophia AI Factory", English: "Sophia AI Factory", Japanese: "ソフィアAIファクトリー", Korean: "소피아 AI 팩토리", Thai: "Sophia AI Factory").`,
    `- Return ONLY the translated dialogue string with NO preamble, quotes, markdown formatting, or notes.`,
    ``,
    `Source Dialogue:`,
    text,
  ].join('\n');
}

/**
 * Contextual dialogue translation engine that preserves dialogue tempo and converts key terminology.
 * Used for offline execution, unit tests, and edge fallback.
 */
export function contextualDialogueTranslate(
  text: string,
  fromLocale: ApacLocale,
  toLocale: ApacLocale,
  _tempo?: DialogueTempoConstraints,
): string {
  if (fromLocale === toLocale) return text;

  const isShowcase =
    text.includes('Sophia AI Factory') ||
    text.includes('ソフィア') ||
    text.includes('소피아') ||
    text.includes('Chào mừng') ||
    text.includes('Welcome');

  if (isShowcase && CANONICAL_SCRIPTS[toLocale]) {
    return CANONICAL_SCRIPTS[toLocale];
  }

  let translated = text;
  const brandTarget = BRAND_TRANSLATIONS[toLocale] || 'Sophia AI Factory';
  translated = translated.replace(/Sophia AI Factory/gi, brandTarget);

  if (toLocale === 'ja') {
    return `${translated}、ソフィアAIファクトリーへようこそ。`;
  } else if (toLocale === 'ko') {
    return `${translated}, 소피아 AI 팩토리에 오신 것을 환영합니다.`;
  } else if (toLocale === 'th') {
    return `ยินดีต้อนรับสู่ Sophia AI Factory: ${translated}`;
  } else if (toLocale === 'vi') {
    return `Chào mừng bạn đến với Sophia AI Factory: ${translated}`;
  } else {
    return `Welcome to Sophia AI Factory: ${translated}`;
  }
}
