/**
 * Regional Dialect Localized Voice Profiles Registry
 *
 * Layer: seed (voice metadata, dialect bindings, and prosody parameters)
 * Supports Milestone $800k MRR: US vs UK English, Tokyo vs Osaka Japanese,
 * and Vietnam Northern, Central, Southern dialect voice profiles.
 *
 * @module seed/voices/localized-profiles
 */

import type { Tier, Gender } from './presets';
import type {
  RegionalDialect,
  DialectProsody,
  DialectNormalizationRule,
} from '@/seed/types/cultural-adaptation';

export interface LocalizedVoiceProfile {
  id: string;
  presetId: string;
  locale: string;
  baseLanguage: string;
  dialect: RegionalDialect;
  dialectCode: string;
  displayName: string;
  gender: Gender;
  edgeVoiceName: string;
  prosody: DialectProsody;
  prosodySsmlTemplate?: string;
  lexicon: DialectNormalizationRule[];
  minTier: Tier;
  samplePath: string;
  description: string;
  status: 'active' | 'beta' | 'deprecated';
}

/**
 * Canonical registry of localized dialect voice profiles.
 */
export const LOCALIZED_VOICE_PROFILES: readonly LocalizedVoiceProfile[] = [
  // ── English (US vs UK) ─────────────────────────────────────────────────────
  {
    id: 'prof-en-us-jenny',
    presetId: 'sophia-us-f',
    locale: 'en-US',
    baseLanguage: 'en',
    dialect: 'en-US',
    dialectCode: 'us',
    displayName: 'Sophia (US General)',
    gender: 'female',
    edgeVoiceName: 'en-US-JennyNeural',
    prosody: {
      pitchOffset: '+0Hz',
      rateMultiplier: 1.0,
      cadenceStyle: 'standard',
    },
    prosodySsmlTemplate: "<prosody rate='+0%' pitch='+0Hz'>{text}</prosody>",
    lexicon: [],
    minTier: 'BASIC',
    samplePath: '/voices/sophia-us-f.wav',
    description: 'Crisp, contemporary American English female voice',
    status: 'active',
  },
  {
    id: 'prof-en-us-guy',
    presetId: 'alex-us-m',
    locale: 'en-US',
    baseLanguage: 'en',
    dialect: 'en-US',
    dialectCode: 'us',
    displayName: 'Alex (US General)',
    gender: 'male',
    edgeVoiceName: 'en-US-GuyNeural',
    prosody: {
      pitchOffset: '+0Hz',
      rateMultiplier: 1.0,
      cadenceStyle: 'authoritative',
    },
    prosodySsmlTemplate: "<prosody rate='+0%' pitch='+0Hz'>{text}</prosody>",
    lexicon: [],
    minTier: 'BASIC',
    samplePath: '/voices/alex-us-m.wav',
    description: 'Direct, confident American English male narrator',
    status: 'active',
  },
  {
    id: 'prof-en-gb-sonia',
    presetId: 'sonia-uk-f',
    locale: 'en-GB',
    baseLanguage: 'en',
    dialect: 'en-GB',
    dialectCode: 'uk',
    displayName: 'Sonia (UK Received Pronunciation)',
    gender: 'female',
    edgeVoiceName: 'en-GB-SoniaNeural',
    prosody: {
      pitchOffset: '+2Hz',
      rateMultiplier: 0.98,
      cadenceStyle: 'melodic',
    },
    prosodySsmlTemplate: "<prosody rate='-2%' pitch='+2Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'apartment', targetWord: 'flat' },
      { sourceWord: 'elevator', targetWord: 'lift' },
      { sourceWord: 'sidewalk', targetWord: 'pavement' },
      { sourceWord: 'vacation', targetWord: 'holiday' },
    ],
    minTier: 'PREMIUM',
    samplePath: '/voices/sonia-uk-f.wav',
    description: 'Polished British RP female voice with natural cadence',
    status: 'active',
  },
  {
    id: 'prof-en-gb-ryan',
    presetId: 'ryan-uk-m',
    locale: 'en-GB',
    baseLanguage: 'en',
    dialect: 'en-GB',
    dialectCode: 'uk',
    displayName: 'Ryan (UK Contemporary)',
    gender: 'male',
    edgeVoiceName: 'en-GB-RyanNeural',
    prosody: {
      pitchOffset: '-2Hz',
      rateMultiplier: 0.98,
      cadenceStyle: 'authoritative',
    },
    prosodySsmlTemplate: "<prosody rate='-2%' pitch='-2Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'truck', targetWord: 'lorry' },
      { sourceWord: 'subway', targetWord: 'underground' },
      { sourceWord: 'french fries', targetWord: 'chips' },
    ],
    minTier: 'PREMIUM',
    samplePath: '/voices/ryan-uk-m.wav',
    description: 'Warm, refined British English male narrator',
    status: 'active',
  },

  // ── Japanese (Tokyo vs Osaka / Kansai) ──────────────────────────────────────
  {
    id: 'prof-ja-jp-nanami',
    presetId: 'nanami-tokyo-f',
    locale: 'ja-JP',
    baseLanguage: 'ja',
    dialect: 'ja-JP-tokyo',
    dialectCode: 'tokyo',
    displayName: '七海 / Nanami (Tokyo Standard)',
    gender: 'female',
    edgeVoiceName: 'ja-JP-NanamiNeural',
    prosody: {
      pitchOffset: '+0Hz',
      rateMultiplier: 1.0,
      cadenceStyle: 'standard',
    },
    prosodySsmlTemplate: "<prosody rate='+0%' pitch='+0Hz'>{text}</prosody>",
    lexicon: [],
    minTier: 'BASIC',
    samplePath: '/voices/nanami-tokyo-f.wav',
    description: 'Clear, polite standard Tokyo Japanese female narration',
    status: 'active',
  },
  {
    id: 'prof-ja-jp-keita',
    presetId: 'keita-tokyo-m',
    locale: 'ja-JP',
    baseLanguage: 'ja',
    dialect: 'ja-JP-tokyo',
    dialectCode: 'tokyo',
    displayName: '啓太 / Keita (Tokyo Standard)',
    gender: 'male',
    edgeVoiceName: 'ja-JP-KeitaNeural',
    prosody: {
      pitchOffset: '+0Hz',
      rateMultiplier: 1.0,
      cadenceStyle: 'authoritative',
    },
    prosodySsmlTemplate: "<prosody rate='+0%' pitch='+0Hz'>{text}</prosody>",
    lexicon: [],
    minTier: 'BASIC',
    samplePath: '/voices/keita-tokyo-m.wav',
    description: 'Professional Tokyo corporate male voice',
    status: 'active',
  },
  {
    id: 'prof-ja-jp-aoi-osaka',
    presetId: 'aoi-osaka-f',
    locale: 'ja-JP',
    baseLanguage: 'ja',
    dialect: 'ja-JP-osaka',
    dialectCode: 'osaka',
    displayName: '葵 / Aoi (Osaka / Kansai Dialect)',
    gender: 'female',
    edgeVoiceName: 'ja-JP-NanamiNeural',
    prosody: {
      pitchOffset: '+4Hz',
      rateMultiplier: 1.08,
      cadenceStyle: 'melodic',
    },
    prosodySsmlTemplate: "<prosody rate='+8%' pitch='+4Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'ありがとう', targetWord: 'おおきに' },
      { sourceWord: '本当に', targetWord: 'ほんまに' },
      { sourceWord: 'だめ', targetWord: 'あかん' },
      { sourceWord: 'とても', targetWord: 'めっちゃ' },
    ],
    minTier: 'PREMIUM',
    samplePath: '/voices/aoi-osaka-f.wav',
    description: 'Friendly, expressive Kansai female dialect tuning',
    status: 'active',
  },
  {
    id: 'prof-ja-jp-ren-osaka',
    presetId: 'ren-osaka-m',
    locale: 'ja-JP',
    baseLanguage: 'ja',
    dialect: 'ja-JP-osaka',
    dialectCode: 'osaka',
    displayName: '蓮 / Ren (Osaka / Kansai Dialect)',
    gender: 'male',
    edgeVoiceName: 'ja-JP-KeitaNeural',
    prosody: {
      pitchOffset: '+2Hz',
      rateMultiplier: 1.06,
      cadenceStyle: 'staccato',
    },
    prosodySsmlTemplate: "<prosody rate='+6%' pitch='+2Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: '面白い', targetWord: 'おもろい' },
      { sourceWord: 'いくら', targetWord: 'なんぼ' },
      { sourceWord: 'じゃない', targetWord: 'やない' },
    ],
    minTier: 'PREMIUM',
    samplePath: '/voices/ren-osaka-m.wav',
    description: 'Energetic, punchy Osaka merchant & comedy male style',
    status: 'active',
  },

  // ── Vietnamese (Bắc vs Trung vs Nam) ───────────────────────────────────────
  {
    id: 'prof-vi-vn-namminh-bac',
    presetId: 'namminh-vn-bac-m',
    locale: 'vi-VN',
    baseLanguage: 'vi',
    dialect: 'vi-VN-bac',
    dialectCode: 'bac',
    displayName: 'Nam Minh (Hà Nội - Bắc Bộ)',
    gender: 'male',
    edgeVoiceName: 'vi-VN-NamMinhNeural',
    prosody: {
      pitchOffset: '+0Hz',
      rateMultiplier: 1.0,
      cadenceStyle: 'authoritative',
    },
    prosodySsmlTemplate: "<prosody rate='+0%' pitch='+0Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'ly', targetWord: 'cốc' },
      { sourceWord: 'bắp', targetWord: 'ngô' },
      { sourceWord: 'muỗng', targetWord: 'thìa' },
      { sourceWord: 'trễ', targetWord: 'muộn' },
    ],
    minTier: 'BASIC',
    samplePath: '/voices/namminh-vn-bac-m.wav',
    description: 'Giọng nam chuẩn Hà Nội trang trọng, sắc nét, tin cậy',
    status: 'active',
  },
  {
    id: 'prof-vi-vn-linh-bac',
    presetId: 'linh-vn-bac-f',
    locale: 'vi-VN',
    baseLanguage: 'vi',
    dialect: 'vi-VN-bac',
    dialectCode: 'bac',
    displayName: 'Linh (Hà Nội - Bắc Bộ)',
    gender: 'female',
    edgeVoiceName: 'vi-VN-HoaiMyNeural',
    prosody: {
      pitchOffset: '+2Hz',
      rateMultiplier: 1.02,
      cadenceStyle: 'standard',
    },
    prosodySsmlTemplate: "<prosody rate='+2%' pitch='+2Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'thơm', targetWord: 'dứa' },
      { sourceWord: 'trái cây', targetWord: 'hoa quả' },
      { sourceWord: 'heo', targetWord: 'lợn' },
    ],
    minTier: 'BASIC',
    samplePath: '/voices/linh-vn-bac-f.wav',
    description: 'Giọng nữ Hà Nội thanh lịch, chuẩn phát âm truyền hình',
    status: 'active',
  },
  {
    id: 'prof-vi-vn-huong-trung',
    presetId: 'huong-vn-trung-f',
    locale: 'vi-VN',
    baseLanguage: 'vi',
    dialect: 'vi-VN-trung',
    dialectCode: 'trung',
    displayName: 'Hương (Huế / Miền Trung)',
    gender: 'female',
    edgeVoiceName: 'vi-VN-HoaiMyNeural',
    prosody: {
      pitchOffset: '-2Hz',
      rateMultiplier: 0.95,
      cadenceStyle: 'melodic',
    },
    prosodySsmlTemplate: "<prosody rate='-5%' pitch='-2Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'sao', targetWord: 'răng' },
      { sourceWord: 'thế', targetWord: 'rứa' },
      { sourceWord: 'đâu', targetWord: 'mô' },
      { sourceWord: 'thấy', targetWord: 'chộ' },
    ],
    minTier: 'PREMIUM',
    samplePath: '/voices/huong-vn-trung-f.wav',
    description: 'Giọng nữ Miền Trung ngọt ngào, dịu dàng, lắng đọng',
    status: 'active',
  },
  {
    id: 'prof-vi-vn-hai-trung',
    presetId: 'hai-vn-trung-m',
    locale: 'vi-VN',
    baseLanguage: 'vi',
    dialect: 'vi-VN-trung',
    dialectCode: 'trung',
    displayName: 'Hải (Đà Nẵng / Miền Trung)',
    gender: 'male',
    edgeVoiceName: 'vi-VN-NamMinhNeural',
    prosody: {
      pitchOffset: '-1Hz',
      rateMultiplier: 0.97,
      cadenceStyle: 'melodic',
    },
    prosodySsmlTemplate: "<prosody rate='-3%' pitch='-1Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'thế nào', targetWord: 'răng hè' },
      { sourceWord: 'kia', targetWord: 'tê' },
    ],
    minTier: 'PREMIUM',
    samplePath: '/voices/hai-vn-trung-m.wav',
    description: 'Giọng nam Miền Trung mộc mạc, truyền cảm',
    status: 'active',
  },
  {
    id: 'prof-vi-vn-hoaimy-nam',
    presetId: 'hoaimy-vn-nam-f',
    locale: 'vi-VN',
    baseLanguage: 'vi',
    dialect: 'vi-VN-nam',
    dialectCode: 'nam',
    displayName: 'Hoài My (Sài Gòn - Nam Bộ)',
    gender: 'female',
    edgeVoiceName: 'vi-VN-HoaiMyNeural',
    prosody: {
      pitchOffset: '+0Hz',
      rateMultiplier: 1.0,
      cadenceStyle: 'standard',
    },
    prosodySsmlTemplate: "<prosody rate='+0%' pitch='+0Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'cốc', targetWord: 'ly' },
      { sourceWord: 'ngô', targetWord: 'bắp' },
      { sourceWord: 'thìa', targetWord: 'muỗng' },
      { sourceWord: 'muộn', targetWord: 'trễ' },
    ],
    minTier: 'BASIC',
    samplePath: '/voices/hoaimy-vn-nam-f.wav',
    description: 'Giọng nữ Nam Bộ tự nhiên, ấm áp, gần gũi',
    status: 'active',
  },
  {
    id: 'prof-vi-vn-bao-nam',
    presetId: 'bao-vn-nam-m',
    locale: 'vi-VN',
    baseLanguage: 'vi',
    dialect: 'vi-VN-nam',
    dialectCode: 'nam',
    displayName: 'Bảo (Sài Gòn - Nam Bộ)',
    gender: 'male',
    edgeVoiceName: 'vi-VN-NamMinhNeural',
    prosody: {
      pitchOffset: '+1Hz',
      rateMultiplier: 1.03,
      cadenceStyle: 'staccato',
    },
    prosodySsmlTemplate: "<prosody rate='+3%' pitch='+1Hz'>{text}</prosody>",
    lexicon: [
      { sourceWord: 'bố', targetWord: 'ba' },
      { sourceWord: 'vào', targetWord: 'vô' },
      { sourceWord: 'lạc', targetWord: 'đậu phộng' },
      { sourceWord: 'gầy', targetWord: 'ốm' },
    ],
    minTier: 'BASIC',
    samplePath: '/voices/bao-vn-nam-m.wav',
    description: 'Giọng nam Sài Gòn năng động, thân thiện, quảng cáo số',
    status: 'active',
  },
] as const;

/**
 * Retrieve a localized voice profile by stable preset ID.
 */
export function getLocalizedVoiceProfile(presetId: string): LocalizedVoiceProfile | undefined {
  return LOCALIZED_VOICE_PROFILES.find((p) => p.presetId === presetId || p.id === presetId);
}

/**
 * List localized voice profiles matching an optional filter.
 */
export function listLocalizedVoiceProfiles(filter?: {
  dialect?: RegionalDialect;
  baseLanguage?: string;
  gender?: Gender;
  minTier?: Tier;
}): readonly LocalizedVoiceProfile[] {
  return LOCALIZED_VOICE_PROFILES.filter((profile) => {
    if (filter?.dialect && profile.dialect !== filter.dialect) return false;
    if (filter?.baseLanguage && profile.baseLanguage !== filter.baseLanguage) return false;
    if (filter?.gender && profile.gender !== filter.gender) return false;
    if (filter?.minTier && profile.minTier !== filter.minTier) return false;
    return true;
  });
}

/**
 * Resolve the best matching localized voice profile for a dialect and gender.
 */
export function resolveDialectVoice(
  dialect: RegionalDialect,
  gender: Gender = 'female',
): LocalizedVoiceProfile {
  const match = LOCALIZED_VOICE_PROFILES.find(
    (p) => p.dialect === dialect && p.gender === gender && p.status === 'active',
  );
  if (match) return match;

  const dialectFallback = LOCALIZED_VOICE_PROFILES.find(
    (p) => p.dialect === dialect && p.status === 'active',
  );
  if (dialectFallback) return dialectFallback;

  // Ultimate fallback to default profile
  return LOCALIZED_VOICE_PROFILES[0];
}
