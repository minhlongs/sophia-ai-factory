/**
 * Regional Dialect Normalizer & Prosody Tuning Engine
 *
 * Layer: tree (pure domain logic, algorithms, zero side effects)
 * Supports Milestone $800k MRR:
 * - Bidirectional US English <-> UK English lexical and spelling adaptation
 * - Tokyo Standard <-> Osaka / Kansai Japanese lexical adaptation
 * - Vietnam Northern (Bắc) <-> Central (Trung) <-> Southern (Nam) lexical adaptation
 * - Prosody tuning (rate, pitch, cadence) and SSML synthesis markup
 *
 * @module tree/cultural-adaptation/dialect-normalizer
 */

import type {
  RegionalDialect,
  DialectNormalizationRule,
  DialectProsody,
} from '@/seed/types/cultural-adaptation';
import {
  LOCALIZED_VOICE_PROFILES,
  resolveDialectVoice,
} from '@/seed/voices/localized-profiles';

// ─── English Dialect Lexical & Spelling Rules ─────────────────────────────────

const EN_US_TO_UK_RULES: readonly DialectNormalizationRule[] = [
  // Vocabulary
  { sourceWord: 'apartment', targetWord: 'flat' },
  { sourceWord: 'elevator', targetWord: 'lift' },
  { sourceWord: 'sidewalk', targetWord: 'pavement' },
  { sourceWord: 'vacation', targetWord: 'holiday' },
  { sourceWord: 'truck', targetWord: 'lorry' },
  { sourceWord: 'subway', targetWord: 'underground' },
  { sourceWord: 'french fries', targetWord: 'chips' },
  { sourceWord: 'fries', targetWord: 'chips' },
  { sourceWord: 'potato chips', targetWord: 'crisps' },
  { sourceWord: 'chips', targetWord: 'crisps', contextHint: 'snack' },
  { sourceWord: 'candy', targetWord: 'sweets' },
  { sourceWord: 'trunk', targetWord: 'boot', contextHint: 'car' },
  { sourceWord: 'hood', targetWord: 'bonnet', contextHint: 'car' },
  { sourceWord: 'flashlight', targetWord: 'torch' },
  { sourceWord: 'garbage', targetWord: 'rubbish' },
  { sourceWord: 'trash', targetWord: 'rubbish' },
  { sourceWord: 'cookie', targetWord: 'biscuit' },
  { sourceWord: 'cookies', targetWord: 'biscuits' },
  { sourceWord: 'soccer', targetWord: 'football' },
  { sourceWord: 'diaper', targetWord: 'nappy' },
  { sourceWord: 'windshield', targetWord: 'windscreen' },
  { sourceWord: 'sweater', targetWord: 'jumper' },
  { sourceWord: 'sneakers', targetWord: 'trainers' },
  { sourceWord: 'zip code', targetWord: 'postcode' },
  { sourceWord: 'lawyer', targetWord: 'solicitor' },
  { sourceWord: 'attorney', targetWord: 'barrister' },
  { sourceWord: 'fall', targetWord: 'autumn', contextHint: 'season' },
];

const EN_UK_TO_US_RULES: readonly DialectNormalizationRule[] = EN_US_TO_UK_RULES.map((r) => ({
  sourceWord: r.targetWord,
  targetWord: r.sourceWord,
  contextHint: r.contextHint,
}));

// ─── Japanese Tokyo vs Osaka / Kansai Rules ───────────────────────────────────

const JA_TOKYO_TO_OSAKA_RULES: readonly DialectNormalizationRule[] = [
  { sourceWord: 'ありがとう', targetWord: 'おおきに' },
  { sourceWord: 'ありがとうございます', targetWord: 'おおきに' },
  { sourceWord: '本当に', targetWord: 'ほんまに' },
  { sourceWord: '本当', targetWord: 'ほんま' },
  { sourceWord: 'だめ', targetWord: 'あかん' },
  { sourceWord: 'ダメ', targetWord: 'あかん' },
  { sourceWord: 'いくら', targetWord: 'なんぼ' },
  { sourceWord: 'とても', targetWord: 'めっちゃ' },
  { sourceWord: 'すごく', targetWord: 'めっちゃ' },
  { sourceWord: '面白い', targetWord: 'おもろい' },
  { sourceWord: 'おもしろい', targetWord: 'おもろい' },
  { sourceWord: '馬鹿', targetWord: 'アホ' },
  { sourceWord: 'バカ', targetWord: 'アホ' },
  { sourceWord: 'ばか', targetWord: 'アホ' },
  { sourceWord: '違う', targetWord: 'ちゃう' },
  { sourceWord: '違います', targetWord: 'ちゃいます' },
  { sourceWord: 'じゃない', targetWord: 'やない' },
  { sourceWord: 'ではない', targetWord: 'やない' },
  { sourceWord: '知らない', targetWord: '知らん' },
  { sourceWord: 'わからない', targetWord: 'わからん' },
  { sourceWord: '良い', targetWord: 'ええ' },
  { sourceWord: 'いい', targetWord: 'ええ' },
  { sourceWord: 'どうして', targetWord: 'なんでやねん' },
];

const JA_OSAKA_TO_TOKYO_RULES: readonly DialectNormalizationRule[] = JA_TOKYO_TO_OSAKA_RULES.map((r) => ({
  sourceWord: r.targetWord,
  targetWord: r.sourceWord,
}));

// ─── Vietnamese Bắc vs Nam vs Trung Rules ─────────────────────────────────────

const VI_BAC_TO_NAM_RULES: readonly DialectNormalizationRule[] = [
  { sourceWord: 'cốc', targetWord: 'ly' },
  { sourceWord: 'ngô', targetWord: 'bắp' },
  { sourceWord: 'thìa', targetWord: 'muỗng' },
  { sourceWord: 'dứa', targetWord: 'thơm' },
  { sourceWord: 'hoa quả', targetWord: 'trái cây' },
  { sourceWord: 'lợn', targetWord: 'heo' },
  { sourceWord: 'bố', targetWord: 'ba' },
  { sourceWord: 'mẹ', targetWord: 'má' },
  { sourceWord: 'vào', targetWord: 'vô' },
  { sourceWord: 'lạc', targetWord: 'đậu phộng' },
  { sourceWord: 'muộn', targetWord: 'trễ' },
  { sourceWord: 'đỗ', targetWord: 'đậu' },
  { sourceWord: 'gầy', targetWord: 'ốm' },
  { sourceWord: 'ô tô', targetWord: 'xe hơi' },
  { sourceWord: 'kính', targetWord: 'kiếng' },
  { sourceWord: 'tất', targetWord: 'vớ' },
  { sourceWord: 'ô', targetWord: 'dù' },
  { sourceWord: 'bát', targetWord: 'chén' },
  { sourceWord: 'chăn', targetWord: 'mền' },
];

const VI_NAM_TO_BAC_RULES: readonly DialectNormalizationRule[] = VI_BAC_TO_NAM_RULES.map((r) => ({
  sourceWord: r.targetWord,
  targetWord: r.sourceWord,
}));

const VI_CENTRAL_TO_STANDARD_RULES: readonly DialectNormalizationRule[] = [
  { sourceWord: 'mô', targetWord: 'đâu' },
  { sourceWord: 'tê', targetWord: 'kia' },
  { sourceWord: 'răng', targetWord: 'sao' },
  { sourceWord: 'rứa', targetWord: 'thế' },
  { sourceWord: 'chộ', targetWord: 'thấy' },
  { sourceWord: 'trốc', targetWord: 'đầu' },
  { sourceWord: 'chi', targetWord: 'gì' },
  { sourceWord: 'ri', targetWord: 'này' },
  { sourceWord: 'nớ', targetWord: 'ấy' },
];

const VI_STANDARD_TO_CENTRAL_RULES: readonly DialectNormalizationRule[] = [
  { sourceWord: 'đâu', targetWord: 'mô' },
  { sourceWord: 'kia', targetWord: 'tê' },
  { sourceWord: 'sao', targetWord: 'răng' },
  { sourceWord: 'thế', targetWord: 'rứa' },
  { sourceWord: 'thấy', targetWord: 'chộ' },
  { sourceWord: 'gì', targetWord: 'chi' },
];

// ─── Helpers: Case Preservation & Word Boundary Matching ──────────────────────

function preserveCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  // All uppercase: ELEVATOR -> LIFT
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return replacement.toUpperCase();
  }
  // Title case: Elevator -> Lift
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement.toLowerCase();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace a word or phrase while respecting boundaries and casing.
 */
function replaceToken(text: string, source: string, target: string): { newText: string; count: number } {
  // Use unicode-aware word boundaries for non-CJK, or direct substring match for CJK
  const isCjk = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(source);
  const regex = isCjk
    ? new RegExp(escapeRegex(source), 'g')
    : new RegExp(`(?<=^|\\P{L})${escapeRegex(source)}(?=\\P{L}|$)`, 'giu');

  let count = 0;
  const newText = text.replace(regex, (match) => {
    count++;
    return preserveCase(match, target);
  });

  return { newText, count };
}

// ─── Core Exported Functions ──────────────────────────────────────────────────

export interface DialectNormalizationResult {
  sourceDialect: RegionalDialect;
  targetDialect: RegionalDialect;
  originalText: string;
  normalizedText: string;
  replacementsCount: number;
  appliedRules: DialectNormalizationRule[];
}

/**
 * Perform bidirectional dialect normalization between regional variants.
 */
export function normalizeDialect(
  text: string,
  sourceDialect: RegionalDialect,
  targetDialect: RegionalDialect,
): DialectNormalizationResult {
  if (!text || sourceDialect === targetDialect) {
    return {
      sourceDialect,
      targetDialect,
      originalText: text,
      normalizedText: text,
      replacementsCount: 0,
      appliedRules: [],
    };
  }

  let rules: readonly DialectNormalizationRule[] = [];

  // Determine applicable rules based on dialect pairs
  if (sourceDialect === 'en-US' && targetDialect === 'en-GB') {
    rules = EN_US_TO_UK_RULES;
  } else if (sourceDialect === 'en-GB' && targetDialect === 'en-US') {
    rules = EN_UK_TO_US_RULES;
  } else if (sourceDialect === 'ja-JP-tokyo' && targetDialect === 'ja-JP-osaka') {
    rules = JA_TOKYO_TO_OSAKA_RULES;
  } else if (sourceDialect === 'ja-JP-osaka' && targetDialect === 'ja-JP-tokyo') {
    rules = JA_OSAKA_TO_TOKYO_RULES;
  } else if (sourceDialect === 'vi-VN-bac' && targetDialect === 'vi-VN-nam') {
    rules = VI_BAC_TO_NAM_RULES;
  } else if (sourceDialect === 'vi-VN-nam' && targetDialect === 'vi-VN-bac') {
    rules = VI_NAM_TO_BAC_RULES;
  } else if (sourceDialect === 'vi-VN-trung' && targetDialect === 'vi-VN-bac') {
    rules = VI_CENTRAL_TO_STANDARD_RULES;
  } else if (sourceDialect === 'vi-VN-trung' && targetDialect === 'vi-VN-nam') {
    // Central to South: first standardize, then apply South replacements
    const std = normalizeDialect(text, 'vi-VN-trung', 'vi-VN-bac');
    const south = normalizeDialect(std.normalizedText, 'vi-VN-bac', 'vi-VN-nam');
    return {
      sourceDialect,
      targetDialect,
      originalText: text,
      normalizedText: south.normalizedText,
      replacementsCount: std.replacementsCount + south.replacementsCount,
      appliedRules: [...std.appliedRules, ...south.appliedRules],
    };
  } else if (sourceDialect === 'vi-VN-bac' && targetDialect === 'vi-VN-trung') {
    rules = VI_STANDARD_TO_CENTRAL_RULES;
  } else if (sourceDialect === 'vi-VN-nam' && targetDialect === 'vi-VN-trung') {
    // South to Central: first to North (Standard), then to Central
    const std = normalizeDialect(text, 'vi-VN-nam', 'vi-VN-bac');
    const central = normalizeDialect(std.normalizedText, 'vi-VN-bac', 'vi-VN-trung');
    return {
      sourceDialect,
      targetDialect,
      originalText: text,
      normalizedText: central.normalizedText,
      replacementsCount: std.replacementsCount + central.replacementsCount,
      appliedRules: [...std.appliedRules, ...central.appliedRules],
    };
  }

  let currentText = text;
  let totalCount = 0;
  const applied: DialectNormalizationRule[] = [];

  // Apply spelling transformations for US <-> UK
  if (sourceDialect === 'en-US' && targetDialect === 'en-GB') {
    // -or -> -our (e.g. color -> colour, flavor -> flavour, honor -> honour)
    currentText = currentText.replace(/\b([a-zA-Z]+)or\b/gi, (match, prefix) => {
      const lower = match.toLowerCase();
      // Whitelist common Latin -or words that become -our in British English
      const ourWords = ['color', 'flavor', 'honor', 'humor', 'neighbor', 'labor', 'favor', 'harbor', 'rumor'];
      if (ourWords.includes(lower)) {
        totalCount++;
        applied.push({ sourceWord: match, targetWord: prefix + (match.endsWith('OR') ? 'OUR' : 'our') });
        return preserveCase(match, `${prefix}our`);
      }
      return match;
    });

    // -ize -> -ise (e.g. organize -> organise, realize -> realise)
    currentText = currentText.replace(/\b([a-zA-Z]+)ize(s|d|r|rs|d)?\b/gi, (match, stem, suffix) => {
      totalCount++;
      const suf = suffix || '';
      applied.push({ sourceWord: match, targetWord: `${stem}ise${suf}` });
      return preserveCase(match, `${stem}ise${suf}`);
    });
  } else if (sourceDialect === 'en-GB' && targetDialect === 'en-US') {
    // -our -> -or
    currentText = currentText.replace(/\b([a-zA-Z]+)our\b/gi, (match, prefix) => {
      const lower = match.toLowerCase();
      const ourWords = ['colour', 'flavour', 'honour', 'humour', 'neighbour', 'labour', 'favour', 'harbour', 'rumour'];
      if (ourWords.includes(lower)) {
        totalCount++;
        applied.push({ sourceWord: match, targetWord: prefix + (match.endsWith('OUR') ? 'OR' : 'or') });
        return preserveCase(match, `${prefix}or`);
      }
      return match;
    });

    // -ise -> -ize
    currentText = currentText.replace(/\b([a-zA-Z]+)ise(s|d|r|rs|d)?\b/gi, (match, stem, suffix) => {
      totalCount++;
      const suf = suffix || '';
      applied.push({ sourceWord: match, targetWord: `${stem}ize${suf}` });
      return preserveCase(match, `${stem}ize${suf}`);
    });
  }

  // Apply vocabulary rules
  for (const rule of rules) {
    const { newText, count } = replaceToken(currentText, rule.sourceWord, rule.targetWord);
    if (count > 0) {
      currentText = newText;
      totalCount += count;
      applied.push(rule);
    }
  }

  return {
    sourceDialect,
    targetDialect,
    originalText: text,
    normalizedText: currentText,
    replacementsCount: totalCount,
    appliedRules: applied,
  };
}

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
