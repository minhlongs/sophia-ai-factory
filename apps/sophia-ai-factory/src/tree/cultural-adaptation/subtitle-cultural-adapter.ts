/**
 * Script-Aware Subtitle Cultural Adapter & Typography Engine
 *
 * Layer: tree (pure domain logic, algorithms, zero side effects)
 * Supports Milestone $800k MRR:
 * - Reading speed CPS (characters-per-second) budgeting by script family:
 *   - Latin alphabets (EN, ES, FR, DE, VI): 15-17 CPS
 *   - CJK ideograms (JA, ZH, KO): 4-6 CPS
 *   - Thai script: 10-14 CPS
 *   - Arabic script: 12-15 CPS
 * - Bunsetsu Japanese semantic line-breaking (avoids mid-compound splits)
 * - Cultural decimal & thousands punctuation formatting
 * - Taboo visual color pairs & cultural symbol validator
 *
 * @module tree/cultural-adaptation/subtitle-cultural-adapter
 */

import type {
  SubtitleCulturalBudget,
  WordWrapMode,
  NumberFormattingStyle,
} from '@/seed/types/cultural-adaptation';

// ─── Cultural Script Profiles ─────────────────────────────────────────────────

const LOCALE_BUDGET_REGISTRY: Record<string, SubtitleCulturalBudget> = {
  // Latin family
  en: {
    locale: 'en',
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 38,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  },
  vi: {
    locale: 'vi',
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 40,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  es: {
    locale: 'es',
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 40,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  fr: {
    locale: 'fr',
    minCps: 10,
    targetCps: 15,
    maxCps: 17,
    maxCpl: 40,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  de: {
    locale: 'de',
    minCps: 10,
    targetCps: 15,
    maxCps: 17,
    maxCpl: 38,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  id: {
    locale: 'id',
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 40,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },

  // CJK family
  ja: {
    locale: 'ja',
    minCps: 3,
    targetCps: 5,
    maxCps: 6,
    maxCpl: 16,
    maxLines: 2,
    wordWrapMode: 'bunsetsu',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [
      ['#FFFFFF', '#000000'], // White on black mourning contrast in specific contexts
    ],
    tabooSymbols: ['4', '9'], // Shi (death) and Ku (agony) associations in sensitive contexts
  },
  zh: {
    locale: 'zh',
    minCps: 3,
    targetCps: 5,
    maxCps: 6,
    maxCpl: 16,
    maxLines: 2,
    wordWrapMode: 'character',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [
      ['#FFFFFF', '#000000'],
    ],
    tabooSymbols: ['4', 'green_hat'],
  },
  ko: {
    locale: 'ko',
    minCps: 3,
    targetCps: 5,
    maxCps: 6,
    maxCpl: 18,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [
      ['#FF0000', '#FFFFFF'], // Writing names in red ink is culturally taboo
    ],
    tabooSymbols: ['4'],
  },

  // Southeast Asian & Middle Eastern families
  th: {
    locale: 'th',
    minCps: 8,
    targetCps: 12,
    maxCps: 14,
    maxCpl: 30,
    maxLines: 2,
    wordWrapMode: 'character',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  },
  ar: {
    locale: 'ar',
    minCps: 9,
    targetCps: 14,
    maxCps: 15,
    maxCpl: 34,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  },
  hi: {
    locale: 'hi',
    minCps: 9,
    targetCps: 14,
    maxCps: 16,
    maxCpl: 34,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  },
};

// ─── Budget Lookup ────────────────────────────────────────────────────────────

export function getSubtitleCulturalBudget(locale: string): SubtitleCulturalBudget {
  const normalized = locale.toLowerCase().slice(0, 2);
  const budget = LOCALE_BUDGET_REGISTRY[normalized];
  if (budget) return budget;

  // Fallback to international Latin standard
  return {
    locale,
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 38,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  };
}

// ─── Japanese Bunsetsu Segmenter ──────────────────────────────────────────────

/**
 * Common Japanese particle and grammatical break boundaries.
 */
const BUNSETSU_PARTICLES = [
  'は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'から', 'まで', 'より', 'など',
  'けど', 'ので', 'のに', 'たら', 'なら', 'ば', 'て', 'ても', 'ないで',
];

const JAPANESE_PUNCTUATION = ['、', '。', '！', '？', '!', '?', '…', '・'];

/**
 * Break Japanese text into natural grammatical chunks (Bunsetsu).
 * Avoids breaking words mid-compound while keeping line length under maxCpl.
 */
export function breakJapaneseBunsetsu(text: string, maxCpl = 16): string[] {
  if (!text) return [];
  if (text.length <= maxCpl) return [text];

  const chunks: string[] = [];
  let currentChunk = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1] || '';
    const twoChar = char + nextChar;
    currentChunk += char;

    // Check if current position is a natural break boundary
    const isPunctuation = JAPANESE_PUNCTUATION.includes(char);
    const isTwoCharParticle = BUNSETSU_PARTICLES.includes(twoChar);
    const isOneCharParticle = BUNSETSU_PARTICLES.includes(char) && !isTwoCharParticle;

    if (isPunctuation || isOneCharParticle || (isTwoCharParticle && currentChunk.length >= 4)) {
      if (currentChunk.length >= 6 || isPunctuation) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Assemble chunks into lines constrained by maxCpl
  const lines: string[] = [];
  let currentLine = '';

  for (const chunk of chunks) {
    if (currentLine.length + chunk.length <= maxCpl) {
      currentLine += chunk;
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = chunk;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Ensure no line exceeds maxCpl by forcing hard wrap if a single chunk was too large
  const finalLines: string[] = [];
  for (const line of lines) {
    if (line.length <= maxCpl) {
      finalLines.push(line);
    } else {
      for (let j = 0; j < line.length; j += maxCpl) {
        finalLines.push(line.slice(j, j + maxCpl));
      }
    }
  }

  return finalLines;
}

// ─── Standard Space-Aware Line Wrapping ───────────────────────────────────────

/**
 * Greedy space-aware line wrapping for Latin and segmented scripts.
 */
export function wrapWords(text: string, maxCpl: number): string[] {
  if (!text) return [];
  if (text.length <= maxCpl) return [text];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxCpl) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// ─── Subtitle Cue Adaptation ──────────────────────────────────────────────────

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

// ─── Cultural Decimal & Thousands Number Formatting ───────────────────────────

/**
 * Format numbers according to regional punctuation standards.
 * - Dot decimal (e.g., US/UK/JP/TH): 1,234.56
 * - Comma decimal (e.g., VN/DE/FR/ES): 1.234,56
 */
export function formatCulturalNumber(
  value: number,
  locale: string,
  fractionDigits = 2,
): string {
  const budget = getSubtitleCulturalBudget(locale);
  const parts = value.toFixed(fractionDigits).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  if (budget.numberFormatting === 'comma_decimal') {
    // Vietnam / EU standard: dot for thousands, comma for decimals
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
  }

  // Dot decimal standard: comma for thousands, dot for decimals
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

// ─── Visual Cultural Taboo & Contrast Validator ───────────────────────────────

export interface VisualValidationResult {
  compliant: boolean;
  warnings: string[];
  contrastRatio: number;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Validate color contrast (WCAG AA requirement >= 4.5:1) and cultural taboo pairing.
 */
export function validateCulturalVisuals(
  colors: { background: string; foreground: string },
  symbols: string[],
  locale: string,
): VisualValidationResult {
  const budget = getSubtitleCulturalBudget(locale);
  const warnings: string[] = [];

  // Calculate WCAG contrast ratio
  let contrastRatio = 21.0;
  try {
    const bg = parseHexColor(colors.background);
    const fg = parseHexColor(colors.foreground);
    const l1 = getRelativeLuminance(fg.r, fg.g, fg.b);
    const l2 = getRelativeLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    contrastRatio = Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;

    if (contrastRatio < 4.5) {
      warnings.push(`Low subtitle color contrast ratio (${contrastRatio}:1). WCAG AA requires at least 4.5:1.`);
    }
  } catch {
    // Non-hex color passed, skip calculation
  }

  // Check taboo color pairs
  for (const [tabooBg, tabooFg] of budget.tabooColorPairs) {
    if (
      colors.background.toUpperCase() === tabooBg.toUpperCase() &&
      colors.foreground.toUpperCase() === tabooFg.toUpperCase()
    ) {
      warnings.push(
        `Color combination (${colors.background}, ${colors.foreground}) is considered culturally inauspicious or taboo in ${budget.locale.toUpperCase()} locale.`,
      );
    }
  }

  // Check taboo symbols
  if (budget.tabooSymbols) {
    for (const sym of symbols) {
      if (budget.tabooSymbols.includes(sym)) {
        warnings.push(`Symbol '${sym}' holds negative or taboo cultural connotations in ${budget.locale.toUpperCase()} locale.`);
      }
    }
  }

  return {
    compliant: warnings.length === 0,
    warnings,
    contrastRatio,
  };
}
