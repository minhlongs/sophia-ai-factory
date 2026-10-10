/**
 * Regional Dialect Lexical & Phonetic Mapping Rules
 *
 * Layer: tree/cultural-adaptation/normalizer
 */

import type { DialectNormalizationRule } from '@/seed/types/cultural-adaptation';

// ─── English Dialect Lexical & Spelling Rules ─────────────────────────────────

export const EN_US_TO_UK_RULES: readonly DialectNormalizationRule[] = [
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

export const EN_UK_TO_US_RULES: readonly DialectNormalizationRule[] = EN_US_TO_UK_RULES.map((r) => ({
  sourceWord: r.targetWord,
  targetWord: r.sourceWord,
  contextHint: r.contextHint,
}));

// ─── Japanese Tokyo vs Osaka / Kansai Rules ───────────────────────────────────

export const JA_TOKYO_TO_OSAKA_RULES: readonly DialectNormalizationRule[] = [
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

export const JA_OSAKA_TO_TOKYO_RULES: readonly DialectNormalizationRule[] = JA_TOKYO_TO_OSAKA_RULES.map((r) => ({
  sourceWord: r.targetWord,
  targetWord: r.sourceWord,
}));

// ─── Vietnamese Bắc vs Nam vs Trung Rules ─────────────────────────────────────

export const VI_BAC_TO_NAM_RULES: readonly DialectNormalizationRule[] = [
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

export const VI_NAM_TO_BAC_RULES: readonly DialectNormalizationRule[] = VI_BAC_TO_NAM_RULES.map((r) => ({
  sourceWord: r.targetWord,
  targetWord: r.sourceWord,
}));

export const VI_CENTRAL_TO_STANDARD_RULES: readonly DialectNormalizationRule[] = [
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

export const VI_STANDARD_TO_CENTRAL_RULES: readonly DialectNormalizationRule[] = [
  { sourceWord: 'đâu', targetWord: 'mô' },
  { sourceWord: 'kia', targetWord: 'tê' },
  { sourceWord: 'sao', targetWord: 'răng' },
  { sourceWord: 'thế', targetWord: 'rứa' },
  { sourceWord: 'thấy', targetWord: 'chộ' },
  { sourceWord: 'gì', targetWord: 'chi' },
];
